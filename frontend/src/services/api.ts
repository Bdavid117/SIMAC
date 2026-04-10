import axios from "axios";

import type { HistoryItem, HomogenizeResponse, RawStationData } from "../types";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000",
  timeout: 20000,
});

export async function uploadData(data: RawStationData[]): Promise<HomogenizeResponse> {
  const response = await api.post<HomogenizeResponse>("/homogenize", data);
  return response.data;
}

export async function fetchHistory(): Promise<HistoryItem[]> {
  const response = await api.get<HistoryItem[]>("/history");
  return response.data;
}
