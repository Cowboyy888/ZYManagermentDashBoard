"use client";
// ZYSTEEL HR — Attendance Grid (the factory's √/△/× model, arch §3.3).
// Click a half-cell to cycle PRESENT → LEAVE → ABSENT. Mirrors the spreadsheet
// the staff already know, so adoption is frictionless.

import { useState, useMemo, useCallback } from "react";
import { saveAttendance } from "@/actions/attendance";

type Mark = "PRESENT" | "LEAVE" | "ABSENT";
const CYCLE: Record<Mark, Mark> = { PRESENT: "LEAVE", LEAVE: "ABSENT", ABSENT: "PRESENT" };
const GLYPH: Record<Mark, string> = { PRESENT: "√", LEAVE: "△", ABSENT: "×" };
const TONE: Record<Mark, React.CSSProperties> = {
  PRESENT: { color: "var(--green)", background: "var(--green-bg)" },
  LEAVE:   { color: "var(--amber)", background: "var(--amber-bg)" },
  ABSENT:  { color: "var(--red)",   background: "var(--red-bg)" },
};

export interface GridEmployee {
  id: number; nameEn: string; nameKh: string; nameZh?: string | null;
  departmentId?: number | null; positionId?: number | null; photoUrl?: string | null;
}
interface Props { employees: GridEmployee[]; dates: string[]; initial?: Record<string, Mark>; }

const key = (e: number, d: string, h: "am" | "pm") => `${e}|${d}|${h}`;

export function AttendanceGrid({ employees, dates, initial = {} }: Props) {
  const [marks, setMarks] = useState<Record<string, Mark>>(() => {
    const m: Record<string, Mark> = {};
    for (const e of employees) for (const d of dates) {
      m[key(e.id, d, "am")] = initial[key(e.id, d, "am")] ?? "PRESENT";
      m[key(e.id, d, "pm")] = initial[key(e.id, d, "pm")] ?? "PRESENT";
    }
    return m;
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const cycle = useCallback((e: number, d: string, h: "am" | "pm") => {
    setMarks((prev) => ({ ...prev, [key(e, d, h)]: CYCLE[prev[key(e, d, h)]] }));
  }, []);

  const totals = useMemo(() => {
    const t: Record<number, { p: number; l: number; a: number }> = {};
    for (const e of employees) {
      let p = 0, l = 0, a = 0;
      for (const d of dates) for (const h of ["am", "pm"] as const) {
        const m = marks[key(e.id, d, h)];
        if (m === "PRESENT") p += 0.5; else if (m === "LEAVE") l += 0.5; else a += 0.5;
      }
      t[e.id] = { p, l, a };
    }
    return t;
  }, [marks, employees, dates]);

  async function onSave() {
    setSaving(true); setMsg(null);
    const rows = employees.flatMap((e) =>
      dates.map((d) => ({ employeeId: e.id, date: d, am: marks[key(e.id, d, "am")], pm: marks[key(e.id, d, "pm")] }))
    );
    const res = await saveAttendance({ rows });
    setMsg(res.ok ? `Saved ${res.data.count} day records.` : ('error' in res ? res.error : "Error"));
    setSaving(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 16, fontSize: 13, color: "var(--text-2)" }}>
          <span><span style={{ color: "var(--green)", fontWeight: 700 }}>√</span> Present</span>
          <span><span style={{ color: "var(--amber)", fontWeight: 700 }}>△</span> Leave</span>
          <span><span style={{ color: "var(--red)", fontWeight: 700 }}>×</span> Absent</span>
        </div>
        <button onClick={onSave} disabled={saving} className="btn btn-primary">
          {saving ? <><span className="spinner" />Saving…</> : "Save attendance"}
        </button>
      </div>
      {msg && <p style={{ fontSize: 13, color: "var(--text-2)" }} role="status">{msg}</p>}
      <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--border)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead style={{ position: "sticky", top: 0, background: "var(--surface-2)" }}>
            <tr>
              <th style={{
                position: "sticky", left: 0, zIndex: 10, background: "var(--surface-2)",
                padding: "8px 12px", textAlign: "left", fontWeight: 600,
                borderBottom: "1px solid var(--border)", whiteSpace: "nowrap",
              }}>
                Employee
              </th>
              {dates.map((d) => (
                <th key={d} colSpan={2} style={{
                  padding: "8px 4px", textAlign: "center", fontWeight: 600,
                  borderBottom: "1px solid var(--border)",
                }}>
                  {d.slice(8)}
                </th>
              ))}
              <th style={{
                padding: "8px 12px", textAlign: "center", fontWeight: 600,
                borderBottom: "1px solid var(--border)",
              }}>
                √/△/×
              </th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{
                  position: "sticky", left: 0, zIndex: 10, background: "var(--surface)",
                  padding: "6px 12px", whiteSpace: "nowrap",
                }}>
                  <div style={{ fontWeight: 500 }}>{e.nameEn}</div>
                  <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                    {e.nameKh}{e.nameZh ? ` · ${e.nameZh}` : ""}
                  </div>
                </td>
                {dates.map((d) => (["am", "pm"] as const).map((h) => {
                  const m = marks[key(e.id, d, h)];
                  return (
                    <td key={d + h} style={{ padding: 2 }}>
                      <button
                        onClick={() => cycle(e.id, d, h)}
                        title={`${d} ${h.toUpperCase()}`}
                        className="mark-btn"
                        style={{
                          width: 24, height: 28, borderRadius: 4,
                          border: "none", cursor: "pointer",
                          fontSize: 12, fontWeight: 700,
                          transition: "filter 0.1s",
                          ...TONE[m],
                        }}>
                        {GLYPH[m]}
                      </button>
                    </td>
                  );
                }))}
                <td style={{ padding: "6px 12px", textAlign: "center", fontSize: 12, whiteSpace: "nowrap" }}>
                  <span style={{ color: "var(--green)" }}>{totals[e.id].p}</span>/
                  <span style={{ color: "var(--amber)" }}>{totals[e.id].l}</span>/
                  <span style={{ color: "var(--red)" }}>{totals[e.id].a}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <style jsx>{`
        .mark-btn:hover { filter: brightness(0.92); }
      `}</style>
    </div>
  );
}
