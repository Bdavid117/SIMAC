import { useCallback, useEffect, useState } from "react";

import DataTable from "./components/DataTable";
import FileUpload from "./components/FileUpload";
import TempChart from "./components/TempChart";
import { fetchHistory } from "./services/api";
import type { HistoryItem, ProcessedStationData, RawStationData } from "./types";

function countMissingValues(rows: ProcessedStationData[]): number {
  const ignored = new Set(["Fecha", "Hora", "fecha", "hora"]);
  let missing = 0;

  for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      if (ignored.has(key)) {
        continue;
      }

      if (value === null || value === undefined) {
        missing += 1;
        continue;
      }

      if (typeof value === "string" && value.trim().toUpperCase() === "ND") {
        missing += 1;
      }
    }
  }

  return missing;
}

function App() {
  const [rawData, setRawData] = useState<RawStationData[]>([]);
  const [processedData, setProcessedData] = useState<ProcessedStationData[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [lastCalculationId, setLastCalculationId] = useState<number | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const ndCount = countMissingValues(processedData);

  const successRate = processedData.length
    ? Math.max(0, ((processedData.length - Math.min(ndCount, processedData.length)) / processedData.length) * 100)
    : 0;

  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const rows = await fetchHistory();
      setHistory(rows);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No fue posible consultar el historial";
      setHistoryError(message);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_20%_0%,#dbeafe_0%,#eff6ff_35%,#f8fafc_100%)] font-sans text-slate-900">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-8">
        <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0c1a4b] via-[#1a237e] to-[#24378f] p-6 text-white shadow-[0_20px_60px_-30px_rgba(15,23,42,0.65)] md:p-8">
          <div className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/10 blur-2xl" aria-hidden="true" />
          <div className="absolute -bottom-16 left-12 h-40 w-40 rounded-full bg-blue-300/20 blur-2xl" aria-hidden="true" />

          <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-serif text-2xl font-semibold tracking-tight md:text-4xl">
                Sistema de Homogenizacion Climatica
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-100/90 md:text-base">
                Laboratorio de analisis atmosferico para transformar datos no cincominutales con trazabilidad.
              </p>
            </div>

            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-300/20 px-3 py-1.5 text-xs font-semibold text-emerald-100 ring-1 ring-emerald-200/40">
              <span className="h-2 w-2 rounded-full bg-emerald-300" aria-hidden="true" />
              En linea
            </span>
          </div>

          <p className="mt-3 text-sm text-sky-100 md:text-base">
            Carga datos meteorologicos no cincominutales, ejecuta interpolacion y visualiza resultados.
          </p>
          {lastCalculationId !== null ? (
            <p className="mt-3 inline-block rounded-md bg-white/20 px-3 py-1 text-sm font-medium backdrop-blur">
              Ultimo calculo generado: #{lastCalculationId}
            </p>
          ) : null}
        </header>

        <section className="grid gap-3 md:grid-cols-3">
          <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Registros cargados</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{rawData.length.toLocaleString()}</p>
          </article>

          <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Registros procesados</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{processedData.length.toLocaleString()}</p>
            <p className="mt-1 text-xs text-emerald-700">Cobertura estimada: {successRate.toFixed(1)}%</p>
          </article>

          <article className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/70">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Valores faltantes (ND)</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{ndCount.toLocaleString()}</p>
          </article>
        </section>

        <FileUpload
          onRawLoaded={setRawData}
          onProcessedLoaded={setProcessedData}
          onSaved={setLastCalculationId}
          onRefreshHistory={refreshHistory}
        />

        <TempChart processedData={processedData} />

        <DataTable originalData={rawData} processedData={processedData} />

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-xl font-semibold text-slate-800">Historial de calculos</h2>
            {historyLoading ? <span className="text-xs text-slate-500">Actualizando...</span> : null}
          </div>

          {historyError ? (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {historyError}
            </p>
          ) : null}

          {!historyError && !history.length ? (
            <p className="text-sm text-slate-500">No hay calculos registrados aun.</p>
          ) : null}

          {!!history.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 text-left text-slate-700">
                    <th className="px-3 py-2">ID</th>
                    <th className="px-3 py-2">Fecha</th>
                    <th className="px-3 py-2">Registros crudos</th>
                    <th className="px-3 py-2">Registros procesados</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((item) => (
                    <tr key={item.id} className="border-t border-slate-200">
                      <td className="px-3 py-2 font-medium text-slate-800">#{item.id}</td>
                      <td className="px-3 py-2 text-slate-600">{new Date(item.created_at).toLocaleString()}</td>
                      <td className="px-3 py-2 text-slate-600">{item.raw_data.length}</td>
                      <td className="px-3 py-2 text-slate-600">{item.processed_data.length}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}

export default App;
