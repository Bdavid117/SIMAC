import { useState } from "react";

import { uploadData } from "../services/api";
import type { ProcessedStationData, RawStationData } from "../types";

interface FileUploadProps {
  onRawLoaded: (data: RawStationData[]) => void;
  onProcessedLoaded: (data: ProcessedStationData[]) => void;
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
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
      onProcessedLoaded(response.processed_data);
      onSaved(response.id);
      await onRefreshHistory();

      setSuccess(`Archivo procesado correctamente. Calculo #${response.id}`);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error ? caughtError.message : "No fue posible procesar el archivo";
      setError(message);
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-800">Cargar datos de estacion</h2>
      <p className="mt-1 text-sm text-slate-500">
        Sube un archivo JSON para ejecutar la homogenizacion cincominutal.
      </p>

      <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
        <label htmlFor="station-file" className="sr-only">
          Archivo JSON de estacion
        </label>
        <input
          id="station-file"
          type="file"
          accept=".json,application/json"
          onChange={handleFile}
          disabled={loading}
          title="Seleccionar archivo JSON de estacion"
          className="w-full cursor-pointer rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 file:mr-4 file:rounded-md file:border-0 file:bg-sky-600 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-sky-500 disabled:opacity-60"
        />
        {loading ? (
          <span className="rounded-md bg-amber-100 px-3 py-2 text-sm font-medium text-amber-800">
            Procesando...
          </span>
        ) : null}
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
