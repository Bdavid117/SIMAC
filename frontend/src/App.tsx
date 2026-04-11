import { useCallback, useEffect, useState } from "react";

import DataTable from "./components/DataTable";
import FileUpload from "./components/FileUpload";
import TempChart from "./components/TempChart";
import { exportProcessedDataCsv, exportQualityMetricsCsv, exportQualityReportPdf } from "./services/exportCsv";
import { fetchHistory } from "./services/api";
import type { HistoryItem, ProcessedStationData, QualityMetrics, RawStationData } from "./types";

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
  const HISTORY_PAGE_SIZE = 10;
  const [rawData, setRawData] = useState<RawStationData[]>([]);
  const [processedData, setProcessedData] = useState<ProcessedStationData[]>([]);
  const [qualityMetrics, setQualityMetrics] = useState<QualityMetrics | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [lastCalculationId, setLastCalculationId] = useState<number | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const ndCount = qualityMetrics?.missing_cells ?? countMissingValues(processedData);

  const fallbackSuccessRate = processedData.length
    ? Math.max(0, ((processedData.length - Math.min(ndCount, processedData.length)) / processedData.length) * 100)
    : 0;
  const successRate = qualityMetrics?.coverage_pct ?? fallbackSuccessRate;

  const refreshHistory = useCallback(async (targetPage?: number) => {
    const pageToLoad = targetPage ?? historyPage;
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const response = await fetchHistory(pageToLoad, HISTORY_PAGE_SIZE);
      setHistory(response.items);
      setHistoryTotal(response.total);
      setHistoryPage(response.page);
    } catch (error) {
      const message = error instanceof Error ? error.message : "No fue posible consultar el historial";
      setHistoryError(message);
    } finally {
      setHistoryLoading(false);
    }
  }, [historyPage]);

  useEffect(() => {
    void refreshHistory();
  }, [historyPage, refreshHistory]);

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
          onProcessedLoaded={(data, metrics) => {
            setProcessedData(data);
            setQualityMetrics(metrics);
          }}
          onSaved={(id) => {
            setLastCalculationId(id);
            setHistoryPage(1);
          }}
          onRefreshHistory={() => refreshHistory(1)}
        />

        {qualityMetrics ? (
          <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-serif text-xl font-semibold text-slate-800">Trazabilidad de calidad</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Cobertura global y detalle por variable del ultimo procesamiento.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => exportProcessedDataCsv(processedData, lastCalculationId)}
                  className="rounded-md bg-blue-700 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-600"
                >
                  Exportar procesado (CSV)
                </button>
                <button
                  type="button"
                  onClick={() => exportQualityMetricsCsv(qualityMetrics, lastCalculationId)}
                  className="rounded-md bg-slate-800 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-700"
                >
                  Exportar calidad (CSV)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void exportQualityReportPdf(processedData, qualityMetrics, lastCalculationId);
                  }}
                  className="rounded-md bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-600"
                >
                  Exportar reporte (PDF)
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <article className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cobertura global</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{qualityMetrics.coverage_pct.toFixed(2)}%</p>
              </article>
              <article className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Interpolados</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{qualityMetrics.interpolated_cells}</p>
              </article>
              <article className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Arrastre cercano</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{qualityMetrics.carried_cells}</p>
              </article>
              <article className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Duracion</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{qualityMetrics.processing_duration_ms} ms</p>
              </article>
            </div>

            <div className="mt-4 overflow-x-auto rounded-xl ring-1 ring-slate-200">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="bg-slate-100 text-left text-slate-700">
                    <th className="px-3 py-2">Variable</th>
                    <th className="px-3 py-2">Cobertura</th>
                    <th className="px-3 py-2">Original</th>
                    <th className="px-3 py-2">Interpolado</th>
                    <th className="px-3 py-2">Arrastre</th>
                    <th className="px-3 py-2">Faltante</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(qualityMetrics.per_variable).map(([variable, metric]) => (
                    <tr key={variable} className="border-t border-slate-200">
                      <td className="px-3 py-2 font-medium text-slate-800">{variable}</td>
                      <td className="px-3 py-2 text-slate-600">{metric.coverage_pct.toFixed(2)}%</td>
                      <td className="px-3 py-2 text-slate-600">{metric.original_count}</td>
                      <td className="px-3 py-2 text-slate-600">{metric.interpolated_count}</td>
                      <td className="px-3 py-2 text-slate-600">{metric.carried_count}</td>
                      <td className="px-3 py-2 text-slate-600">{metric.missing_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        <TempChart processedData={processedData} />

        <DataTable originalData={rawData} processedData={processedData} />

        <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/70">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-serif text-xl font-semibold text-slate-800">Historial de calculos</h2>
            <div className="flex items-center gap-2">
              {historyLoading ? <span className="text-xs text-slate-500">Actualizando...</span> : null}
              <span className="text-xs text-slate-500">Total: {historyTotal}</span>
            </div>
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
            <div className="space-y-3">
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

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-500">
                  Mostrando pagina {historyPage} de {Math.max(1, Math.ceil(historyTotal / HISTORY_PAGE_SIZE))}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setHistoryPage((prev) => Math.max(1, prev - 1))}
                    disabled={historyPage <= 1 || historyLoading}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryPage((prev) => prev + 1)}
                    disabled={historyLoading || historyPage >= Math.ceil(historyTotal / HISTORY_PAGE_SIZE)}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}

export default App;
