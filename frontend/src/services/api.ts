import axios from "axios";

import type { ApiErrorResponse, HistoryResponse, HomogenizeResponse, RawStationData } from "../types";

export class ApiClientError extends Error {
  code?: string;
  traceId?: string;
  status?: number;
  details?: Record<string, unknown>;

  constructor(
    message: string,
    options?: {
      code?: string;
      traceId?: string;
      status?: number;
      details?: Record<string, unknown>;
    },
  ) {
    super(message);
    this.name = "ApiClientError";
    this.code = options?.code;
    this.traceId = options?.traceId;
    this.status = options?.status;
    this.details = options?.details;
  }
}

function generateRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `req-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function parseApiError(error: unknown): ApiClientError {
  if (!axios.isAxiosError(error)) {
    return new ApiClientError("No fue posible completar la solicitud");
  }

  const responseData = (error.response?.data ?? {}) as Partial<ApiErrorResponse & { detail?: string }>;
  const traceId =
    responseData.traceId ??
    (error.response?.headers?.["x-request-id"] as string | undefined) ??
    (error.config?.headers?.["X-Request-ID"] as string | undefined);

  const message = responseData.message ?? responseData.detail ?? error.message ?? "Error de red";

  return new ApiClientError(message, {
    code: responseData.code,
    traceId,
    status: error.response?.status,
    details: responseData.details,
  });
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000",
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const requestId = generateRequestId();
  config.headers = config.headers ?? {};
  config.headers["X-Request-ID"] = requestId;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(parseApiError(error)),
);

export async function uploadData(data: RawStationData[]): Promise<HomogenizeResponse> {
  const response = await api.post<HomogenizeResponse>("/homogenize", data);
  return response.data;
}

export async function fetchHistory(page = 1, pageSize = 10): Promise<HistoryResponse> {
  const response = await api.get<HistoryResponse>("/history", {
    params: {
      page,
      page_size: pageSize,
    },
  });
  return response.data;
}
