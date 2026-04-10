import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { useMemo } from "react";
import { Line } from "react-chartjs-2";

import type { ProcessedStationData, StationValue } from "../types";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler);

interface TempChartProps {
  processedData: ProcessedStationData[];
}

function isMissing(value: StationValue | undefined): boolean {
  if (value === null || value === undefined) {
    return true;
  }
  return typeof value === "string" && value.trim().toUpperCase() === "ND";
}

function toChartValue(value: StationValue | undefined): number | null {
  // TODO: manejar ND
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

function detectTemperatureKey(rows: ProcessedStationData[]): string | null {
  if (!rows.length) {
    return null;
  }

  const candidates = Object.keys(rows[0]).filter((key) => {
    const lower = key.toLowerCase();
    return lower.includes("temp") || lower.includes("temperatura");
  });

  return candidates.length ? candidates[0] : null;
}

export default function TempChart({ processedData }: TempChartProps) {
  const temperatureKey = useMemo(() => detectTemperatureKey(processedData), [processedData]);

  if (!processedData.length || !temperatureKey) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800">Curva de temperatura interpolada</h2>
        <p className="mt-2 text-sm text-slate-500">
          Carga datos validos que contengan una variable de temperatura para visualizar la grafica.
        </p>
      </section>
    );
  }

  const labels = processedData.map((row) => row.Hora);
  const chartValues = processedData.map((row) => toChartValue(row[temperatureKey]));

  const data = {
    labels,
    datasets: [
      {
        label: `${temperatureKey} cincominutal`,
        data: chartValues,
        borderColor: "rgb(2, 132, 199)",
        backgroundColor: "rgba(2, 132, 199, 0.18)",
        pointRadius: 3,
        tension: 0.2,
        spanGaps: false,
        fill: true,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
      },
      tooltip: {
        mode: "index" as const,
        intersect: false,
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: "Hora",
        },
      },
      y: {
        title: {
          display: true,
          text: "Temperatura",
        },
      },
    },
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-800">Curva de temperatura interpolada</h2>
      <p className="mt-1 text-sm text-slate-500">
        Datos ND se representan como cortes en la curva para mantener la trazabilidad.
      </p>
      <div className="mt-4 h-80 w-full">
        <Line options={options} data={data} />
      </div>
    </section>
  );
}
