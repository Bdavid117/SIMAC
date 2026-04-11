import { useRef, useState } from "react";

import { ApiClientError, uploadData } from "../services/api";
import type { ProcessedStationData, QualityMetrics, RawStationData } from "../types";

interface FileUploadProps {
  onRawLoaded: (data: RawStationData[]) => void;
  onProcessedLoaded: (data: ProcessedStationData[], metrics: QualityMetrics) => void;
  onSaved: (id: number) => void;
  onRefreshHistory: () => Promise<void>;
}

function parsePayload(parsed: unknown): RawStationData[] {
  if (Array.isArray(parsed)) {
    return parsed as RawStationData[];
  }

  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "data" in parsed &&
    Array.isArray((parsed as { data: unknown }).data)
  ) {
    return (parsed as { data: RawStationData[] }).data;
  }

  throw new Error("El archivo JSON debe ser un arreglo o un objeto con la propiedad data");
}

export default function FileUpload({
  onRawLoaded,
  onProcessedLoaded,
  onSaved,
  onRefreshHistory,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const processFile = async (file: File) => {
    if (!file) {
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const content = await file.text();
      const parsed = JSON.parse(content) as unknown;
      const rawData = parsePayload(parsed);

      if (!rawData.length) {
        throw new Error("El archivo no contiene registros");
      }

      const response = await uploadData(rawData);
      onRawLoaded(rawData);
      onProcessedLoaded(response.processed_data, response.quality_metrics);
      onSaved(response.id);
      await onRefreshHistory();

      setSuccess(`Archivo procesado correctamente. Calculo #${response.id}`);
    } catch (caughtError) {
      let message = caughtError instanceof Error ? caughtError.message : "No fue posible procesar el archivo";

      if (caughtError instanceof ApiClientError && caughtError.traceId) {
        message = `${message} (Traza: ${caughtError.traceId})`;
      }

      setError(message);
    } finally {
      setLoading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  const handleInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    await processFile(file);
  };

  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);

    const file = event.dataTransfer.files?.[0];
    if (!file) {
      return;
    }

    await processFile(file);
  };

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
      <h2 className="font-serif text-xl font-semibold text-slate-800">Cargar datos de estacion</h2>
      <p className="mt-1 text-sm text-slate-500">
        Sube un archivo JSON para ejecutar la homogenizacion cincominutal.
      </p>

      <div
        className={`mt-4 rounded-2xl border-2 border-dashed p-5 transition ${
          dragActive ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50"
        }`}
        onDragEnter={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDragActive(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDragActive(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setDragActive(false);
        }}
        onDrop={handleDrop}
      >
        <p className="text-sm text-slate-600">Arrastra y suelta aqui tu archivo o usa el boton de seleccion.</p>
        <p className="mt-1 text-xs text-slate-500">Formatos soportados: .json</p>

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
        <label htmlFor="station-file" className="sr-only">
          Archivo JSON de estacion
        </label>
        <input
          ref={inputRef}
          id="station-file"
          type="file"
          accept=".json,application/json"
          onChange={handleInputChange}
          disabled={loading}
          title="Seleccionar archivo JSON de estacion"
          className="hidden"
        />

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-md bg-gradient-to-r from-blue-700 to-indigo-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-blue-600 hover:to-indigo-600 disabled:cursor-not-allowed disabled:opacity-70"
          >
            Seleccionar archivo
          </button>

          <span className="text-sm text-slate-600">Carga manual para validacion y homogenizacion inmediata.</span>

        {loading ? (
          <span className="rounded-md bg-amber-100 px-3 py-2 text-sm font-medium text-amber-800">
            Procesando...
          </span>
        ) : null}
        </div>
      </div>

      {error ? (
        <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {error}
        </p>
      ) : null}

      {success ? (
        <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {success}
        </p>
      ) : null}
    </section>
  );
}
