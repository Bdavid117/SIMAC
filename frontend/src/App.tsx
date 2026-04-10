import { useCallback, useEffect, useState } from "react";

import DataTable from "./components/DataTable";
import FileUpload from "./components/FileUpload";
import TempChart from "./components/TempChart";
import { fetchHistory } from "./services/api";
import type { HistoryItem, ProcessedStationData, RawStationData } from "./types";

function App() {
  const [rawData, setRawData] = useState<RawStationData[]>([]);
  const [processedData, setProcessedData] = useState<ProcessedStationData[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [lastCalculationId, setLastCalculationId] = useState<number | null>(null);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

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
    <div className="min-h-screen bg-slate-100">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 md:px-8">
        <header className="rounded-2xl bg-gradient-to-r from-cyan-700 to-sky-900 p-6 text-white shadow-lg">
          <h1 className="text-2xl font-bold md:text-3xl">Sistema de Homogenizacion Climatica</h1>
          <p className="mt-2 text-sm text-sky-100 md:text-base">
            Carga datos meteorologicos no cincominutales, ejecuta interpolacion y visualiza resultados.
          </p>
          {lastCalculationId !== null ? (
            <p className="mt-3 inline-block rounded-md bg-white/20 px-3 py-1 text-sm font-medium">
              Ultimo calculo generado: #{lastCalculationId}
            </p>
          ) : null}
        </header>

        <FileUpload
          onRawLoaded={setRawData}
          onProcessedLoaded={setProcessedData}
          onSaved={setLastCalculationId}
          onRefreshHistory={refreshHistory}
        />

        <TempChart processedData={processedData} />

        <DataTable originalData={rawData} processedData={processedData} />

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Historial de calculos</h2>
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
