import { useMemo } from "react";

import type { ProcessedStationData, RawStationData, StationValue } from "../types";

interface DataTableProps {
  originalData: RawStationData[];
  processedData: ProcessedStationData[];
}

function isMissing(value: StationValue | undefined): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  return typeof value === "string" && value.trim().toUpperCase() === "ND";
}

function toNumber(value: StationValue | undefined): number | null {
  if (isMissing(value)) {
    return null;
  }
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function dateAndTimeFromRow(row: Record<string, StationValue | undefined>): Date | null {
  const fecha = (row.Fecha ?? row.fecha) as string | undefined;
  const hora = (row.Hora ?? row.hora) as string | undefined;
  if (!fecha || !hora) {
    return null;
  }

  const [day, month, year] = fecha.split("/").map(Number);
  const [hours, minutes, seconds] = hora.split(":").map(Number);
  if (
    !Number.isFinite(day) ||
    !Number.isFinite(month) ||
    !Number.isFinite(year) ||
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    !Number.isFinite(seconds)
  ) {
    return null;
  }

  return new Date(year, month - 1, day, hours, minutes, seconds);
}

function nearestOriginal(target: ProcessedStationData, originals: RawStationData[]): RawStationData | null {
  const targetDate = dateAndTimeFromRow(target);
  if (!targetDate) {
    return null;
  }

  let best: RawStationData | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const row of originals) {
    const rawDate = dateAndTimeFromRow(row);
    if (!rawDate) {
      continue;
    }
    const distance = Math.abs(targetDate.getTime() - rawDate.getTime());
    if (distance < bestDistance) {
      bestDistance = distance;
      best = row;
    }
  }

  return best;
}

function valueChanged(original: StationValue | undefined, processed: StationValue | undefined): boolean {
  const n1 = toNumber(original);
  const n2 = toNumber(processed);
  if (n1 !== null && n2 !== null) {
    return Math.abs(n1 - n2) > 0.01;
  }

  const o = isMissing(original) ? "ND" : String(original);
  const p = isMissing(processed) ? "ND" : String(processed);
  return o !== p;
}

function formatValue(value: StationValue | undefined): string {
  if (isMissing(value)) {
    return "ND";
  }
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(2);
  }
  return String(value);
}

function hourValue(row: Record<string, StationValue | undefined>): string {
  return String(row.Hora ?? row.hora ?? "--:--:--");
}

export default function DataTable({ originalData, processedData }: DataTableProps) {
  const measurementKeys = useMemo(() => {
    const ignored = new Set(["Fecha", "fecha", "Hora", "hora"]);
    const keys = new Set<string>();

    for (const row of [...originalData, ...processedData]) {
      Object.keys(row).forEach((key) => {
        if (!ignored.has(key)) {
          keys.add(key);
        }
      });
    }

    return Array.from(keys);
  }, [originalData, processedData]);

  const mergedRows = useMemo(() => {
    return processedData.map((processed) => {
      const original = nearestOriginal(processed, originalData);
      const changed = measurementKeys.some((key) => valueChanged(original?.[key], processed[key]));

      return {
        processed,
        original,
        changed,
      };
    });
  }, [measurementKeys, originalData, processedData]);

  if (!processedData.length) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800">Tabla comparativa</h2>
        <p className="mt-2 text-sm text-slate-500">No hay resultados para mostrar.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Dato Original vs Dato Cincominutal</h2>
        <span className="text-xs text-slate-500">Filas coloreadas segun cambios detectados</span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100 text-left text-slate-700">
              <th className="px-3 py-2">Fecha</th>
              <th className="px-3 py-2">Hora 5m</th>
              <th className="px-3 py-2">Hora original cercana</th>
              {measurementKeys.map((key) => (
                <th key={`${key}-original`} className="px-3 py-2">
                  {key} original
                </th>
              ))}
              {measurementKeys.map((key) => (
                <th key={`${key}-processed`} className="px-3 py-2">
                  {key} cincomin
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {mergedRows.map(({ processed, original, changed }, index) => (
              <tr
                key={`${processed.Fecha}-${processed.Hora}-${index}`}
                className={changed ? "bg-amber-50" : "bg-emerald-50"}
              >
                <td className="border-t border-slate-200 px-3 py-2">{processed.Fecha}</td>
                <td className="border-t border-slate-200 px-3 py-2">{processed.Hora}</td>
                <td className="border-t border-slate-200 px-3 py-2">{original ? hourValue(original) : "ND"}</td>
                {measurementKeys.map((key) => (
                  <td key={`${index}-${key}-o`} className="border-t border-slate-200 px-3 py-2">
                    {formatValue(original?.[key])}
                  </td>
                ))}
                {measurementKeys.map((key) => (
                  <td key={`${index}-${key}-p`} className="border-t border-slate-200 px-3 py-2 font-medium">
                    {formatValue(processed[key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
