"use client";
import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AttendanceGrid, type GridEmployee } from "@/components/AttendanceGrid";
import { getAttendancePeriodFull, deleteAttendanceRecord } from "@/actions/attendance";

type Mark = "PRESENT" | "LEAVE" | "ABSENT";
type ViewTab = "grid" | "summary" | "departments";

const GLYPH: Record<Mark, string> = { PRESENT: "√", LEAVE: "△", ABSENT: "×" };
const TONE: Record<Mark, { color: string; bg: string }> = {
  PRESENT: { color: "var(--green)", bg: "var(--green-bg)" },
  LEAVE:   { color: "var(--amber)", bg: "var(--amber-bg)" },
  ABSENT:  { color: "var(--red)",   bg: "var(--red-bg)"   },
};

interface Props {
  employees: GridEmployee[];
  departments: { id: number; name: string }[];
  positions:   { id: number; name: string; level: number }[];
  canWrite: boolean;
}

// ── Period helpers ─────────────────────────────────────────────────────────────

function getHalfDates(year: number, month: number, half: 1 | 2): string[] {
  const days: string[] = [];
  const pad = (n: number) => String(n).padStart(2, "0");
  if (half === 1) {
    for (let d = 1; d <= 15; d++) days.push(`${year}-${pad(month)}-${pad(d)}`);
  } else {
    const last = new Date(year, month, 0).getDate();
    for (let d = 16; d <= last; d++) days.push(`${year}-${pad(month)}-${pad(d)}`);
  }
  return days;
}

// ── Stats computation (from loaded marks snapshot) ─────────────────────────────

function computePeriodStats(employees: GridEmployee[], marks: Record<string, Mark>, dates: string[]) {
  let totalSlots = 0, presentSlots = 0, leaveSlots = 0, absentSlots = 0;
  for (const e of employees) {
    for (const d of dates) {
      for (const h of ["am", "pm"] as const) {
        const m = marks[`${e.id}|${d}|${h}`];
        if (!m) continue;
        totalSlots++;
        if (m === "PRESENT") presentSlots++;
        else if (m === "LEAVE") leaveSlots++;
        else absentSlots++;
      }
    }
  }
  return {
    totalEmployees: employees.length,
    presentDays: presentSlots / 2,
    leaveDays:   leaveSlots / 2,
    absentDays:  absentSlots / 2,
    rate: totalSlots > 0 ? Math.round((presentSlots / totalSlots) * 100) : null,
  };
}

type EmpSummary = {
  employee: GridEmployee;
  present: number; leave: number; absent: number; total: number;
  rate: number | null; hasData: boolean;
};

function computeEmpSummaries(employees: GridEmployee[], marks: Record<string, Mark>, dates: string[]): EmpSummary[] {
  return employees.map(e => {
    let present = 0, leave = 0, absent = 0, slots = 0;
    for (const d of dates) {
      for (const h of ["am", "pm"] as const) {
        const m = marks[`${e.id}|${d}|${h}`];
        if (!m) continue;
        slots++;
        if (m === "PRESENT") present++;
        else if (m === "LEAVE") leave++;
        else absent++;
      }
    }
    const total = present + leave + absent;
    return {
      employee: e,
      present: present / 2, leave: leave / 2, absent: absent / 2, total: total / 2,
      rate: total > 0 ? Math.round((present / total) * 100) : null,
      hasData: slots > 0,
    };
  });
}

type DeptSummary = {
  id: number; name: string;
  empCount: number; empWithData: number;
  totalPresent: number; totalLeave: number; totalAbsent: number;
  avgRate: number | null;
};

function computeDeptSummaries(
  employees: GridEmployee[],
  departments: { id: number; name: string }[],
  marks: Record<string, Mark>,
  dates: string[],
): DeptSummary[] {
  const empSums = computeEmpSummaries(employees, marks, dates);
  return departments
    .map(d => {
      const dEmps = empSums.filter(s => s.employee.departmentId === d.id);
      if (dEmps.length === 0) return null;
      const withData = dEmps.filter(s => s.hasData);
      return {
        id: d.id, name: d.name,
        empCount: dEmps.length,
        empWithData: withData.length,
        totalPresent: dEmps.reduce((s, e) => s + e.present, 0),
        totalLeave:   dEmps.reduce((s, e) => s + e.leave, 0),
        totalAbsent:  dEmps.reduce((s, e) => s + e.absent, 0),
        avgRate: withData.length > 0
          ? Math.round(withData.reduce((s, e) => s + (e.rate ?? 0), 0) / withData.length)
          : null,
      };
    })
    .filter((d): d is DeptSummary => d !== null);
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const selectStyle: React.CSSProperties = {
  height: 34, padding: "0 8px",
  border: "1px solid var(--border)", borderRadius: "var(--radius)",
  background: "var(--surface)", color: "var(--text)", fontSize: 13,
};

// ── Main component ─────────────────────────────────────────────────────────────

export function AttendanceManager({ employees, departments, positions, canWrite }: Props) {
  const router = useRouter();
  const now = new Date();
  const [year,  setYear]  = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [half,  setHalf]  = useState<1 | 2>(now.getDate() <= 15 ? 1 : 2);
  const [deptId, setDeptId] = useState<number | "">("");

  const [marks,  setMarks]  = useState<Record<string, Mark>>({});
  const [loaded, setLoaded] = useState(false);
  const [loadErr, setLoadErr] = useState("");
  const [isPending, startTransition] = useTransition();

  const [activeTab,  setActiveTab]  = useState<ViewTab>("grid");
  const [empSearch,  setEmpSearch]  = useState("");
  const [sumSort,    setSumSort]    = useState<"name" | "rate" | "absent">("name");
  const [sumDir,     setSumDir]     = useState<"asc" | "desc">("asc");

  const dates = useMemo(() => getHalfDates(year, month, half), [year, month, half]);
  const periodLabel = `${year}-${String(month).padStart(2, "0")} H${half}`;

  // Filter employees by dept (for SUPERVISOR scoping via UI; server filters too)
  const scopedEmployees = useMemo(() =>
    deptId ? employees.filter(e => e.departmentId === Number(deptId)) : employees,
  [employees, deptId]);

  // Search within scoped employees (for grid + summary)
  const filteredEmployees = useMemo(() => {
    const q = empSearch.toLowerCase();
    if (!q) return scopedEmployees;
    return scopedEmployees.filter(e =>
      e.nameEn.toLowerCase().includes(q) || e.nameKh.includes(q)
    );
  }, [scopedEmployees, empSearch]);

  // Period stats (computed from the loaded marks snapshot)
  const stats = useMemo(() =>
    loaded ? computePeriodStats(scopedEmployees, marks, dates) : null,
  [loaded, scopedEmployees, marks, dates]);

  // Per-employee summaries (for Summary tab)
  const empSummaries = useMemo((): EmpSummary[] => {
    if (!loaded) return [];
    let sums = computeEmpSummaries(filteredEmployees, marks, dates);
    sums = sums.sort((a, b) => {
      let cmp = 0;
      if (sumSort === "name")   cmp = a.employee.nameEn.localeCompare(b.employee.nameEn);
      if (sumSort === "rate")   cmp = (a.rate ?? -1) - (b.rate ?? -1);
      if (sumSort === "absent") cmp = b.absent - a.absent;
      return sumDir === "asc" ? cmp : -cmp;
    });
    return sums;
  }, [loaded, filteredEmployees, marks, dates, sumSort, sumDir]);

  // Dept summaries (for Departments tab)
  const deptSummaries = useMemo((): DeptSummary[] =>
    loaded ? computeDeptSummaries(employees, departments, marks, dates) : [],
  [loaded, employees, departments, marks, dates]);

  // ── Load ──────────────────────────────────────────────────────────────────────
  function load() {
    setLoadErr("");
    startTransition(async () => {
      const res = await getAttendancePeriodFull({
        startDate: new Date(dates[0]),
        endDate:   new Date(dates[dates.length - 1]),
        departmentId: deptId ? Number(deptId) : undefined,
      });
      if (!res.ok) {
        setLoadErr("error" in res ? res.error : "Failed to load");
        setLoaded(true);
        return;
      }
      const m: Record<string, Mark> = {};
      for (const row of res.data) {
        m[`${row.employeeId}|${row.date}|am`] = row.am;
        m[`${row.employeeId}|${row.date}|pm`] = row.pm;
      }
      setMarks(m);
      setLoaded(true);
    });
  }

  // ── Export ────────────────────────────────────────────────────────────────────
  async function handleExportSummary(fmt: "excel" | "pdf") {
    const { exportToExcel, exportToPDF } = await import("@/lib/export");
    const data = empSummaries.map(s => ({
      id: s.employee.id,
      name: s.employee.nameEn,
      nameKh: s.employee.nameKh,
      department: departments.find(d => d.id === s.employee.departmentId)?.name ?? "—",
      position: positions.find(p => p.id === s.employee.positionId)?.name ?? "—",
      present: s.present,
      leave:   s.leave,
      absent:  s.absent,
      total:   s.total,
      rate:    s.rate !== null ? `${s.rate}%` : "—",
    }));
    const cols = [
      { header: "ID",              key: "id",         width: 7  },
      { header: "Name (EN)",       key: "name",       width: 22 },
      { header: "Name (KH)",       key: "nameKh",     width: 22 },
      { header: "Department",      key: "department", width: 18 },
      { header: "Position",        key: "position",   width: 18 },
      { header: "Present Days",    key: "present",    width: 14 },
      { header: "Leave Days",      key: "leave",      width: 12 },
      { header: "Absent Days",     key: "absent",     width: 12 },
      { header: "Total Days",      key: "total",      width: 12 },
      { header: "Attendance Rate", key: "rate",       width: 16 },
    ];
    const fn = `attendance-summary-${periodLabel.replace(" ", "-")}`;
    if (fmt === "excel") await exportToExcel(data, cols, fn);
    else await exportToPDF(
      "ZY Steel HR — Attendance Summary",
      `Period: ${periodLabel}  (${dates[0]} → ${dates[dates.length - 1]})`,
      data, cols, fn,
    );
  }

  async function handleExportGrid(fmt: "excel" | "pdf") {
    const { exportToExcel, exportToPDF } = await import("@/lib/export");
    const data: Record<string, unknown>[] = [];
    for (const e of filteredEmployees) {
      for (const d of dates) {
        const am = marks[`${e.id}|${d}|am`];
        const pm = marks[`${e.id}|${d}|pm`];
        if (!am && !pm) continue;
        data.push({
          date: d,
          id: e.id,
          name: e.nameEn, nameKh: e.nameKh,
          department: departments.find(dep => dep.id === e.departmentId)?.name ?? "—",
          am: am ? GLYPH[am] : "—",
          pm: pm ? GLYPH[pm] : "—",
          days: (((am === "PRESENT" ? 1 : 0) + (pm === "PRESENT" ? 1 : 0)) / 2).toFixed(1),
        });
      }
    }
    const cols = [
      { header: "Date",        key: "date",       width: 14 },
      { header: "ID",          key: "id",         width: 7  },
      { header: "Name",        key: "name",       width: 22 },
      { header: "Name KH",     key: "nameKh",     width: 22 },
      { header: "Department",  key: "department", width: 18 },
      { header: "AM",          key: "am",         width: 8  },
      { header: "PM",          key: "pm",         width: 8  },
      { header: "Days Worked", key: "days",       width: 12 },
    ];
    const fn = `attendance-records-${periodLabel.replace(" ", "-")}`;
    if (fmt === "excel") await exportToExcel(data, cols, fn);
    else await exportToPDF(
      "ZY Steel HR — Attendance Records",
      `Period: ${periodLabel}  (${dates[0]} → ${dates[dates.length - 1]})`,
      data, cols, fn,
    );
  }

  async function handleExportDepts(fmt: "excel" | "pdf") {
    const { exportToExcel, exportToPDF } = await import("@/lib/export");
    const data = deptSummaries.map(d => ({
      department:   d.name,
      employees:    d.empCount,
      withData:     d.empWithData,
      presentDays:  d.totalPresent.toFixed(1),
      leaveDays:    d.totalLeave.toFixed(1),
      absentDays:   d.totalAbsent.toFixed(1),
      rate:         d.avgRate !== null ? `${d.avgRate}%` : "—",
    }));
    const cols = [
      { header: "Department",     key: "department",  width: 22 },
      { header: "Employees",      key: "employees",   width: 12 },
      { header: "With Records",   key: "withData",    width: 14 },
      { header: "Present Days",   key: "presentDays", width: 14 },
      { header: "Leave Days",     key: "leaveDays",   width: 12 },
      { header: "Absent Days",    key: "absentDays",  width: 12 },
      { header: "Avg Rate",       key: "rate",        width: 12 },
    ];
    const fn = `attendance-departments-${periodLabel.replace(" ", "-")}`;
    if (fmt === "excel") await exportToExcel(data, cols, fn);
    else await exportToPDF(
      "ZY Steel HR — Department Attendance",
      `Period: ${periodLabel}`,
      data, cols, fn,
    );
  }

  // ── Sort helper (summary table) ───────────────────────────────────────────────
  function toggleSort(col: typeof sumSort) {
    if (sumSort === col) setSumDir(d => d === "asc" ? "desc" : "asc");
    else { setSumSort(col); setSumDir(col === "absent" ? "desc" : "asc"); }
  }
  const sortInd = (col: typeof sumSort) => sumSort === col ? (sumDir === "asc" ? " ↑" : " ↓") : "";

  const monthNames = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Period selector ── */}
      <div style={{
        display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: 12,
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 12, padding: 16,
      }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-2)" }}>Year</label>
          <select value={year} onChange={e => { setYear(Number(e.target.value)); setLoaded(false); }} style={selectStyle}>
            {[2025, 2026, 2027].map(y => <option key={y}>{y}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-2)" }}>Month</label>
          <select value={month} onChange={e => { setMonth(Number(e.target.value)); setLoaded(false); }} style={selectStyle}>
            {monthNames.map((n, i) => <option key={i + 1} value={i + 1}>{n}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-2)" }}>Half</label>
          <select value={half} onChange={e => { setHalf(Number(e.target.value) as 1 | 2); setLoaded(false); }} style={selectStyle}>
            <option value={1}>1–15</option>
            <option value={2}>16–end</option>
          </select>
        </div>
        {departments.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-2)" }}>Department</label>
            <select value={deptId} onChange={e => { setDeptId(e.target.value ? Number(e.target.value) : ""); setLoaded(false); }} style={selectStyle}>
              <option value="">All</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        )}
        <button onClick={load} disabled={isPending} className="btn btn-primary">
          {isPending ? <><span className="spinner" />Loading…</> : loaded ? "Reload" : "Load"}
        </button>
        {loaded && (
          <span style={{ fontSize: 12, color: "var(--text-3)", alignSelf: "center" }}>
            {periodLabel} · {scopedEmployees.length} employees · {dates.length} days
          </span>
        )}
      </div>

      {/* ── Not loaded placeholder ── */}
      {!loaded && (
        <div style={{
          borderRadius: 12, border: "1.5px dashed var(--border)",
          background: "var(--surface)", padding: "48px 24px",
          textAlign: "center", fontSize: 13, color: "var(--text-3)",
        }}>
          Select a period above and click Load
        </div>
      )}

      {/* ── Loaded content ── */}
      {loaded && (
        <>
          {loadErr && (
            <div style={{ padding: "10px 16px", borderRadius: 8, background: "var(--red-bg)", color: "var(--red)", fontSize: 13 }}>
              {loadErr}
            </div>
          )}

          {/* Stats bar */}
          {stats && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
              {[
                { label: "Total",     value: stats.totalEmployees, color: "var(--text)",  bg: "var(--surface)" },
                { label: "Present",   value: `${stats.presentDays}d`, color: "var(--green)",  bg: "var(--green-bg)" },
                { label: "On Leave",  value: `${stats.leaveDays}d`,   color: "var(--amber)",  bg: "var(--amber-bg)" },
                { label: "Absent",    value: `${stats.absentDays}d`,  color: "var(--red)",    bg: "var(--red-bg)"   },
                { label: "Rate",      value: stats.rate !== null ? `${stats.rate}%` : "—", color: "var(--steel)", bg: "var(--steel-light)" },
              ].map(({ label, value, color, bg }) => (
                <div key={label} style={{
                  background: "var(--surface)", border: "1px solid var(--border)",
                  borderRadius: 10, padding: "12px 16px",
                }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{label}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
                  <div style={{ marginTop: 4, height: 3, borderRadius: 2, background: bg, opacity: 0.7 }} />
                </div>
              ))}
            </div>
          )}

          {/* Tab bar + toolbar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            {/* Tabs */}
            <div style={{ display: "flex", borderRadius: 8, border: "1px solid var(--border)", overflow: "hidden" }}>
              {([
                { id: "grid",        label: "Grid"        },
                { id: "summary",     label: "Summary"     },
                { id: "departments", label: "Departments" },
              ] as const).map((t, i) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  style={{
                    padding: "7px 18px", border: "none", cursor: "pointer",
                    fontSize: 13, fontWeight: 500,
                    background: activeTab === t.id ? "var(--steel)" : "var(--surface)",
                    color: activeTab === t.id ? "#fff" : "var(--text-2)",
                    borderRight: i < 2 ? "1px solid var(--border)" : "none",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Right toolbar: search + export */}
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {(activeTab === "grid" || activeTab === "summary") && (
                <input
                  value={empSearch}
                  onChange={e => setEmpSearch(e.target.value)}
                  placeholder="Search employee…"
                  style={{
                    padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border)",
                    fontSize: 13, background: "var(--surface)", color: "var(--text)", width: 180,
                  }}
                />
              )}
              <ExportMenu
                onExcel={() => activeTab === "grid" ? handleExportGrid("excel") : activeTab === "summary" ? handleExportSummary("excel") : handleExportDepts("excel")}
                onPDF={() => activeTab === "grid" ? handleExportGrid("pdf") : activeTab === "summary" ? handleExportSummary("pdf") : handleExportDepts("pdf")}
              />
            </div>
          </div>

          {/* ── Grid tab ── */}
          <div style={{ display: activeTab === "grid" ? "block" : "none" }}>
            {canWrite ? (
              <AttendanceGrid employees={filteredEmployees} dates={dates} initial={marks} />
            ) : (
              <ReadOnlyGrid employees={filteredEmployees} dates={dates} marks={marks} />
            )}
          </div>

          {/* ── Summary tab ── */}
          <div style={{ display: activeTab === "summary" ? "block" : "none" }}>
            <SummaryTable
              summaries={empSummaries}
              departments={departments}
              positions={positions}
              toggleSort={toggleSort}
              sortInd={sortInd}
            />
          </div>

          {/* ── Departments tab ── */}
          <div style={{ display: activeTab === "departments" ? "block" : "none" }}>
            <DeptReport summaries={deptSummaries} />
          </div>
        </>
      )}
    </div>
  );
}

// ── Export dropdown ─────────────────────────────────────────────────────────────

function ExportMenu({ onExcel, onPDF }: { onExcel: () => void; onPDF: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "6px 14px", borderRadius: 8,
          border: "1px solid var(--border)", background: "var(--surface)",
          color: "var(--text-2)", fontSize: 13, cursor: "pointer",
        }}
      >
        Export ▾
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 20,
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
          minWidth: 140, overflow: "hidden",
        }}
          onMouseLeave={() => setOpen(false)}
        >
          {[
            { label: "Excel (.xlsx)", action: onExcel },
            { label: "PDF (.pdf)",    action: onPDF   },
          ].map(item => (
            <button
              key={item.label}
              onClick={() => { setOpen(false); item.action(); }}
              style={{
                display: "block", width: "100%", padding: "9px 14px",
                textAlign: "left", border: "none", background: "none",
                fontSize: 13, color: "var(--text)", cursor: "pointer",
              }}
              className="export-item"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
      <style jsx>{`.export-item:hover { background: var(--surface-2) !important; }`}</style>
    </div>
  );
}

// ── Read-only grid (for VIEWER/non-write roles) ─────────────────────────────────

function ReadOnlyGrid({ employees, dates, marks }: {
  employees: GridEmployee[]; dates: string[]; marks: Record<string, Mark>;
}) {
  return (
    <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--border)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead style={{ background: "var(--surface-2)" }}>
          <tr>
            <th style={{
              position: "sticky", left: 0, background: "var(--surface-2)",
              padding: "8px 12px", textAlign: "left", fontWeight: 600, fontSize: 12,
              color: "var(--text-2)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap",
            }}>Employee</th>
            {dates.map(d => (
              <th key={d} colSpan={2} style={{
                padding: "8px 4px", textAlign: "center", fontWeight: 600, fontSize: 11,
                color: "var(--text-3)", borderBottom: "1px solid var(--border)",
              }}>{d.slice(8)}</th>
            ))}
            <th style={{ padding: "8px 10px", textAlign: "center", fontWeight: 600, fontSize: 11, color: "var(--text-3)", borderBottom: "1px solid var(--border)" }}>√/△/×</th>
          </tr>
        </thead>
        <tbody>
          {employees.map(e => {
            let p = 0, l = 0, a = 0;
            for (const d of dates) {
              for (const h of ["am", "pm"] as const) {
                const m = marks[`${e.id}|${d}|${h}`];
                if (m === "PRESENT") p += 0.5;
                else if (m === "LEAVE") l += 0.5;
                else if (m === "ABSENT") a += 0.5;
              }
            }
            return (
              <tr key={e.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td style={{ position: "sticky", left: 0, background: "var(--surface)", padding: "6px 12px", whiteSpace: "nowrap" }}>
                  <div style={{ fontWeight: 500 }}>{e.nameEn}</div>
                  <div style={{ fontSize: 11, color: "var(--text-3)" }}>{e.nameKh}</div>
                </td>
                {dates.map(d => (["am", "pm"] as const).map(h => {
                  const m: Mark = marks[`${e.id}|${d}|${h}`] ?? "PRESENT";
                  return (
                    <td key={d + h} style={{ padding: 2 }}>
                      <span style={{
                        display: "flex", width: 24, height: 28,
                        alignItems: "center", justifyContent: "center",
                        borderRadius: 4, fontSize: 12, fontWeight: 700,
                        color: TONE[m].color, background: TONE[m].bg,
                      }}>{GLYPH[m]}</span>
                    </td>
                  );
                }))}
                <td style={{ padding: "6px 10px", textAlign: "center", fontSize: 12, whiteSpace: "nowrap" }}>
                  <span style={{ color: "var(--green)" }}>{p}</span>/
                  <span style={{ color: "var(--amber)" }}>{l}</span>/
                  <span style={{ color: "var(--red)" }}>{a}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Summary table ───────────────────────────────────────────────────────────────

function SummaryTable({
  summaries, departments, positions, toggleSort, sortInd,
}: {
  summaries: EmpSummary[];
  departments: { id: number; name: string }[];
  positions: { id: number; name: string; level: number }[];
  toggleSort: (col: "name" | "rate" | "absent") => void;
  sortInd: (col: "name" | "rate" | "absent") => string;
}) {
  if (summaries.length === 0) {
    return (
      <div style={{
        borderRadius: 10, border: "1.5px dashed var(--border)",
        padding: "40px 24px", textAlign: "center", color: "var(--text-3)", fontSize: 14,
      }}>
        No employees match the current filter.
      </div>
    );
  }

  const thS: React.CSSProperties = {
    padding: "9px 14px", textAlign: "left", fontWeight: 600, fontSize: 11,
    textTransform: "uppercase", letterSpacing: "0.04em",
    color: "var(--text-3)", borderBottom: "1px solid var(--border)",
    whiteSpace: "nowrap", userSelect: "none",
  };

  return (
    <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--border)" }}>
      <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "var(--surface-2)" }}>
            <th style={thS}>ID</th>
            <th style={{ ...thS, cursor: "pointer" }} onClick={() => toggleSort("name")}>
              Employee{sortInd("name")}
            </th>
            <th style={thS}>Department</th>
            <th style={thS}>Position</th>
            <th style={{ ...thS, textAlign: "center" }}>Present</th>
            <th style={{ ...thS, textAlign: "center" }}>Leave</th>
            <th style={{ ...thS, textAlign: "center", cursor: "pointer" }} onClick={() => toggleSort("absent")}>
              Absent{sortInd("absent")}
            </th>
            <th style={{ ...thS, textAlign: "center" }}>Total</th>
            <th style={{ ...thS, textAlign: "center", cursor: "pointer" }} onClick={() => toggleSort("rate")}>
              Rate{sortInd("rate")}
            </th>
          </tr>
        </thead>
        <tbody>
          {summaries.map(s => {
            const rate = s.rate;
            const rateColor = rate === null ? "var(--text-3)"
              : rate >= 90 ? "var(--green)"
              : rate >= 75 ? "var(--amber)"
              : "var(--red)";
            const dept = departments.find(d => d.id === s.employee.departmentId);
            const pos  = positions.find(p => p.id === s.employee.positionId);
            return (
              <tr key={s.employee.id} style={{ borderBottom: "1px solid var(--border)" }} className="sum-row-hover">
                <td style={{ padding: "10px 14px", color: "var(--text-3)", fontSize: 12 }}>{s.employee.id}</td>
                <td style={{ padding: "10px 14px" }}>
                  <div style={{ fontWeight: 600 }}>{s.employee.nameEn}</div>
                  <div style={{ fontSize: 11, color: "var(--text-3)" }}>{s.employee.nameKh}</div>
                </td>
                <td style={{ padding: "10px 14px", color: "var(--text-2)", fontSize: 12 }}>{dept?.name ?? "—"}</td>
                <td style={{ padding: "10px 14px", color: "var(--text-2)", fontSize: 12 }}>{pos?.name ?? "—"}</td>
                <td style={{ padding: "10px 14px", textAlign: "center" }}>
                  <span style={{ color: "var(--green)", fontWeight: 600 }}>{s.hasData ? s.present : "—"}</span>
                </td>
                <td style={{ padding: "10px 14px", textAlign: "center" }}>
                  <span style={{ color: "var(--amber)", fontWeight: 600 }}>{s.hasData ? s.leave : "—"}</span>
                </td>
                <td style={{ padding: "10px 14px", textAlign: "center" }}>
                  <span style={{ color: "var(--red)", fontWeight: 600 }}>{s.hasData ? s.absent : "—"}</span>
                </td>
                <td style={{ padding: "10px 14px", textAlign: "center", color: "var(--text-2)" }}>
                  {s.hasData ? s.total : "—"}
                </td>
                <td style={{ padding: "10px 14px", textAlign: "center" }}>
                  {rate !== null ? (
                    <span style={{
                      display: "inline-block", padding: "2px 10px", borderRadius: 20,
                      fontSize: 12, fontWeight: 700, color: rateColor,
                      background: rateColor === "var(--green)" ? "var(--green-bg)"
                        : rateColor === "var(--amber)" ? "var(--amber-bg)" : "var(--red-bg)",
                    }}>
                      {rate}%
                    </span>
                  ) : <span style={{ color: "var(--text-3)" }}>—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <style jsx>{`.sum-row-hover:hover { background: var(--surface-2); }`}</style>
    </div>
  );
}

// ── Department report ───────────────────────────────────────────────────────────

function DeptReport({ summaries }: { summaries: DeptSummary[] }) {
  if (summaries.length === 0) {
    return (
      <div style={{
        borderRadius: 10, border: "1.5px dashed var(--border)",
        padding: "40px 24px", textAlign: "center", color: "var(--text-3)", fontSize: 14,
      }}>
        No department data available for this period.
      </div>
    );
  }

  const thS: React.CSSProperties = {
    padding: "9px 14px", textAlign: "left", fontWeight: 600, fontSize: 11,
    textTransform: "uppercase", letterSpacing: "0.04em",
    color: "var(--text-3)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap",
  };

  return (
    <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--border)" }}>
      <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "var(--surface-2)" }}>
            <th style={thS}>Department</th>
            <th style={{ ...thS, textAlign: "center" }}>Employees</th>
            <th style={{ ...thS, textAlign: "center" }}>With Records</th>
            <th style={{ ...thS, textAlign: "center" }}>Total Present</th>
            <th style={{ ...thS, textAlign: "center" }}>Total Leave</th>
            <th style={{ ...thS, textAlign: "center" }}>Total Absent</th>
            <th style={{ ...thS, textAlign: "center" }}>Avg Rate</th>
          </tr>
        </thead>
        <tbody>
          {summaries.map(d => {
            const rateColor = d.avgRate === null ? "var(--text-3)"
              : d.avgRate >= 90 ? "var(--green)"
              : d.avgRate >= 75 ? "var(--amber)"
              : "var(--red)";
            const rateBg = d.avgRate === null ? "transparent"
              : d.avgRate >= 90 ? "var(--green-bg)"
              : d.avgRate >= 75 ? "var(--amber-bg)"
              : "var(--red-bg)";
            return (
              <tr key={d.id} style={{ borderBottom: "1px solid var(--border)" }} className="dept-row-hover">
                <td style={{ padding: "11px 14px", fontWeight: 600, color: "var(--text)" }}>{d.name}</td>
                <td style={{ padding: "11px 14px", textAlign: "center", color: "var(--text-2)" }}>{d.empCount}</td>
                <td style={{ padding: "11px 14px", textAlign: "center", color: "var(--text-2)" }}>{d.empWithData}</td>
                <td style={{ padding: "11px 14px", textAlign: "center" }}>
                  <span style={{ color: "var(--green)", fontWeight: 600 }}>{d.totalPresent.toFixed(1)}</span>
                </td>
                <td style={{ padding: "11px 14px", textAlign: "center" }}>
                  <span style={{ color: "var(--amber)", fontWeight: 600 }}>{d.totalLeave.toFixed(1)}</span>
                </td>
                <td style={{ padding: "11px 14px", textAlign: "center" }}>
                  <span style={{ color: "var(--red)", fontWeight: 600 }}>{d.totalAbsent.toFixed(1)}</span>
                </td>
                <td style={{ padding: "11px 14px", textAlign: "center" }}>
                  {d.avgRate !== null ? (
                    <span style={{
                      display: "inline-block", padding: "2px 10px", borderRadius: 20,
                      fontSize: 12, fontWeight: 700, color: rateColor, background: rateBg,
                    }}>{d.avgRate}%</span>
                  ) : <span style={{ color: "var(--text-3)" }}>—</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <style jsx>{`
        .dept-row-hover:hover { background: var(--surface-2); }
      `}</style>
    </div>
  );
}
