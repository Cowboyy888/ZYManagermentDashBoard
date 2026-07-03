// Client-side export utilities — import dynamically to avoid SSR issues

export type ExportColumn = { header: string; key: string; width?: number };

export async function exportToExcel(data: Record<string, unknown>[], columns: ExportColumn[], filename: string): Promise<void> {
  const XLSX = await import("xlsx");
  const rows = data.map((row) => {
    const out: Record<string, unknown> = {};
    for (const col of columns) {
      out[col.header] = row[col.key] ?? "";
    }
    return out;
  });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  // Column widths
  ws["!cols"] = columns.map((c) => ({ wch: c.width ?? 18 }));

  XLSX.utils.book_append_sheet(wb, ws, "Data");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

export async function exportToPDF(
  title: string,
  subtitle: string,
  data: Record<string, unknown>[],
  columns: ExportColumn[],
  filename: string,
): Promise<void> {
  // Dynamic import to avoid SSR
  const { default: jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });

  // Header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, 18);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(120);
  doc.text(subtitle, 14, 25);
  doc.text(`Exported ${new Date().toLocaleString("en-GB")}`, 14, 30);
  doc.setTextColor(0);

  const head = [columns.map((c) => c.header)];
  const body = data.map((row) => columns.map((c) => String(row[c.key] ?? "")));

  autoTable(doc, {
    head,
    body,
    startY: 35,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [22, 78, 146], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 249, 252] },
    margin: { left: 14, right: 14 },
  });

  doc.save(`${filename}.pdf`);
}
