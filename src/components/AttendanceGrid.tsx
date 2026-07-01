"use client";
// ZYSTEEL HR — Attendance Grid (the factory's √/△/× model, arch §3.3).
// Click a half-cell to cycle PRESENT → LEAVE → ABSENT. Mirrors the spreadsheet
// the staff already know, so adoption is frictionless.

import { useState, useMemo, useCallback } from "react";
import { saveAttendance } from "@/actions/attendance";

type Mark = "PRESENT" | "LEAVE" | "ABSENT";
const CYCLE: Record<Mark, Mark> = { PRESENT: "LEAVE", LEAVE: "ABSENT", ABSENT: "PRESENT" };
const GLYPH: Record<Mark, string> = { PRESENT: "√", LEAVE: "△", ABSENT: "×" };
const TONE: Record<Mark, string> = {
  PRESENT: "text-emerald-700 bg-emerald-50 hover:bg-emerald-100",
  LEAVE: "text-amber-700 bg-amber-50 hover:bg-amber-100",
  ABSENT: "text-rose-700 bg-rose-50 hover:bg-rose-100",
};

export interface GridEmployee { id: number; nameEn: string; nameKh: string; nameZh?: string | null; }
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
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span><span className="text-emerald-700 font-semibold">√</span> Present</span>
          <span><span className="text-amber-700 font-semibold">△</span> Leave</span>
          <span><span className="text-rose-700 font-semibold">×</span> Absent</span>
        </div>
        <button onClick={onSave} disabled={saving}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {saving ? "Saving…" : "Save attendance"}
        </button>
      </div>
      {msg && <p className="text-sm" role="status">{msg}</p>}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-zinc-50">
            <tr>
              <th className="sticky left-0 z-10 bg-zinc-50 px-3 py-2 text-left font-medium">Employee</th>
              {dates.map((d) => (
                <th key={d} className="px-1 py-2 text-center font-medium" colSpan={2}>{d.slice(8)}</th>
              ))}
              <th className="px-3 py-2 text-center font-medium">√/△/×</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="sticky left-0 z-10 bg-white px-3 py-1.5 whitespace-nowrap">
                  <div className="font-medium">{e.nameEn}</div>
                  <div className="text-xs text-muted-foreground">{e.nameKh}{e.nameZh ? ` · ${e.nameZh}` : ""}</div>
                </td>
                {dates.map((d) => (["am", "pm"] as const).map((h) => {
                  const m = marks[key(e.id, d, h)];
                  return (
                    <td key={d + h} className="p-0.5">
                      <button onClick={() => cycle(e.id, d, h)} title={`${d} ${h.toUpperCase()}`}
                        className={`h-7 w-6 rounded text-center font-semibold transition-colors ${TONE[m]}`}>
                        {GLYPH[m]}
                      </button>
                    </td>
                  );
                }))}
                <td className="px-3 py-1.5 text-center text-xs whitespace-nowrap">
                  <span className="text-emerald-700">{totals[e.id].p}</span>/
                  <span className="text-amber-700">{totals[e.id].l}</span>/
                  <span className="text-rose-700">{totals[e.id].a}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
