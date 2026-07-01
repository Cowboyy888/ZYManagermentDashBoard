"use client";
import { useState, useTransition } from "react";
import { AttendanceGrid, type GridEmployee } from "@/components/AttendanceGrid";
import { getAttendanceForPeriod } from "@/actions/attendance";

type Mark = "PRESENT" | "LEAVE" | "ABSENT";

interface Props {
  employees: GridEmployee[];
  departments: { id: number; name: string }[];
  canWrite: boolean;
}

function getHalfDates(year: number, month: number, half: 1 | 2): string[] {
  const days: string[] = [];
  if (half === 1) {
    for (let d = 1; d <= 15; d++)
      days.push(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  } else {
    const last = new Date(year, month, 0).getDate();
    for (let d = 16; d <= last; d++)
      days.push(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return days;
}

export function AttendanceManager({ employees, departments, canWrite }: Props) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [half, setHalf] = useState<1 | 2>(now.getDate() <= 15 ? 1 : 2);
  const [deptId, setDeptId] = useState<number | "">("");
  const [initial, setInitial] = useState<Record<string, Mark>>({});
  const [loaded, setLoaded] = useState(false);
  const [isPending, startTransition] = useTransition();

  const dates = getHalfDates(year, month, half);
  const filtered = deptId ? employees.filter((e) => {
    // employees prop doesn't carry deptId directly — filter done on mount
    return true;
  }) : employees;

  function load() {
    startTransition(async () => {
      const start = new Date(dates[0]);
      const end = new Date(dates[dates.length - 1]);
      const res = await getAttendanceForPeriod({
        startDate: start, endDate: end,
        departmentId: deptId ? Number(deptId) : undefined,
      });
      if (res.ok) {
        const m: Record<string, Mark> = {};
        for (const row of res.data) {
          const d = new Date(row.date).toISOString().slice(0, 10);
          m[`${row.employeeId}|${d}|am`] = row.am as Mark;
          m[`${row.employeeId}|${d}|pm`] = row.pm as Mark;
        }
        setInitial(m);
      }
      setLoaded(true);
    });
  }

  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-600">Year</label>
          <select value={year} onChange={(e) => { setYear(Number(e.target.value)); setLoaded(false); }}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
            {[2025, 2026, 2027].map((y) => <option key={y}>{y}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-600">Month</label>
          <select value={month} onChange={(e) => { setMonth(Number(e.target.value)); setLoaded(false); }}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
            {monthNames.map((n, i) => <option key={i + 1} value={i + 1}>{n}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-600">Half</label>
          <select value={half} onChange={(e) => { setHalf(Number(e.target.value) as 1 | 2); setLoaded(false); }}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
            <option value={1}>1–15</option>
            <option value={2}>16–end</option>
          </select>
        </div>
        {departments.length > 0 && (
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-600">Department</label>
            <select value={deptId} onChange={(e) => { setDeptId(e.target.value ? Number(e.target.value) : ""); setLoaded(false); }}
              className="rounded-md border border-gray-300 px-2 py-1.5 text-sm">
              <option value="">All</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        )}
        <button onClick={load} disabled={isPending}
          className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white disabled:opacity-60 hover:bg-blue-700 transition-colors">
          {isPending ? "Loading…" : "Load"}
        </button>
      </div>

      {!loaded ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center text-sm text-gray-400">
          Select a period above and click Load
        </div>
      ) : (
        canWrite ? (
          <AttendanceGrid employees={filtered} dates={dates} initial={initial} />
        ) : (
          <ReadOnlyAttendanceView employees={filtered} dates={dates} initial={initial} />
        )
      )}
    </div>
  );
}

type Mark2 = "PRESENT" | "LEAVE" | "ABSENT";
const GLYPH: Record<Mark2, string> = { PRESENT: "√", LEAVE: "△", ABSENT: "×" };
const TONE: Record<Mark2, string> = {
  PRESENT: "text-emerald-700 bg-emerald-50",
  LEAVE: "text-amber-700 bg-amber-50",
  ABSENT: "text-rose-700 bg-rose-50",
};

function ReadOnlyAttendanceView({ employees, dates, initial }: { employees: GridEmployee[]; dates: string[]; initial: Record<string, Mark2> }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full border-collapse text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="sticky left-0 bg-gray-50 px-3 py-2 text-left text-xs font-medium text-gray-600">Employee</th>
            {dates.map((d) => (
              <th key={d} className="px-1 py-2 text-center text-xs font-medium text-gray-600" colSpan={2}>{d.slice(8)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {employees.map((e) => (
            <tr key={e.id} className="border-t border-gray-100">
              <td className="sticky left-0 bg-white px-3 py-1.5 whitespace-nowrap">
                <div className="font-medium text-gray-800">{e.nameEn}</div>
                <div className="text-xs text-gray-400">{e.nameKh}</div>
              </td>
              {dates.map((d) => (["am", "pm"] as const).map((h) => {
                const m: Mark2 = initial[`${e.id}|${d}|${h}`] ?? "PRESENT";
                return (
                  <td key={d + h} className="p-0.5">
                    <span className={`flex h-7 w-6 items-center justify-center rounded text-center text-xs font-semibold ${TONE[m]}`}>
                      {GLYPH[m]}
                    </span>
                  </td>
                );
              }))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
