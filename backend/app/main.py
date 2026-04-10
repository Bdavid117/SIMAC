from __future__ import annotations

from contextlib import asynccontextmanager
import logging
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field, RootModel

from app.database import get_history, init_db, save_calculation
from app.interpolator import homogenize

logger = logging.getLogger(__name__)


class RawDataRoot(RootModel[list[dict[str, Any]]]):
    pass


class RawDataWrapper(BaseModel):
    data: list[dict[str, Any]] = Field(min_length=1)


class HomogenizeResponse(BaseModel):
    id: int
    processed_data: list[dict[str, Any]]


class HistoryItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: str
    raw_data: list[dict[str, Any]]
    processed_data: list[dict[str, Any]]


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


def _extract_records(payload: RawDataRoot | RawDataWrapper) -> list[dict[str, Any]]:
    if isinstance(payload, RawDataRoot):
        records = payload.root
    else:
        records = payload.data

    if not records:
        raise HTTPException(status_code=422, detail="El payload no contiene registros")

    return records


@app.post("/homogenize", response_model=HomogenizeResponse)
async def homogenize_endpoint(payload: RawDataRoot | RawDataWrapper) -> HomogenizeResponse:
    records = _extract_records(payload)

    try:
        processed_data = homogenize(records)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        logger.exception("Error inesperado en homogenize")
        raise HTTPException(status_code=500, detail="Error interno durante homogenizacion") from exc

    saved = await save_calculation(raw_data=records, processed_data=processed_data)
    return HomogenizeResponse(id=saved.id, processed_data=processed_data)


@app.get("/history", response_model=list[HistoryItemResponse])
async def history_endpoint() -> list[HistoryItemResponse]:
    rows = await get_history(limit=10)

    return [
        HistoryItemResponse(
            id=row.id,
            created_at=row.created_at.isoformat(),
            raw_data=row.raw_data,
            processed_data=row.processed_data,
        )
        for row in rows
    ]


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "phase": "2"}
