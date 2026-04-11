export type StationValue = number | string | null;

export interface VariableQualityMetric {
	total_points: number;
	original_count: number;
	interpolated_count: number;
	carried_count: number;
	missing_count: number;
	coverage_pct: number;
}

export interface QualityMetrics {
	total_records: number;
	total_variables: number;
	total_cells: number;
	resolved_cells: number;
	missing_cells: number;
	coverage_pct: number;
	original_cells: number;
	interpolated_cells: number;
	carried_cells: number;
	processing_duration_ms: number;
	algorithm_version: string;
	per_variable: Record<string, VariableQualityMetric>;
}

export interface ApiErrorResponse {
	code: string;
	message: string;
	traceId: string;
	timestamp: string;
	requestPath: string;
	details?: Record<string, unknown>;
}

export interface RawStationData {
	Fecha?: string;
	fecha?: string;
	Hora?: string;
	hora?: string;
	[key: string]: StationValue | undefined;
}

export interface ProcessedStationData {
	Fecha: string;
	Hora: string;
	[key: string]: StationValue | undefined;
}

export interface HistoryItem {
	id: number;
	created_at: string;
	raw_data: RawStationData[];
	processed_data: ProcessedStationData[];
	quality_metrics?: Record<string, unknown>;
}

export interface HistoryResponse {
	items: HistoryItem[];
	page: number;
	page_size: number;
	total: number;
}

export interface HomogenizeResponse {
	id: number;
	processed_data: ProcessedStationData[];
	quality_metrics: QualityMetrics;
}

