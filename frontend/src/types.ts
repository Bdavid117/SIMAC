export type StationValue = number | string | null;

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
}

export interface HomogenizeResponse {
	id: number;
	processed_data: ProcessedStationData[];
}

