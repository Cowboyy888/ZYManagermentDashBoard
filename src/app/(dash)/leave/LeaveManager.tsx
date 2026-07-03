"use client";
import React, { useState, useTransition, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  createLeaveRequest, approveLeaveRequest, rejectLeaveRequest,
  cancelLeaveRequest, updateLeaveRequest,
  listLeaveBalancesForYear, setLeaveBalance,
} from "@/actions/leave";
import type { LeaveBalanceSummary } from "@/actions/leave";
import { ExportMenu } from "@/components/ExportMenu";

// ─── Types ────────────────────────────────────────────────────────────────────

type LeaveRow = {
  id: number;
  employeeId: number;
  type: string;
  startDate: string;
  endDate: string;
  halfDay: boolean;
  status: string;
  reason: string | null;
  rejectionReason: string | null;
  decidedById: string | null;
  createdAt: string;
  employee: {
    id: number;
    nameEn: string;
    nameKh: string;
    employeeCode: string | null;
    departmentId: number | null;
    department: { id: number; name: string } | null;
  };
};

type EmpOption = {
  id: number;
  nameEn: string;
  nameKh: string;
  employeeCode: string | null;
  departmentId: number | null;
};

type DeptOption = { id: number; name: string };

interface Props {
  rows: LeaveRow[];
  employees: EmpOption[];
  departments: DeptOption[];
  canRequest: boolean;
  canApprove: boolean;
  canManage: boolean;
  actorDeptId: number | null;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LEAVE_LABELS: Record<string, string> = {
  ANNUAL: "Annual",
  SICK: "Sick",
  SPECIAL: "Special",
  UNPAID: "Unpaid",
  PERMITTED: "Permitted",
};

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  PENDING:  { color: "var(--amber)", background: "var(--amber-bg)" },
  APPROVED: { color: "var(--green)", background: "var(--green-bg)" },
  REJECTED: { color: "var(--red)",   background: "var(--red-bg)" },
};

const TYPE_STYLE: Record<string, React.CSSProperties> = {
  ANNUAL:    { color: "var(--blue)",   background: "var(--blue-bg)" },
  SICK:      { color: "var(--red)",    background: "var(--red-bg)" },
  SPECIAL:   { color: "var(--purple)", background: "var(--purple-bg)" },
  UNPAID:    { color: "var(--text-2)", background: "var(--surface-2)" },
  PERMITTED: { color: "var(--amber)",  background: "var(--amber-bg)" },
};

const TYPE_DOT: Record<string, string> = {
  ANNUAL: "var(--blue)", SICK: "var(--red)", SPECIAL: "var(--purple)",
  UNPAID: "var(--text-3)", PERMITTED: "var(--amber)",
};

const LEAVE_TYPES = ["ANNUAL", "SICK", "SPECIAL", "UNPAID", "PERMITTED"] as const;
type LT = typeof LEAVE_TYPES[number];

const DEFAULT_GRANTED: Record<LT, number> = { ANNUAL: 18, SICK: 30, SPECIAL: 7, UNPAID: 0, PERMITTED: 0 };

const emptyForm = { employeeId: "", type: "ANNUAL", startDate: "", endDate: "", halfDay: false, reason: "" };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}
function calcDays(start: string, end: string, halfDay: boolean): string {
  if (halfDay) return "½ day";
  const days = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1;
  return `${days} day${days !== 1 ? "s" : ""}`;
}
function thisMonth(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}
function isOnLeaveToday(row: LeaveRow): boolean {
  if (row.status !== "APPROVED") return false;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const start = new Date(row.startDate); start.setHours(0, 0, 0, 0);
  const end   = new Date(row.endDate);   end.setHours(0, 0, 0, 0);
  return start <= today && today <= end;
}

function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      padding: "7px 18px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 13,
      fontWeight: 500, cursor: "pointer",
      background: active ? "var(--steel)" : "var(--surface)",
      color: active ? "#fff" : "var(--text-2)",
    }}>
      {label}
    </button>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>
      {children}
    </label>
  );
}

// ─── Calendar tab ─────────────────────────────────────────────────────────────

function CalendarTab({ rows, employees, departments }: { rows: LeaveRow[]; employees: EmpOption[]; departments: DeptOption[] }) {
  const today = new Date();
  const [year, setYear]   = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed
  const [deptFilter, setDeptFilter] = useState<number | "">("");

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dayNums = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const monthStart = new Date(year, month, 1);
  const monthEnd   = new Date(year, month, daysInMonth);

  const filtered = useMemo(() => {
    const ms = new Date(year, month, 1);
    const me = new Date(year, month + 1, 0);
    const visible = deptFilter !== ""
      ? employees.filter((e) => e.departmentId === deptFilter)
      : employees;

    const activeIds = new Set(visible.map((e) => e.id));
    const relevant = rows.filter((r) => {
      if (!activeIds.has(r.employeeId)) return false;
      if (r.status !== "APPROVED" && r.status !== "PENDING") return false;
      const start = new Date(r.startDate); start.setHours(0, 0, 0, 0);
      const end   = new Date(r.endDate);   end.setHours(0, 0, 0, 0);
      return start <= me && end >= ms;
    });

    const empMap = new Map(employees.map((e) => [e.id, e]));
    return { visible: visible.filter((e) => relevant.some((r) => r.employeeId === e.id)), relevant, empMap };
  }, [rows, employees, deptFilter, year, month]);

  function getCellRows(empId: number, day: number): LeaveRow[] {
    const date = new Date(year, month, day); date.setHours(0, 0, 0, 0);
    return filtered.relevant.filter((r) => {
      if (r.employeeId !== empId) return false;
      const s = new Date(r.startDate); s.setHours(0, 0, 0, 0);
      const e = new Date(r.endDate);   e.setHours(0, 0, 0, 0);
      return s <= date && date <= e;
    });
  }

  function prevMonth() { if (month === 0) { setMonth(11); setYear((y) => y - 1); } else setMonth((m) => m - 1); }
  function nextMonth() { if (month === 11) { setMonth(0); setYear((y) => y + 1); } else setMonth((m) => m + 1); }

  const monthName = new Date(year, month, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  const noData = filtered.visible.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn" onClick={prevMonth} style={{ padding: "5px 12px" }}>‹</button>
        <span style={{ fontSize: 14, fontWeight: 700, minWidth: 160, textAlign: "center" }}>{monthName}</span>
        <button className="btn" onClick={nextMonth} style={{ padding: "5px 12px" }}>›</button>
        <button className="btn" onClick={() => { setYear(today.getFullYear()); setMonth(today.getMonth()); }} style={{ fontSize: 12 }}>
          Today
        </button>
        <select className="form-select" style={{ width: "auto", minWidth: 160 }}
          value={deptFilter} onChange={(e) => setDeptFilter(e.target.value === "" ? "" : Number(e.target.value))}>
          <option value="">All departments</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        {/* Legend */}
        <div style={{ display: "flex", gap: 12, marginLeft: "auto", flexWrap: "wrap" }}>
          {LEAVE_TYPES.map((t) => (
            <span key={t} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-2)" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: TYPE_DOT[t], display: "inline-block" }} />
              {LEAVE_LABELS[t]}
            </span>
          ))}
          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--amber)" }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, border: "1.5px dashed var(--amber)", display: "inline-block" }} />
            Pending
          </span>
        </div>
      </div>

      {noData ? (
        <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-3)", fontSize: 13, border: "2px dashed var(--border)", borderRadius: 8 }}>
          No approved or pending leaves for {monthName}
          {deptFilter !== "" && " in this department"}
        </div>
      ) : (
        <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--border)" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 12, width: "100%" }}>
            <thead style={{ background: "var(--surface-2)" }}>
              <tr>
                <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, borderBottom: "1px solid var(--border)", whiteSpace: "nowrap", minWidth: 140, position: "sticky", left: 0, background: "var(--surface-2)", zIndex: 2 }}>
                  Employee
                </th>
                {dayNums.map((d) => {
                  const isToday = year === today.getFullYear() && month === today.getMonth() && d === today.getDate();
                  return (
                    <th key={d} style={{
                      padding: "6px 3px", textAlign: "center", fontWeight: 600,
                      borderBottom: "1px solid var(--border)", minWidth: 26,
                      color: isToday ? "var(--steel)" : undefined,
                    }}>
                      {d}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {filtered.visible.map((emp) => (
                <tr key={emp.id} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "6px 12px", whiteSpace: "nowrap", position: "sticky", left: 0, background: "var(--surface)", zIndex: 1 }}>
                    <div style={{ fontWeight: 500 }}>{emp.nameEn}</div>
                    <div style={{ fontSize: 10.5, color: "var(--text-3)" }}>{emp.nameKh}</div>
                  </td>
                  {dayNums.map((d) => {
                    const cell = getCellRows(emp.id, d);
                    if (cell.length === 0) {
                      const isToday = year === today.getFullYear() && month === today.getMonth() && d === today.getDate();
                      return (
                        <td key={d} style={{
                          padding: 2, textAlign: "center",
                          background: isToday ? "var(--steel-light)" : undefined,
                        }} />
                      );
                    }
                    const r = cell[0];
                    const isPending = r.status === "PENDING";
                    return (
                      <td key={d} style={{ padding: 2, textAlign: "center" }}>
                        <div title={`${LEAVE_LABELS[r.type]} · ${r.status.toLowerCase()}`}
                          style={{
                            width: 20, height: 20, borderRadius: isPending ? 3 : 4,
                            background: isPending ? "transparent" : TYPE_DOT[r.type] + "30",
                            border: isPending ? `1.5px dashed ${TYPE_DOT[r.type]}` : `1px solid ${TYPE_DOT[r.type]}50`,
                            margin: "0 auto",
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}>
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: TYPE_DOT[r.type], display: "block" }} />
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Balances tab ─────────────────────────────────────────────────────────────

function BalancesTab({ departments, canManage }: { departments: DeptOption[]; canManage: boolean }) {
  const [year, setYear]       = useState(new Date().getFullYear());
  const [deptFilter, setDeptFilter] = useState<number | "">("");
  const [data, setData]       = useState<LeaveBalanceSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [editCell, setEditCell] = useState<{ empId: number; type: LT } | null>(null);
  const [editVal, setEditVal] = useState("");
  const [saving, setSaving]   = useState(false);
  const [msg, setMsg]         = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async (y: number) => {
    setLoading(true); setError(null);
    const res = await listLeaveBalancesForYear(y);
    if ("error" in res ? false : res.ok) {
      setData((res as { ok: true; data: LeaveBalanceSummary[] }).data);
    } else {
      setError("error" in res ? res.error : "Failed to load balances");
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(year); }, [year, load]);

  const filtered = useMemo(() => {
    if (!data) return [];
    if (deptFilter === "") return data;
    return data.filter((r) => r.departmentId === deptFilter);
  }, [data, deptFilter]);

  async function handleSave(empId: number, type: LT) {
    const granted = Number(editVal);
    if (isNaN(granted) || granted < 0) { setMsg({ ok: false, text: "Enter a valid number of days." }); return; }
    setSaving(true);
    const res = await setLeaveBalance(empId, year, type, granted);
    setSaving(false);
    if (res.ok) {
      setMsg({ ok: true, text: "Balance updated." });
      setEditCell(null);
      load(year);
    } else {
      setMsg({ ok: false, text: "error" in res ? res.error : "Failed" });
    }
  }

  const exportData = useMemo(() => filtered.map((emp) => ({
    employee: emp.nameEn,
    department: emp.departmentName ?? "",
    annualGranted:  emp.balances.ANNUAL?.granted ?? 0,
    annualUsed:     emp.balances.ANNUAL?.used ?? 0,
    annualLeft:     emp.balances.ANNUAL?.remaining ?? 0,
    sickGranted:    emp.balances.SICK?.granted ?? 0,
    sickUsed:       emp.balances.SICK?.used ?? 0,
    specialGranted: emp.balances.SPECIAL?.granted ?? 0,
    specialUsed:    emp.balances.SPECIAL?.used ?? 0,
    unpaidUsed:     emp.balances.UNPAID?.used ?? 0,
    permittedUsed:  emp.balances.PERMITTED?.used ?? 0,
  })), [filtered]);

  const exportCols = [
    { header: "Employee", key: "employee", width: 22 },
    { header: "Department", key: "department", width: 18 },
    { header: "Annual Granted", key: "annualGranted", width: 14 },
    { header: "Annual Used",    key: "annualUsed",    width: 12 },
    { header: "Annual Left",    key: "annualLeft",    width: 12 },
    { header: "Sick Granted",   key: "sickGranted",   width: 12 },
    { header: "Sick Used",      key: "sickUsed",      width: 10 },
    { header: "Special Granted", key: "specialGranted", width: 14 },
    { header: "Special Used",   key: "specialUsed",   width: 12 },
    { header: "Unpaid Used",    key: "unpaidUsed",    width: 10 },
    { header: "Permitted Used", key: "permittedUsed", width: 12 },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <select className="form-select" style={{ width: "auto" }} value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {[year - 1, year, year + 1].map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select className="form-select" style={{ width: "auto", minWidth: 160 }}
          value={deptFilter} onChange={(e) => setDeptFilter(e.target.value === "" ? "" : Number(e.target.value))}>
          <option value="">All departments</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <button className="btn" onClick={() => load(year)} style={{ fontSize: 12 }}>Refresh</button>
        <div style={{ marginLeft: "auto" }}>
          <ExportMenu data={exportData} columns={exportCols} filename={`leave-balances-${year}`} title={`Leave Balances ${year}`} subtitle="ZY Steel HR Dashboard" />
        </div>
      </div>

      {canManage && (
        <div style={{ padding: "8px 12px", borderRadius: 6, background: "var(--steel-light)", color: "var(--steel)", fontSize: 12 }}>
          Click any granted-days cell to override the default entitlement for that employee.
        </div>
      )}

      {msg && (
        <div style={{ padding: "8px 12px", borderRadius: 6, fontSize: 13, background: msg.ok ? "var(--green-bg)" : "var(--red-bg)", color: msg.ok ? "var(--green)" : "var(--red)" }}>
          {msg.text}
        </div>
      )}

      {loading && <p style={{ color: "var(--text-3)", fontSize: 13 }}>Loading balances…</p>}
      {error && <p style={{ color: "var(--red)", fontSize: 13 }}>{error}</p>}

      {!loading && !error && (
        <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--border)" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Department</th>
                <th colSpan={3} style={{ textAlign: "center", borderLeft: "1px solid var(--border)" }}>Annual</th>
                <th colSpan={2} style={{ textAlign: "center", borderLeft: "1px solid var(--border)" }}>Sick</th>
                <th colSpan={2} style={{ textAlign: "center", borderLeft: "1px solid var(--border)" }}>Special</th>
                <th style={{ borderLeft: "1px solid var(--border)" }}>Unpaid</th>
                <th>Permitted</th>
              </tr>
              <tr style={{ background: "var(--surface-2)", fontSize: 11 }}>
                <th /><th />
                <th style={{ borderLeft: "1px solid var(--border)", color: "var(--text-3)" }}>Granted</th>
                <th style={{ color: "var(--text-3)" }}>Used</th>
                <th style={{ color: "var(--text-3)" }}>Left</th>
                <th style={{ borderLeft: "1px solid var(--border)", color: "var(--text-3)" }}>Granted</th>
                <th style={{ color: "var(--text-3)" }}>Used</th>
                <th style={{ borderLeft: "1px solid var(--border)", color: "var(--text-3)" }}>Granted</th>
                <th style={{ color: "var(--text-3)" }}>Used</th>
                <th style={{ borderLeft: "1px solid var(--border)", color: "var(--text-3)" }}>Used</th>
                <th style={{ color: "var(--text-3)" }}>Used</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={11} style={{ textAlign: "center", padding: "32px 0", color: "var(--text-3)", fontSize: 13 }}>No employees found</td></tr>
              )}
              {filtered.map((emp) => {
                function GrantedCell({ type }: { type: LT }) {
                  const b = emp.balances[type];
                  const isEditing = editCell?.empId === emp.employeeId && editCell?.type === type;
                  if (isEditing) {
                    return (
                      <td style={{ borderLeft: "1px solid var(--border)", padding: "4px 8px" }}>
                        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                          <input type="number" min={0} max={365} className="form-input"
                            style={{ width: 56, height: 28, padding: "0 6px", fontSize: 12 }}
                            value={editVal}
                            onChange={(e) => setEditVal(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") handleSave(emp.employeeId, type); if (e.key === "Escape") setEditCell(null); }}
                            autoFocus
                          />
                          <button className="btn" style={{ height: 26, padding: "0 8px", fontSize: 11 }} disabled={saving} onClick={() => handleSave(emp.employeeId, type)}>
                            {saving ? "…" : "✓"}
                          </button>
                          <button className="btn" style={{ height: 26, padding: "0 8px", fontSize: 11 }} onClick={() => setEditCell(null)}>✕</button>
                        </div>
                      </td>
                    );
                  }
                  return (
                    <td
                      style={{ borderLeft: "1px solid var(--border)", cursor: canManage ? "pointer" : "default", color: "var(--text)" }}
                      onClick={() => { if (canManage) { setEditCell({ empId: emp.employeeId, type }); setEditVal(String(b?.granted ?? DEFAULT_GRANTED[type])); } }}
                      title={canManage ? "Click to edit" : undefined}
                    >
                      {b?.granted ?? DEFAULT_GRANTED[type]}
                      {canManage && <span style={{ marginLeft: 4, fontSize: 10, color: "var(--text-3)" }}>✎</span>}
                    </td>
                  );
                }

                function UsedCell({ type, left }: { type: LT; left?: boolean }) {
                  const b = emp.balances[type];
                  const used = b?.used ?? 0;
                  return (
                    <td style={{ borderLeft: left ? "1px solid var(--border)" : undefined }}>
                      <span style={{ color: used > 0 ? "var(--text)" : "var(--text-3)" }}>{used}</span>
                    </td>
                  );
                }

                function LeftCell({ type }: { type: LT }) {
                  const b = emp.balances[type];
                  const rem = b?.remaining ?? 0;
                  return (
                    <td style={{ fontWeight: 600, color: rem <= 3 ? "var(--red)" : rem <= 7 ? "var(--amber)" : "var(--green)" }}>
                      {rem}
                    </td>
                  );
                }

                return (
                  <tr key={emp.employeeId}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{emp.nameEn}</div>
                      <div style={{ fontSize: 11, color: "var(--text-3)" }}>{emp.nameKh}</div>
                    </td>
                    <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{emp.departmentName ?? "—"}</td>
                    <GrantedCell type="ANNUAL" />
                    <UsedCell type="ANNUAL" />
                    <LeftCell type="ANNUAL" />
                    <GrantedCell type="SICK" />
                    <UsedCell type="SICK" left />
                    <GrantedCell type="SPECIAL" />
                    <UsedCell type="SPECIAL" left />
                    <UsedCell type="UNPAID" left />
                    <UsedCell type="PERMITTED" />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Reports tab ──────────────────────────────────────────────────────────────

function ReportsTab({ rows, departments }: { rows: LeaveRow[]; departments: DeptOption[] }) {
  const [deptFilter, setDeptFilter] = useState<number | "">("");
  const [yearFilter, setYearFilter] = useState<number | "">(new Date().getFullYear());

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (r.status !== "APPROVED") return false;
      if (deptFilter !== "" && r.employee.departmentId !== deptFilter) return false;
      if (yearFilter !== "" && new Date(r.startDate).getFullYear() !== yearFilter) return false;
      return true;
    });
  }, [rows, deptFilter, yearFilter]);

  const byType = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const t of LEAVE_TYPES) counts[t] = 0;
    for (const r of filtered) {
      const days = r.halfDay ? 0.5 : Math.round((new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / 86400000) + 1;
      counts[r.type] = (counts[r.type] ?? 0) + days;
    }
    return counts;
  }, [filtered]);

  const byEmployee = useMemo(() => {
    const map = new Map<number, { nameEn: string; nameKh: string; dept: string | null; counts: Record<string, number> }>();
    for (const r of filtered) {
      if (!map.has(r.employeeId)) {
        map.set(r.employeeId, { nameEn: r.employee.nameEn, nameKh: r.employee.nameKh, dept: r.employee.department?.name ?? null, counts: {} });
      }
      const e = map.get(r.employeeId)!;
      const days = r.halfDay ? 0.5 : Math.round((new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / 86400000) + 1;
      e.counts[r.type] = (e.counts[r.type] ?? 0) + days;
    }
    return [...map.values()].sort((a, b) => {
      const ta = Object.values(a.counts).reduce((s, v) => s + v, 0);
      const tb = Object.values(b.counts).reduce((s, v) => s + v, 0);
      return tb - ta;
    });
  }, [filtered]);

  const byDept = useMemo(() => {
    const map = new Map<string, { name: string; counts: Record<string, number>; total: number }>();
    for (const r of filtered) {
      const dept = r.employee.department?.name ?? "No Department";
      if (!map.has(dept)) map.set(dept, { name: dept, counts: {}, total: 0 });
      const e = map.get(dept)!;
      const days = r.halfDay ? 0.5 : Math.round((new Date(r.endDate).getTime() - new Date(r.startDate).getTime()) / 86400000) + 1;
      e.counts[r.type] = (e.counts[r.type] ?? 0) + days;
      e.total += days;
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }, [filtered]);

  const exportData = useMemo(() => byEmployee.map((e) => ({
    employee: e.nameEn,
    department: e.dept ?? "",
    annual:    e.counts.ANNUAL ?? 0,
    sick:      e.counts.SICK ?? 0,
    special:   e.counts.SPECIAL ?? 0,
    unpaid:    e.counts.UNPAID ?? 0,
    permitted: e.counts.PERMITTED ?? 0,
    total:     Object.values(e.counts).reduce((s, v) => s + v, 0),
  })), [byEmployee]);

  const exportCols = [
    { header: "Employee", key: "employee", width: 22 },
    { header: "Department", key: "department", width: 18 },
    { header: "Annual", key: "annual", width: 10 },
    { header: "Sick", key: "sick", width: 10 },
    { header: "Special", key: "special", width: 10 },
    { header: "Unpaid", key: "unpaid", width: 10 },
    { header: "Permitted", key: "permitted", width: 10 },
    { header: "Total Days", key: "total", width: 12 },
  ];

  const totalDays = Object.values(byType).reduce((s, v) => s + v, 0);
  const maxTypeDays = Math.max(...Object.values(byType), 1);

  const years = useMemo(() => {
    const ys = new Set<number>();
    for (const r of rows) ys.add(new Date(r.startDate).getFullYear());
    return [...ys].sort((a, b) => b - a);
  }, [rows]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Filters */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <select className="form-select" style={{ width: "auto" }} value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value === "" ? "" : Number(e.target.value))}>
          <option value="">All years</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select className="form-select" style={{ width: "auto", minWidth: 160 }}
          value={deptFilter} onChange={(e) => setDeptFilter(e.target.value === "" ? "" : Number(e.target.value))}>
          <option value="">All departments</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <div style={{ marginLeft: "auto" }}>
          <ExportMenu data={exportData} columns={exportCols} filename={`leave-report-${yearFilter || "all"}`} title={`Leave Report${yearFilter ? ` — ${yearFilter}` : ""}`} subtitle="ZY Steel HR Dashboard" />
        </div>
      </div>

      {/* Type summary bars */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
        {LEAVE_TYPES.map((t) => {
          const days = byType[t] ?? 0;
          const pct  = totalDays > 0 ? (days / maxTypeDays) * 100 : 0;
          return (
            <div key={t} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span className="tag" style={TYPE_STYLE[t]}>{LEAVE_LABELS[t]}</span>
                <span style={{ fontSize: 20, fontWeight: 800, color: "var(--text)" }}>{days}</span>
              </div>
              <div style={{ height: 5, borderRadius: 3, background: "var(--surface-2)" }}>
                <div style={{ height: "100%", borderRadius: 3, background: TYPE_DOT[t], width: `${pct}%`, transition: "width 0.4s ease" }} />
              </div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 5 }}>days taken</div>
            </div>
          );
        })}
      </div>

      {/* By department */}
      {byDept.length > 0 && (
        <div className="panel">
          <div className="panel-head"><span className="panel-title">By Department</span></div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Department</th>
                  {LEAVE_TYPES.map((t) => <th key={t}>{LEAVE_LABELS[t]}</th>)}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {byDept.map((d) => (
                  <tr key={d.name}>
                    <td style={{ fontWeight: 600 }}>{d.name}</td>
                    {LEAVE_TYPES.map((t) => (
                      <td key={t} style={{ color: "var(--text-2)" }}>{d.counts[t] ?? 0}</td>
                    ))}
                    <td style={{ fontWeight: 700 }}>{d.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* By employee */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">By Employee</span>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>{byEmployee.length} employees with approved leave</span>
        </div>
        {byEmployee.length === 0 ? (
          <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
            No approved leave records for the selected filters
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  {LEAVE_TYPES.map((t) => <th key={t}>{LEAVE_LABELS[t]}</th>)}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {byEmployee.map((e) => {
                  const total = Object.values(e.counts).reduce((s, v) => s + v, 0);
                  return (
                    <tr key={e.nameEn}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{e.nameEn}</div>
                        <div style={{ fontSize: 11, color: "var(--text-3)" }}>{e.nameKh}</div>
                      </td>
                      <td style={{ color: "var(--text-2)" }}>{e.dept ?? "—"}</td>
                      {LEAVE_TYPES.map((t) => (
                        <td key={t} style={{ color: e.counts[t] ? "var(--text)" : "var(--text-3)" }}>
                          {e.counts[t] ?? 0}
                        </td>
                      ))}
                      <td style={{ fontWeight: 700 }}>{total}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LeaveManager({ rows, employees, departments, canRequest, canApprove, canManage, actorDeptId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tab, setTab]           = useState<"requests" | "calendar" | "balances" | "reports">("requests");

  // Requests tab state
  const [filter, setFilter]     = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("ALL");
  const [empFilter, setEmpFilter] = useState<number | "">("");
  const [deptFilter, setDeptFilter] = useState<number | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo]     = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState(emptyForm);
  const [msg, setMsg]           = useState<{ ok: boolean; text: string } | null>(null);
  const [actionMap, setActionMap] = useState<Map<number, string>>(new Map());

  // Reject with reason state
  const [rejectingId, setRejectingId]   = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Edit request state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm]   = useState({ type: "ANNUAL", startDate: "", endDate: "", halfDay: false, reason: "" });

  const today = new Date(); today.setHours(0, 0, 0, 0);

  // KPIs
  const pending       = rows.filter((r) => r.status === "PENDING").length;
  const approvedMonth = rows.filter((r) => r.status === "APPROVED" && thisMonth(r.startDate)).length;
  const onLeaveToday  = rows.filter(isOnLeaveToday).length;

  // Supervisor scoping for create form
  const allowedEmployees = useMemo(() => {
    if (!actorDeptId) return employees;
    return employees.filter((e) => e.departmentId === actorDeptId);
  }, [employees, actorDeptId]);

  // Filtered requests for table
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter !== "ALL" && r.status !== filter) return false;
      if (empFilter !== "" && r.employeeId !== empFilter) return false;
      if (deptFilter !== "" && r.employee.departmentId !== deptFilter) return false;
      if (dateFrom) {
        const start = new Date(r.startDate); start.setHours(0, 0, 0, 0);
        if (start < new Date(dateFrom)) return false;
      }
      if (dateTo) {
        const end = new Date(r.endDate); end.setHours(0, 0, 0, 0);
        if (end > new Date(dateTo)) return false;
      }
      return true;
    });
  }, [rows, filter, empFilter, deptFilter, dateFrom, dateTo]);

  // Export data for requests tab
  const exportData = useMemo(() => filtered.map((r) => ({
    employee: r.employee.nameEn,
    employeeCode: r.employee.employeeCode ?? "",
    department: r.employee.department?.name ?? "",
    type: LEAVE_LABELS[r.type] ?? r.type,
    startDate: fmtShort(r.startDate),
    endDate: fmtShort(r.endDate),
    duration: calcDays(r.startDate, r.endDate, r.halfDay),
    status: r.status.charAt(0) + r.status.slice(1).toLowerCase(),
    reason: r.reason ?? "",
  })), [filtered]);

  const exportCols = [
    { header: "Employee",  key: "employee",     width: 22 },
    { header: "Code",      key: "employeeCode", width: 10 },
    { header: "Dept",      key: "department",   width: 18 },
    { header: "Type",      key: "type",         width: 12 },
    { header: "Start",     key: "startDate",    width: 12 },
    { header: "End",       key: "endDate",      width: 12 },
    { header: "Duration",  key: "duration",     width: 12 },
    { header: "Status",    key: "status",       width: 12 },
    { header: "Reason",    key: "reason",       width: 30 },
  ];

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    startTransition(async () => {
      const res = await createLeaveRequest({
        employeeId: Number(form.employeeId),
        type: form.type,
        startDate: form.startDate,
        endDate: form.endDate || form.startDate,
        halfDay: form.halfDay,
        reason: form.reason || null,
      });
      if (res.ok) {
        setMsg({ ok: true, text: "Leave request created." });
        setForm(emptyForm);
        setShowForm(false);
        router.refresh();
      } else {
        setMsg({ ok: false, text: "error" in res ? res.error : "Unknown error" });
      }
    });
  }

  async function handleApprove(id: number) {
    setMsg(null);
    setActionMap((m) => new Map(m).set(id, "approve"));
    const res = await approveLeaveRequest(id);
    setActionMap((m) => { const n = new Map(m); n.delete(id); return n; });
    if (res.ok) { setMsg({ ok: true, text: "Approved." }); router.refresh(); }
    else setMsg({ ok: false, text: "error" in res ? res.error : "Unknown error" });
  }

  async function handleRejectConfirm() {
    if (rejectingId === null) return;
    setMsg(null);
    setActionMap((m) => new Map(m).set(rejectingId, "reject"));
    const res = await rejectLeaveRequest(rejectingId, rejectReason || undefined);
    setActionMap((m) => { const n = new Map(m); n.delete(rejectingId!); return n; });
    setRejectingId(null); setRejectReason("");
    if (res.ok) { setMsg({ ok: true, text: "Rejected." }); router.refresh(); }
    else setMsg({ ok: false, text: "error" in res ? res.error : "Unknown error" });
  }

  async function handleCancel(id: number) {
    if (!confirm("Cancel this leave request?")) return;
    setMsg(null);
    setActionMap((m) => new Map(m).set(id, "cancel"));
    const res = await cancelLeaveRequest(id);
    setActionMap((m) => { const n = new Map(m); n.delete(id); return n; });
    if (res.ok) { setMsg({ ok: true, text: "Request cancelled." }); router.refresh(); }
    else setMsg({ ok: false, text: "error" in res ? res.error : "Unknown error" });
  }

  function startEdit(r: LeaveRow) {
    setEditingId(r.id);
    setEditForm({ type: r.type, startDate: r.startDate.slice(0, 10), endDate: r.endDate.slice(0, 10), halfDay: r.halfDay, reason: r.reason ?? "" });
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault(); if (editingId === null) return;
    setMsg(null);
    startTransition(async () => {
      const res = await updateLeaveRequest(editingId, {
        type: editForm.type,
        startDate: editForm.startDate,
        endDate: editForm.endDate || editForm.startDate,
        halfDay: editForm.halfDay,
        reason: editForm.reason || null,
      });
      if (res.ok) {
        setMsg({ ok: true, text: "Leave request updated." });
        setEditingId(null);
        router.refresh();
      } else {
        setMsg({ ok: false, text: "error" in res ? res.error : "Unknown error" });
      }
    });
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        <div className="kpi-card">
          <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500, marginBottom: 6 }}>Pending Approval</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: pending > 0 ? "var(--amber)" : "var(--text)" }}>{pending}</div>
        </div>
        <div className="kpi-card">
          <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500, marginBottom: 6 }}>On Leave Today</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: onLeaveToday > 0 ? "var(--blue)" : "var(--text)" }}>{onLeaveToday}</div>
        </div>
        <div className="kpi-card">
          <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500, marginBottom: 6 }}>Approved This Month</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--green)" }}>{approvedMonth}</div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 8 }}>
        <TabBtn label="Requests"  active={tab === "requests"}  onClick={() => setTab("requests")} />
        <TabBtn label="Calendar"  active={tab === "calendar"}  onClick={() => setTab("calendar")} />
        <TabBtn label="Balances"  active={tab === "balances"}  onClick={() => setTab("balances")} />
        <TabBtn label="Reports"   active={tab === "reports"}   onClick={() => setTab("reports")} />
      </div>

      {/* ── REQUESTS TAB ──────────────────────────────────────────────────── */}
      <div style={{ display: tab === "requests" ? "flex" : "none", flexDirection: "column", gap: 14 }}>

        {/* Status message */}
        {msg && (
          <div style={{ padding: "10px 14px", borderRadius: 8, fontSize: 13, background: msg.ok ? "var(--green-bg)" : "var(--red-bg)", color: msg.ok ? "var(--green)" : "var(--red)" }}>
            {msg.text}
          </div>
        )}

        {/* Reject reason modal */}
        {rejectingId !== null && (
          <>
            <div onClick={() => { setRejectingId(null); setRejectReason(""); }}
              style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50 }} />
            <div style={{
              position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
              zIndex: 51, background: "var(--surface)", borderRadius: 12, padding: 24,
              width: 400, boxShadow: "0 16px 48px rgba(0,0,0,0.2)", border: "1px solid var(--border)",
            }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Reject Leave Request</h3>
              <FieldLabel>Rejection reason (optional)</FieldLabel>
              <textarea
                className="form-input"
                style={{ height: 80, resize: "vertical", paddingTop: 8, marginBottom: 14 }}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Insufficient staffing on those dates…"
                autoFocus
              />
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn btn-danger" onClick={handleRejectConfirm}>Reject</button>
                <button className="btn" onClick={() => { setRejectingId(null); setRejectReason(""); }}>Cancel</button>
              </div>
            </div>
          </>
        )}

        {/* Action toolbar */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          {canRequest && (
            <button className="btn btn-primary" onClick={() => { setShowForm((v) => !v); setMsg(null); setEditingId(null); }}>
              {showForm ? "Cancel" : "+ New Request"}
            </button>
          )}
          <div style={{ display: "flex", gap: 4 }}>
            {(["ALL", "PENDING", "APPROVED", "REJECTED"] as const).map((s) => (
              <button key={s} onClick={() => setFilter(s)} style={{
                padding: "5px 14px", borderRadius: 6, border: "1px solid var(--border)",
                fontSize: 12.5, fontWeight: 500, cursor: "pointer",
                background: filter === s ? "var(--steel)" : "var(--surface)",
                color: filter === s ? "#fff" : "var(--text-2)",
              }}>
                {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          <select className="form-select" style={{ width: "auto", minWidth: 160 }}
            value={deptFilter} onChange={(e) => setDeptFilter(e.target.value === "" ? "" : Number(e.target.value))}>
            <option value="">All departments</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <select className="form-select" style={{ width: "auto", minWidth: 180 }}
            value={empFilter} onChange={(e) => setEmpFilter(e.target.value === "" ? "" : Number(e.target.value))}>
            <option value="">All employees</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.nameEn}</option>)}
          </select>
          <input type="date" className="form-input" style={{ width: "auto" }}
            value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} title="From date" />
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>—</span>
          <input type="date" className="form-input" style={{ width: "auto" }}
            value={dateTo} onChange={(e) => setDateTo(e.target.value)} title="To date" />
          {(dateFrom || dateTo || deptFilter !== "" || empFilter !== "") && (
            <button className="btn" style={{ fontSize: 12 }} onClick={() => { setDateFrom(""); setDateTo(""); setDeptFilter(""); setEmpFilter(""); }}>
              Clear
            </button>
          )}
          <div style={{ marginLeft: "auto" }}>
            <ExportMenu data={exportData} columns={exportCols} filename="leave-requests" title="Leave Requests" subtitle="ZY Steel HR Dashboard" />
          </div>
        </div>

        {/* Create form */}
        {showForm && (
          <div className="panel">
            <div className="panel-head"><span className="panel-title">New Leave Request</span></div>
            <form onSubmit={handleCreate} className="panel-body">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <FieldLabel>Employee</FieldLabel>
                  <select className="form-select" required value={form.employeeId}
                    onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}>
                    <option value="">Select employee…</option>
                    {allowedEmployees.map((e) => (
                      <option key={e.id} value={e.id}>{e.nameEn} {e.employeeCode ? `(${e.employeeCode})` : ""}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <FieldLabel>Leave Type</FieldLabel>
                  <select className="form-select" value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                    {Object.entries(LEAVE_LABELS).map(([v, l]) => <option key={v} value={v}>{l} Leave</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 20 }}>
                  <input type="checkbox" id="halfDayNew" checked={form.halfDay}
                    onChange={(e) => setForm((f) => ({ ...f, halfDay: e.target.checked }))} />
                  <label htmlFor="halfDayNew" style={{ fontSize: 13, cursor: "pointer" }}>Half day</label>
                </div>
                <div>
                  <FieldLabel>Start Date</FieldLabel>
                  <input type="date" className="form-input" required value={form.startDate}
                    onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value, endDate: f.endDate || e.target.value }))} />
                </div>
                <div>
                  <FieldLabel>End Date</FieldLabel>
                  <input type="date" className="form-input" required value={form.endDate} min={form.startDate}
                    onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <FieldLabel>Reason (optional)</FieldLabel>
                  <textarea className="form-input" style={{ height: 70, resize: "vertical", paddingTop: 8 }}
                    value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                    placeholder="e.g. Family event, medical appointment…" />
                </div>
              </div>
              <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
                <button type="submit" className="btn btn-primary" disabled={isPending}>
                  {isPending ? <><span className="spinner" /> Saving…</> : "Submit Request"}
                </button>
                <button type="button" className="btn" onClick={() => { setShowForm(false); setForm(emptyForm); }}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Edit form */}
        {editingId !== null && (
          <div className="panel">
            <div className="panel-head"><span className="panel-title">Edit Leave Request</span></div>
            <form onSubmit={handleEdit} className="panel-body">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <FieldLabel>Leave Type</FieldLabel>
                  <select className="form-select" value={editForm.type}
                    onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value }))}>
                    {Object.entries(LEAVE_LABELS).map(([v, l]) => <option key={v} value={v}>{l} Leave</option>)}
                  </select>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 20 }}>
                  <input type="checkbox" id="halfDayEdit" checked={editForm.halfDay}
                    onChange={(e) => setEditForm((f) => ({ ...f, halfDay: e.target.checked }))} />
                  <label htmlFor="halfDayEdit" style={{ fontSize: 13, cursor: "pointer" }}>Half day</label>
                </div>
                <div>
                  <FieldLabel>Start Date</FieldLabel>
                  <input type="date" className="form-input" required value={editForm.startDate}
                    onChange={(e) => setEditForm((f) => ({ ...f, startDate: e.target.value }))} />
                </div>
                <div>
                  <FieldLabel>End Date</FieldLabel>
                  <input type="date" className="form-input" required value={editForm.endDate} min={editForm.startDate}
                    onChange={(e) => setEditForm((f) => ({ ...f, endDate: e.target.value }))} />
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <FieldLabel>Reason (optional)</FieldLabel>
                  <textarea className="form-input" style={{ height: 70, resize: "vertical", paddingTop: 8 }}
                    value={editForm.reason} onChange={(e) => setEditForm((f) => ({ ...f, reason: e.target.value }))} />
                </div>
              </div>
              <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
                <button type="submit" className="btn btn-primary" disabled={isPending}>
                  {isPending ? <><span className="spinner" /> Saving…</> : "Save Changes"}
                </button>
                <button type="button" className="btn" onClick={() => setEditingId(null)}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        {/* Requests table */}
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">Leave Requests</span>
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>{filtered.length} records</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-3)", fontSize: 13, border: "2px dashed var(--border)", margin: 20, borderRadius: 8 }}>
                No leave requests found
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Type</th>
                    <th>Period</th>
                    <th>Duration</th>
                    <th>Status</th>
                    <th>Reason</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const acting = actionMap.get(r.id);
                    return (
                      <tr key={r.id}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{r.employee.nameEn}</div>
                          <div style={{ fontSize: 11.5, color: "var(--text-3)" }}>
                            {r.employee.employeeCode && <span style={{ marginRight: 6 }}>{r.employee.employeeCode}</span>}
                            {r.employee.department?.name}
                          </div>
                        </td>
                        <td>
                          <span className="tag" style={TYPE_STYLE[r.type]}>{LEAVE_LABELS[r.type] ?? r.type}</span>
                        </td>
                        <td style={{ whiteSpace: "nowrap", fontSize: 13 }}>
                          {fmtShort(r.startDate)}
                          {r.startDate.slice(0, 10) !== r.endDate.slice(0, 10) && <> – {fmtShort(r.endDate)}</>}
                        </td>
                        <td style={{ fontSize: 13, color: "var(--text-2)" }}>
                          {calcDays(r.startDate, r.endDate, r.halfDay)}
                        </td>
                        <td>
                          <span className="tag" style={STATUS_STYLE[r.status]}>
                            {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
                          </span>
                          {r.status === "REJECTED" && r.rejectionReason && (
                            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }} title={r.rejectionReason}>
                              {r.rejectionReason.length > 40 ? r.rejectionReason.slice(0, 40) + "…" : r.rejectionReason}
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: 12.5, color: "var(--text-2)", maxWidth: 180 }}>
                          {r.reason || <span style={{ color: "var(--text-3)" }}>—</span>}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                            {/* Approve / Reject — HR_MANAGER / OWNER only */}
                            {canApprove && r.status === "PENDING" && (
                              <>
                                <button className="btn" disabled={!!acting}
                                  style={{ height: 28, padding: "0 10px", fontSize: 12, background: "var(--green-bg)", color: "var(--green)", borderColor: "var(--green-bg)" }}
                                  onClick={() => handleApprove(r.id)}>
                                  {acting === "approve" ? <span className="spinner" /> : "Approve"}
                                </button>
                                <button className="btn btn-danger" disabled={!!acting}
                                  style={{ height: 28, padding: "0 10px", fontSize: 12 }}
                                  onClick={() => { setRejectingId(r.id); setRejectReason(""); }}>
                                  Reject
                                </button>
                              </>
                            )}
                            {/* Edit — pending only */}
                            {(canRequest || canApprove) && r.status === "PENDING" && editingId !== r.id && (
                              <button className="btn" style={{ height: 28, padding: "0 10px", fontSize: 12 }}
                                onClick={() => startEdit(r)}>
                                Edit
                              </button>
                            )}
                            {/* Cancel — pending only */}
                            {(canRequest || canApprove) && r.status === "PENDING" && (
                              <button className="btn btn-danger" disabled={!!acting}
                                style={{ height: 28, padding: "0 10px", fontSize: 12, opacity: 0.85 }}
                                onClick={() => handleCancel(r.id)}>
                                {acting === "cancel" ? <span className="spinner" /> : "Cancel"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ── CALENDAR TAB ──────────────────────────────────────────────────── */}
      <div style={{ display: tab === "calendar" ? "block" : "none" }}>
        <CalendarTab rows={rows} employees={employees} departments={departments} />
      </div>

      {/* ── BALANCES TAB ──────────────────────────────────────────────────── */}
      <div style={{ display: tab === "balances" ? "block" : "none" }}>
        <BalancesTab departments={departments} canManage={canManage} />
      </div>

      {/* ── REPORTS TAB ───────────────────────────────────────────────────── */}
      <div style={{ display: tab === "reports" ? "block" : "none" }}>
        <ReportsTab rows={rows} departments={departments} />
      </div>
    </div>
  );
}
