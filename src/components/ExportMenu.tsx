"use client";
import { useState } from "react";
import type { ExportColumn } from "@/lib/export";

interface Props {
  data: Record<string, unknown>[];
  columns: ExportColumn[];
  filename: string;
  title: string;
  subtitle?: string;
}

export function ExportMenu({ data, columns, filename, title, subtitle = "" }: Props) {
  const [loading, setLoading] = useState<"pdf" | "excel" | null>(null);
  const [open, setOpen] = useState(false);

  async function handleExport(type: "pdf" | "excel") {
    setLoading(type);
    setOpen(false);
    try {
      const { exportToExcel, exportToPDF } = await import("@/lib/export");
      if (type === "excel") {
        await exportToExcel(data, columns, filename);
      } else {
        await exportToPDF(title, subtitle, data, columns, filename);
      }
    } catch (e) {
      console.error("Export failed:", e);
      alert("Export failed. See console for details.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        className="btn"
        onClick={() => setOpen((v) => !v)}
        disabled={loading !== null || data.length === 0}
        style={{ gap: 6, display: "flex", alignItems: "center" }}
      >
        {loading ? <span className="spinner" /> : "↓"}
        {loading ? `Exporting…` : "Export"}
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 50, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", minWidth: 160, overflow: "hidden" }}>
            <button onClick={() => handleExport("excel")} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 16px", border: "none", background: "none", cursor: "pointer", fontSize: 13, color: "var(--text)", fontWeight: 500, textAlign: "left" }}>
              <span style={{ fontSize: 16 }}>📊</span> Excel (.xlsx)
            </button>
            <div style={{ height: 1, background: "var(--border)", margin: "0 10px" }} />
            <button onClick={() => handleExport("pdf")} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 16px", border: "none", background: "none", cursor: "pointer", fontSize: 13, color: "var(--text)", fontWeight: 500, textAlign: "left" }}>
              <span style={{ fontSize: 16 }}>📄</span> PDF (.pdf)
            </button>
          </div>
        </>
      )}
    </div>
  );
}
