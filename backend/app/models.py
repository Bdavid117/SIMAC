from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class ErrorCode(str, Enum):
	INVALID_PAYLOAD = "E001_INVALID_PAYLOAD"
	NO_TIMESTAMP = "E002_NO_TIMESTAMP"
	NO_VARIABLES = "E003_NO_VARIABLES"
	INVALID_DATA = "E004_INVALID_DATA"
	DATABASE_ERROR = "E500_DATABASE_ERROR"
	INTERNAL_ERROR = "E500_INTERNAL_ERROR"


class ErrorResponse(BaseModel):
	code: ErrorCode
	message: str
	traceId: str
	timestamp: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
	requestPath: str
	details: dict[str, Any] | None = None


class VariableQualityMetric(BaseModel):
	total_points: int
	original_count: int
	interpolated_count: int
	carried_count: int
	missing_count: int
	coverage_pct: float


class QualityMetrics(BaseModel):
	total_records: int
	total_variables: int
	total_cells: int
	resolved_cells: int
	missing_cells: int
	coverage_pct: float
	original_cells: int
	interpolated_cells: int
	carried_cells: int
	processing_duration_ms: int = 0
	algorithm_version: str = "v1.0"
	per_variable: dict[str, VariableQualityMetric] = Field(default_factory=dict)


class HomogenizeResponseModel(BaseModel):
	id: int
	processed_data: list[dict[str, Any]]
	quality_metrics: QualityMetrics
