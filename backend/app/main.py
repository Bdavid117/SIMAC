from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import datetime, timezone
import json
import logging
import time
from typing import Any
from uuid import uuid4

from fastapi import FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, RootModel

from app.database import check_db_connection, count_history, get_history_page, init_db, save_calculation
from app.interpolator import homogenize
from app.models import ErrorCode, ErrorResponse, HomogenizeResponseModel

logger = logging.getLogger("simac.api")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO, format="%(message)s")


class RawDataRoot(RootModel[list[dict[str, Any]]]):
    pass


class RawDataWrapper(BaseModel):
    data: list[dict[str, Any]] = Field(min_length=1)


class AppError(Exception):
    def __init__(
        self,
        status_code: int,
        code: ErrorCode,
        message: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details


class HistoryItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: str
    raw_data: list[dict[str, Any]]
    processed_data: list[dict[str, Any]]
    quality_metrics: dict[str, Any] = Field(default_factory=dict)


class HistoryResponse(BaseModel):
    items: list[HistoryItemResponse]
    page: int
    page_size: int
    total: int


@asynccontextmanager
async def lifespan(_: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="SIMAC Homogenizador API",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost",
        "http://localhost:80",
        "http://localhost:3000",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _log_event(level: int, event: str, **fields: Any) -> None:
    payload = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event": event,
        **fields,
    }
    logger.log(level, json.dumps(payload, ensure_ascii=False))


def _trace_id(request: Request) -> str:
    return getattr(request.state, "request_id", "unknown")


def _error_response(
    request: Request,
    status_code: int,
    code: ErrorCode,
    message: str,
    details: dict[str, Any] | None = None,
) -> JSONResponse:
    body = ErrorResponse(
        code=code,
        message=message,
        traceId=_trace_id(request),
        requestPath=request.url.path,
        details=details,
    )
    return JSONResponse(
        status_code=status_code,
        content=body.model_dump(mode="json"),
        headers={"X-Request-ID": _trace_id(request)},
    )


def _map_value_error(exc: ValueError) -> tuple[ErrorCode, int]:
    text = str(exc).lower()
    if "fecha/hora" in text:
        return ErrorCode.NO_TIMESTAMP, 400
    if "variables" in text:
        return ErrorCode.NO_VARIABLES, 400
    if "entrada" in text or "payload" in text or "vacia" in text:
        return ErrorCode.INVALID_PAYLOAD, 400
    return ErrorCode.INVALID_DATA, 422


@app.middleware("http")
async def request_observability_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid4())
    request.state.request_id = request_id
    start = time.perf_counter()

    try:
        response = await call_next(request)
    except Exception:
        latency_ms = int((time.perf_counter() - start) * 1000)
        _log_event(
            logging.ERROR,
            "request_failed",
            traceId=request_id,
            method=request.method,
            path=request.url.path,
            latency_ms=latency_ms,
        )
        raise

    latency_ms = int((time.perf_counter() - start) * 1000)
    response.headers["X-Request-ID"] = request_id
    _log_event(
        logging.INFO,
        "request_completed",
        traceId=request_id,
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        latency_ms=latency_ms,
    )
    return response


@app.exception_handler(AppError)
async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    _log_event(
        logging.WARNING,
        "app_error",
        traceId=_trace_id(request),
        code=exc.code,
        status_code=exc.status_code,
        message=exc.message,
    )
    return _error_response(request, exc.status_code, exc.code, exc.message, exc.details)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, _: Exception) -> JSONResponse:
    _log_event(
        logging.ERROR,
        "unhandled_error",
        traceId=_trace_id(request),
        path=request.url.path,
    )
    return _error_response(
        request,
        500,
        ErrorCode.INTERNAL_ERROR,
        "Error interno durante el procesamiento",
    )


def _extract_records(payload: RawDataRoot | RawDataWrapper) -> list[dict[str, Any]]:
    if isinstance(payload, RawDataRoot):
        records = payload.root
    else:
        records = payload.data

    if not records:
        raise AppError(
            status_code=400,
            code=ErrorCode.INVALID_PAYLOAD,
            message="El payload no contiene registros",
        )

    return records


@app.post("/homogenize", response_model=HomogenizeResponseModel)
async def homogenize_endpoint(payload: RawDataRoot | RawDataWrapper) -> HomogenizeResponseModel:
    records = _extract_records(payload)
    start = time.perf_counter()

    try:
        processed_data, metrics = homogenize(records)
    except ValueError as exc:
        code, status_code = _map_value_error(exc)
        raise AppError(status_code=status_code, code=code, message=str(exc)) from exc

    metrics = metrics.model_copy(update={"processing_duration_ms": int((time.perf_counter() - start) * 1000)})

    try:
        saved = await save_calculation(
            raw_data=records,
            processed_data=processed_data,
            quality_metrics=metrics.model_dump(mode="json"),
        )
    except Exception as exc:
        raise AppError(
            status_code=500,
            code=ErrorCode.DATABASE_ERROR,
            message="No fue posible persistir el calculo",
        ) from exc

    return HomogenizeResponseModel(id=saved.id, processed_data=processed_data, quality_metrics=metrics)


@app.get("/history", response_model=HistoryResponse)
async def history_endpoint(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=50),
) -> HistoryResponse:
    try:
        rows = await get_history_page(limit=page_size, page=page)
        total = await count_history()
    except Exception as exc:
        raise AppError(
            status_code=500,
            code=ErrorCode.DATABASE_ERROR,
            message="No fue posible consultar el historial",
        ) from exc

    items = [
      HistoryItemResponse(
          id=row.id,
          created_at=row.created_at.isoformat(),
          raw_data=row.raw_data,
          processed_data=row.processed_data,
          quality_metrics=row.quality_metrics or {},
      )
      for row in rows
    ]

    return HistoryResponse(items=items, page=page, page_size=page_size, total=total)


@app.get("/health")
async def health() -> JSONResponse:
    db_connected = await check_db_connection()
    status_code = 200 if db_connected else 503
    payload = {
        "status": "ok" if db_connected else "degraded",
        "phase": "2",
        "db": "connected" if db_connected else "disconnected",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    return JSONResponse(status_code=status_code, content=payload)


@app.get("/ready")
async def ready() -> JSONResponse:
    db_connected = await check_db_connection()
    status_code = 200 if db_connected else 503
    payload = {
        "ready": db_connected,
        "db": "connected" if db_connected else "disconnected",
    }
    return JSONResponse(status_code=status_code, content=payload)
