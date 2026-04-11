import type { ProcessedStationData, QualityMetrics } from "../types";

type JsPdfDoc = import("jspdf").jsPDF;

function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }

  return text;
}

function downloadCsv(filename: string, rows: string[]): void {
  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportProcessedDataCsv(data: ProcessedStationData[], calculationId: number | null): void {
  if (!data.length) {
    return;
  }

  const headers = Object.keys(data[0]);
  const rows = [headers.join(",")];

  for (const row of data) {
    rows.push(headers.map((key) => escapeCsvValue(row[key])).join(","));
  }

  const suffix = calculationId ? `calculo-${calculationId}` : "resultado";
  downloadCsv(`simac-${suffix}-procesado.csv`, rows);
}

export function exportQualityMetricsCsv(metrics: QualityMetrics, calculationId: number | null): void {
  const rows = ["variable,total_points,original_count,interpolated_count,carried_count,missing_count,coverage_pct"];

  for (const [variable, details] of Object.entries(metrics.per_variable)) {
    rows.push(
      [
        variable,
        details.total_points,
        details.original_count,
        details.interpolated_count,
        details.carried_count,
        details.missing_count,
        details.coverage_pct,
      ]
        .map((value) => escapeCsvValue(value))
        .join(","),
    );
  }

  const suffix = calculationId ? `calculo-${calculationId}` : "calidad";
  downloadCsv(`simac-${suffix}-calidad.csv`, rows);
}

function ensurePage(doc: JsPdfDoc, currentY: number, requiredHeight = 20): number {
  const pageHeight = doc.internal.pageSize.getHeight();
  if (currentY + requiredHeight <= pageHeight - 30) {
    return currentY;
  }

  doc.addPage();
  return 40;
}

export async function exportQualityReportPdf(
  data: ProcessedStationData[],
  metrics: QualityMetrics,
  calculationId: number | null,
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = 42;
  const lineHeight = 16;
  const suffix = calculationId ? `calculo-${calculationId}` : "resumen";

  doc.setFontSize(16);
  doc.text("SIMAC - Reporte de calidad", 40, y);
  y += 24;

  doc.setFontSize(11);
  doc.text(`Calculo: ${calculationId ?? "N/A"}`, 40, y);
  y += lineHeight;
  doc.text(`Generado: ${new Date().toLocaleString()}`, 40, y);
  y += lineHeight;
  doc.text(`Algoritmo: ${metrics.algorithm_version}`, 40, y);
  y += lineHeight;
  doc.text(`Registros procesados: ${metrics.total_records}`, 40, y);
  y += lineHeight;
  doc.text(`Cobertura global: ${metrics.coverage_pct.toFixed(2)}%`, 40, y);
  y += lineHeight;
  doc.text(`Interpolados: ${metrics.interpolated_cells}`, 40, y);
  y += lineHeight;
  doc.text(`Arrastre cercano: ${metrics.carried_cells}`, 40, y);
  y += lineHeight;
  doc.text(`Faltantes: ${metrics.missing_cells}`, 40, y);
  y += lineHeight;
  doc.text(`Duracion: ${metrics.processing_duration_ms} ms`, 40, y);
  y += 24;

  doc.setFontSize(12);
  doc.text("Detalle por variable", 40, y);
  y += 18;
  doc.setFontSize(10);
  doc.text("Variable", 40, y);
  doc.text("Cobertura", 180, y);
  doc.text("Original", 270, y);
  doc.text("Interpolado", 340, y);
  doc.text("Arrastre", 430, y);
  doc.text("Faltante", 500, y);
  y += 12;

  for (const [variable, details] of Object.entries(metrics.per_variable)) {
    y = ensurePage(doc, y, lineHeight);
    doc.text(variable, 40, y);
    doc.text(`${details.coverage_pct.toFixed(2)}%`, 180, y);
    doc.text(String(details.original_count), 270, y);
    doc.text(String(details.interpolated_count), 340, y);
    doc.text(String(details.carried_count), 430, y);
    doc.text(String(details.missing_count), 500, y);
    y += lineHeight;
  }

  y = ensurePage(doc, y, 30);
  y += 10;
  doc.setFontSize(12);
  doc.text("Muestra de datos procesados", 40, y);
  y += 18;

  if (!data.length) {
    doc.setFontSize(10);
    doc.text("No hay datos procesados para mostrar.", 40, y);
  } else {
    const allHeaders = Object.keys(data[0]);
    const headers = allHeaders.slice(0, Math.min(6, allHeaders.length));
    const columnsX = [40, 125, 220, 315, 410, 505];

    doc.setFontSize(9);
    headers.forEach((header, idx) => {
      doc.text(header, columnsX[idx], y);
    });
    y += 12;

    for (const row of data.slice(0, 15)) {
      y = ensurePage(doc, y, lineHeight);
      headers.forEach((header, idx) => {
        const raw = row[header];
        const value = raw === null || raw === undefined ? "" : String(raw);
        const trimmed = value.length > 14 ? `${value.slice(0, 14)}...` : value;
        doc.text(trimmed, columnsX[idx], y);
      });
      y += lineHeight;
    }
  }

  doc.save(`simac-${suffix}-calidad.pdf`);
}
