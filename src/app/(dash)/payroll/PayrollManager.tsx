"use client";
import { useState, useTransition, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  runPayrollForPeriod, lockPeriod, exportPayrollCsv, getPayslips,
  createPayPeriod, updatePayPeriod, unlockPeriod,
  getPayrollPreview, savePayrollAdjustments, listPayrollHistory,
} from "@/actions/payroll";
import type { PeriodMgmtRow, PayrollPreviewRow, PayslipHistoryRow } from "@/actions/payroll";
import { ExportMenu } from "@/components/ExportMenu";

// ─── Local periodLabel (same as server version but client-side) ────────────────
function periodLabel(p: { name?: string | null; year: number; month: number; half: number }): string {
  if (p.name) return p.name;
  return `${p.year}-${String(p.month).padStart(2, "0")} ${p.half === 1 ? "1st Half" : "2nd Half"}`;
}

// ─── Types ─────────────────────────────────────────────────────────────────────

type Period = PeriodMgmtRow;

interface Payslip {
  id: string;
  employeeId: number;
  nameEn: string;
  nameKh: string;
  daysWorked: number;
  dailyRateUsd: number;
  baseUsd: number;
  overtimeUsd: number;
  bonusUsd: number;
  deductionUsd: number;
  grossUsd: number;
  netUsd: number;
  netKhr: number;
}

interface Props {
  periods: Period[];
  canRun: boolean;
  canLock: boolean;
  canExport: boolean;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtShort(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}
function fmtUsd(n: number): string { return `$${n.toFixed(2)}`; }

function daysUntil(iso: string): number {
  const target = new Date(iso); target.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

function periodStatus(p: Period): { label: string; style: React.CSSProperties } {
  if (p.locked) return { label: "Closed", style: { color: "var(--green)", background: "var(--green-bg)" } };
  return { label: "Open", style: { color: "var(--amber)", background: "var(--amber-bg)" } };
}

function autoStartEnd(year: number, month: number, half: number) {
  const lastDay = new Date(year, month, 0).getDate();
  const start = half === 1 ? `${year}-${String(month).padStart(2, "0")}-01` : `${year}-${String(month).padStart(2, "0")}-16`;
  const end   = half === 1 ? `${year}-${String(month).padStart(2, "0")}-15` : `${year}-${String(month).padStart(2, "0")}-${lastDay}`;
  return { start, end };
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

const emptyForm = {
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  half: 2 as 1 | 2,
  startDate: "",
  endDate: "",
  workingDays: 13,
  name: "",
  payrollDate: "",
  notes: "",
};

// ─── PeriodsTab ────────────────────────────────────────────────────────────────

function PeriodsTab({ periods, canRun, canLock, isPending, startTransition }: {
  periods: Period[];
  canRun: boolean;
  canLock: boolean;
  isPending: boolean;
  startTransition: (fn: () => Promise<void>) => void;
}) {
  const router = useRouter();
  const [showForm, setShowForm]     = useState(false);
  const [editingId, setEditingId]   = useState<number | null>(null);
  const [form, setForm]             = useState(emptyForm);
  const [editForm, setEditForm]     = useState({ name: "", payrollDate: "", notes: "" });
  const [msg, setMsg]               = useState<{ ok: boolean; text: string } | null>(null);

  function updateFormDates(year: number, month: number, half: 1 | 2) {
    const { start, end } = autoStartEnd(year, month, half);
    setForm((f) => ({ ...f, year, month, half, startDate: start, endDate: end }));
  }

  function initForm() {
    const y = emptyForm.year, m = emptyForm.month, h = emptyForm.half;
    const { start, end } = autoStartEnd(y, m, h);
    setForm({ ...emptyForm, startDate: start, endDate: end });
    setShowForm(true);
    setMsg(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setMsg(null);
    startTransition(async () => {
      const res = await createPayPeriod({
        year: form.year, month: form.month, half: form.half,
        startDate: form.startDate, endDate: form.endDate,
        workingDays: form.workingDays,
        name: form.name || null, payrollDate: form.payrollDate || null, notes: form.notes || null,
      });
      if (res.ok) {
        setMsg({ ok: true, text: "Pay period created." });
        setShowForm(false);
        setForm(emptyForm);
        router.refresh();
      } else {
        setMsg({ ok: false, text: "error" in res ? res.error : "Unknown error" });
      }
    });
  }

  function startEdit(p: Period) {
    setEditingId(p.id);
    setEditForm({
      name: p.name ?? "",
      payrollDate: p.payrollDate ? p.payrollDate.slice(0, 10) : "",
      notes: p.notes ?? "",
    });
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault(); if (editingId === null) return;
    setMsg(null);
    startTransition(async () => {
      const res = await updatePayPeriod(editingId, {
        name: editForm.name || null,
        payrollDate: editForm.payrollDate || null,
        notes: editForm.notes || null,
      });
      if (res.ok) {
        setMsg({ ok: true, text: "Period updated." });
        setEditingId(null);
        router.refresh();
      } else {
        setMsg({ ok: false, text: "error" in res ? res.error : "Unknown error" });
      }
    });
  }

  async function handleLock(id: number) {
    if (!confirm("Close this period? Payslips will become immutable.")) return;
    setMsg(null);
    startTransition(async () => {
      const res = await lockPeriod(id);
      if (res.ok) { setMsg({ ok: true, text: "Period closed." }); router.refresh(); }
      else setMsg({ ok: false, text: "error" in res ? res.error : "Unknown error" });
    });
  }

  async function handleUnlock(id: number) {
    if (!confirm("Reopen this period? Payslips will become editable again.")) return;
    setMsg(null);
    startTransition(async () => {
      const res = await unlockPeriod(id);
      if (res.ok) { setMsg({ ok: true, text: "Period reopened." }); router.refresh(); }
      else setMsg({ ok: false, text: "error" in res ? res.error : "Unknown error" });
    });
  }

  const exportData = useMemo(() => periods.map((p) => ({
    name: periodLabel(p),
    startDate: fmtShort(p.startDate),
    endDate: fmtShort(p.endDate),
    workingDays: p.workingDays,
    payrollDate: fmtDate(p.payrollDate),
    status: p.locked ? "Closed" : "Open",
    payslips: p.payslipCount,
    notes: p.notes ?? "",
  })), [periods]);

  const exportCols = [
    { header: "Period", key: "name", width: 22 },
    { header: "Start", key: "startDate", width: 12 },
    { header: "End", key: "endDate", width: 12 },
    { header: "Working Days", key: "workingDays", width: 13 },
    { header: "Payroll Date", key: "payrollDate", width: 14 },
    { header: "Status", key: "status", width: 10 },
    { header: "Payslips", key: "payslips", width: 10 },
    { header: "Notes", key: "notes", width: 30 },
  ];

  const upcoming = useMemo(() => {
    return periods
      .filter((p) => !p.locked && p.payrollDate)
      .map((p) => ({ ...p, daysLeft: daysUntil(p.payrollDate!) }))
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 3);
  }, [periods]);

  const openCount   = periods.filter((p) => !p.locked).length;
  const closedCount = periods.filter((p) => p.locked).length;
  const nextPayroll = upcoming[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <div className="kpi-card">
          <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500, marginBottom: 6 }}>Total Periods</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text)" }}>{periods.length}</div>
        </div>
        <div className="kpi-card">
          <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500, marginBottom: 6 }}>Open</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: openCount > 0 ? "var(--amber)" : "var(--text)" }}>{openCount}</div>
        </div>
        <div className="kpi-card">
          <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500, marginBottom: 6 }}>Closed</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--green)" }}>{closedCount}</div>
        </div>
        <div className="kpi-card">
          <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500, marginBottom: 6 }}>Next Payroll</div>
          {nextPayroll ? (
            <>
              <div style={{ fontSize: 20, fontWeight: 800, color: nextPayroll.daysLeft <= 3 ? "var(--amber)" : "var(--text)" }}>
                {nextPayroll.daysLeft === 0 ? "Today!" : nextPayroll.daysLeft < 0 ? `${Math.abs(nextPayroll.daysLeft)}d overdue` : `In ${nextPayroll.daysLeft}d`}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 3 }}>{fmtShort(nextPayroll.payrollDate!)}</div>
            </>
          ) : (
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-3)" }}>—</div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        {canRun && (
          <button className="btn btn-primary" onClick={initForm}>
            + New Period
          </button>
        )}
        <div style={{ marginLeft: "auto" }}>
          <ExportMenu data={exportData} columns={exportCols} filename="pay-periods" title="Pay Period History" subtitle="ZY Steel HR Dashboard" />
        </div>
      </div>

      {msg && (
        <div style={{ padding: "10px 14px", borderRadius: 8, fontSize: 13, background: msg.ok ? "var(--green-bg)" : "var(--red-bg)", color: msg.ok ? "var(--green)" : "var(--red)" }}>
          {msg.text}
        </div>
      )}

      {showForm && (
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">New Pay Period</span>
          </div>
          <form onSubmit={handleCreate} className="panel-body">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              <div>
                <FieldLabel>Year</FieldLabel>
                <select className="form-select" value={form.year}
                  onChange={(e) => updateFormDates(Number(e.target.value), form.month, form.half)}>
                  {[2024, 2025, 2026, 2027, 2028].map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>Month</FieldLabel>
                <select className="form-select" value={form.month}
                  onChange={(e) => updateFormDates(form.year, Number(e.target.value), form.half)}>
                  {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <FieldLabel>Half</FieldLabel>
                <select className="form-select" value={form.half}
                  onChange={(e) => updateFormDates(form.year, form.month, Number(e.target.value) as 1 | 2)}>
                  <option value={1}>1st Half (1–15)</option>
                  <option value={2}>2nd Half (16–end)</option>
                </select>
              </div>
              <div>
                <FieldLabel>Start Date</FieldLabel>
                <input type="date" className="form-input" required value={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div>
                <FieldLabel>End Date</FieldLabel>
                <input type="date" className="form-input" required value={form.endDate} min={form.startDate}
                  onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
              </div>
              <div>
                <FieldLabel>Working Days</FieldLabel>
                <input type="number" className="form-input" min={0} max={31} required value={form.workingDays}
                  onChange={(e) => setForm((f) => ({ ...f, workingDays: Number(e.target.value) }))} />
              </div>
              <div>
                <FieldLabel>Period Name (optional)</FieldLabel>
                <input type="text" className="form-input" placeholder="e.g. June 2026 – 2nd Half"
                  value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <FieldLabel>Payroll Date</FieldLabel>
                <input type="date" className="form-input" value={form.payrollDate}
                  onChange={(e) => setForm((f) => ({ ...f, payrollDate: e.target.value }))} />
              </div>
              <div />
              <div style={{ gridColumn: "1 / -1" }}>
                <FieldLabel>Notes (optional)</FieldLabel>
                <textarea className="form-input" style={{ height: 60, resize: "vertical", paddingTop: 8 }}
                  value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="e.g. Holiday bonus included…" />
              </div>
            </div>
            <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                {isPending ? <><span className="spinner" /> Saving…</> : "Create Period"}
              </button>
              <button type="button" className="btn" onClick={() => { setShowForm(false); setMsg(null); }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {editingId !== null && (
        <div className="panel">
          <div className="panel-head"><span className="panel-title">Edit Period</span></div>
          <form onSubmit={handleUpdate} className="panel-body">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <FieldLabel>Period Name (optional)</FieldLabel>
                <input type="text" className="form-input" placeholder="Leave blank to auto-generate"
                  value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <FieldLabel>Payroll Date</FieldLabel>
                <input type="date" className="form-input" value={editForm.payrollDate}
                  onChange={(e) => setEditForm((f) => ({ ...f, payrollDate: e.target.value }))} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <FieldLabel>Notes</FieldLabel>
                <textarea className="form-input" style={{ height: 60, resize: "vertical", paddingTop: 8 }}
                  value={editForm.notes} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginTop: 16, display: "flex", gap: 10 }}>
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                {isPending ? <><span className="spinner" /> Saving…</> : "Save"}
              </button>
              <button type="button" className="btn" onClick={() => setEditingId(null)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Pay Period History</span>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>{periods.length} periods</span>
        </div>
        {periods.length === 0 ? (
          <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
            No pay periods yet.
            {canRun && <> Click <strong>+ New Period</strong> to create the first one.</>}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Dates</th>
                  <th>Working Days</th>
                  <th>Payroll Date</th>
                  <th>Status</th>
                  <th>Payslips</th>
                  <th>Notes</th>
                  {(canRun || canLock) && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {periods.map((p) => {
                  const status = periodStatus(p);
                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{periodLabel(p)}</div>
                        <div style={{ fontSize: 11, color: "var(--text-3)" }}>Created {fmtShort(p.createdAt)}</div>
                      </td>
                      <td style={{ whiteSpace: "nowrap", fontSize: 13 }}>
                        {fmtShort(p.startDate)} – {fmtShort(p.endDate)}
                      </td>
                      <td style={{ fontSize: 13, color: "var(--text-2)" }}>{p.workingDays}</td>
                      <td style={{ whiteSpace: "nowrap", fontSize: 13 }}>
                        {p.payrollDate ? (
                          <>
                            {fmtShort(p.payrollDate)}
                            {!p.locked && (() => {
                              const d = daysUntil(p.payrollDate!);
                              return (
                                <div style={{ fontSize: 10.5, color: d < 0 ? "var(--red)" : d <= 3 ? "var(--amber)" : "var(--text-3)", marginTop: 1 }}>
                                  {d === 0 ? "Today" : d < 0 ? `${Math.abs(d)}d overdue` : `In ${d} days`}
                                </div>
                              );
                            })()}
                          </>
                        ) : (
                          <span style={{ color: "var(--text-3)" }}>—</span>
                        )}
                      </td>
                      <td>
                        <span className="tag" style={status.style}>{status.label}</span>
                      </td>
                      <td style={{ fontSize: 13, color: p.payslipCount > 0 ? "var(--text)" : "var(--text-3)" }}>
                        {p.payslipCount > 0 ? p.payslipCount : "—"}
                      </td>
                      <td style={{ fontSize: 12.5, color: "var(--text-2)", maxWidth: 200 }}>
                        {p.notes ? (
                          <span title={p.notes}>{p.notes.length > 60 ? p.notes.slice(0, 60) + "…" : p.notes}</span>
                        ) : (
                          <span style={{ color: "var(--text-3)" }}>—</span>
                        )}
                      </td>
                      {(canRun || canLock) && (
                        <td>
                          <div style={{ display: "flex", gap: 5 }}>
                            {canRun && editingId !== p.id && (
                              <button className="btn" style={{ height: 28, padding: "0 10px", fontSize: 12 }}
                                onClick={() => startEdit(p)}>
                                Edit
                              </button>
                            )}
                            {canLock && !p.locked && p.payslipCount > 0 && (
                              <button className="btn" style={{ height: 28, padding: "0 10px", fontSize: 12 }}
                                disabled={isPending} onClick={() => handleLock(p.id)}>
                                Close
                              </button>
                            )}
                            {canLock && p.locked && (
                              <button className="btn btn-danger" style={{ height: 28, padding: "0 10px", fontSize: 12, opacity: 0.85 }}
                                disabled={isPending} onClick={() => handleUnlock(p.id)}>
                                Reopen
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {upcoming.length > 0 && (
        <div className="panel">
          <div className="panel-head"><span className="panel-title">Upcoming Payroll Schedule</span></div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {upcoming.map((p) => (
              <div key={p.id} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "12px 20px", borderBottom: "1px solid var(--border)",
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{periodLabel(p)}</div>
                  <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
                    {fmtShort(p.startDate)} – {fmtShort(p.endDate)} · {p.workingDays} working days
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: p.daysLeft <= 3 ? "var(--amber)" : "var(--text)" }}>
                    {fmtDate(p.payrollDate!)}
                  </div>
                  <div style={{ fontSize: 12, color: p.daysLeft < 0 ? "var(--red)" : p.daysLeft <= 3 ? "var(--amber)" : "var(--text-3)", marginTop: 2 }}>
                    {p.daysLeft === 0 ? "Today!" : p.daysLeft < 0 ? `${Math.abs(p.daysLeft)} days overdue` : `In ${p.daysLeft} days`}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── RunPayrollTab ─────────────────────────────────────────────────────────────

function RunPayrollTab({ periods, canRun, canLock, canExport, isPending, startTransition }: {
  periods: Period[];
  canRun: boolean;
  canLock: boolean;
  canExport: boolean;
  isPending: boolean;
  startTransition: (fn: () => Promise<void>) => void;
}) {
  const [selectedId, setSelectedId]         = useState<number | null>(periods[0]?.id ?? null);
  const [payslips, setPayslips]             = useState<Payslip[]>([]);
  const [loaded, setLoaded]                 = useState(false);
  const [preview, setPreview]               = useState<PayrollPreviewRow[]>([]);
  const [previewLoaded, setPreviewLoaded]   = useState(false);
  const [adjEdits, setAdjEdits]             = useState<Record<number, { bonus: string; deduction: string }>>({});
  const [adjSaved, setAdjSaved]             = useState(false);
  const [msg, setMsg]                       = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [showAdj, setShowAdj]               = useState(false);

  const period = periods.find((p) => p.id === selectedId);

  const loadPreview = useCallback((id: number) => {
    startTransition(async () => {
      const res = await getPayrollPreview(id);
      if (res.ok) {
        setPreview(res.data);
        const init: Record<number, { bonus: string; deduction: string }> = {};
        for (const r of res.data) {
          init[r.employeeId] = { bonus: r.bonusUsd.toFixed(2), deduction: r.deductionUsd.toFixed(2) };
        }
        setAdjEdits(init);
        setAdjSaved(false);
      }
      setPreviewLoaded(true);
    });
  }, [startTransition]);

  function loadPayslips(id: number) {
    startTransition(async () => {
      const rows = await getPayslips(id);
      setPayslips(rows.map((r) => ({
        id: String(r.id),
        employeeId: r.employeeId,
        nameEn: r.employee.nameEn,
        nameKh: r.employee.nameKh,
        daysWorked: Number(r.daysWorked),
        dailyRateUsd: Number(r.dailyRateUsd),
        baseUsd: Number(r.baseUsd),
        overtimeUsd: Number(r.overtimeUsd),
        bonusUsd: Number(r.bonusUsd),
        deductionUsd: Number(r.deductionUsd),
        grossUsd: Number(r.grossUsd),
        netUsd: Number(r.netUsd),
        netKhr: Number(r.netKhr),
      })));
      setLoaded(true);
    });
  }

  function selectPeriod(id: number) {
    setSelectedId(id);
    setLoaded(false);
    setPayslips([]);
    setPreviewLoaded(false);
    setPreview([]);
    setMsg(null);
    setShowAdj(false);
    setAdjSaved(false);
    loadPreview(id);
    loadPayslips(id);
  }

  // Load first period on mount
  useEffect(() => {
    if (selectedId) {
      loadPreview(selectedId);
      loadPayslips(selectedId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleAdjChange(empId: number, field: "bonus" | "deduction", val: string) {
    setAdjEdits((prev) => ({ ...prev, [empId]: { ...prev[empId], [field]: val } }));
    setAdjSaved(false);
  }

  async function saveAdjustments() {
    if (!selectedId || !period || period.locked) return;
    setMsg(null);
    const items = Object.entries(adjEdits).map(([empIdStr, v]) => ({
      employeeId: Number(empIdStr),
      bonusUsd: parseFloat(v.bonus) || 0,
      deductionUsd: parseFloat(v.deduction) || 0,
      note: "",
    }));
    startTransition(async () => {
      const res = await savePayrollAdjustments(selectedId, items);
      if (res.ok) {
        setMsg({ type: "ok", text: "Adjustments saved." });
        setAdjSaved(true);
        loadPreview(selectedId);
      } else {
        setMsg({ type: "err", text: "error" in res ? res.error : "Save failed" });
      }
    });
  }

  function doRunPayroll() {
    if (!selectedId) return;
    setMsg(null);
    startTransition(async () => {
      const res = await runPayrollForPeriod(selectedId);
      if ("error" in res) { setMsg({ type: "err", text: res.error }); return; }
      setMsg({ type: "ok", text: `Run complete: ${res.data.count} payslips · gross ${fmtUsd(res.data.grossUsd)}` });
      loadPayslips(selectedId);
      loadPreview(selectedId);
    });
  }

  function doLock() {
    if (!selectedId || !confirm("Close this period? Payslips will be immutable after closing.")) return;
    startTransition(async () => {
      const res = await lockPeriod(selectedId);
      if ("error" in res) { setMsg({ type: "err", text: res.error }); return; }
      setMsg({ type: "ok", text: "Period closed successfully." });
    });
  }

  function exportCsv() {
    if (!selectedId) return;
    startTransition(async () => {
      const res = await exportPayrollCsv(selectedId);
      if ("error" in res) { setMsg({ type: "err", text: res.error }); return; }
      const blob = new Blob([res.data.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = res.data.filename; a.click();
      URL.revokeObjectURL(url);
    });
  }

  const totalGross = payslips.reduce((a, p) => a + p.grossUsd, 0);
  const totalNet   = payslips.reduce((a, p) => a + p.netUsd, 0);
  const totalKhr   = payslips.reduce((a, p) => a + p.netKhr, 0);

  const payslipExportData = useMemo(() => payslips.map((p) => ({
    employee: p.nameEn,
    nameKh: p.nameKh,
    daysWorked: p.daysWorked,
    dailyRate: p.dailyRateUsd,
    base: p.baseUsd,
    overtime: p.overtimeUsd,
    bonus: p.bonusUsd,
    deduction: p.deductionUsd,
    gross: p.grossUsd,
    netUsd: p.netUsd,
    netKhr: p.netKhr,
  })), [payslips]);

  const payslipExportCols = [
    { header: "Employee", key: "employee", width: 22 },
    { header: "Days", key: "daysWorked", width: 8 },
    { header: "Rate/Day", key: "dailyRate", width: 12 },
    { header: "Base", key: "base", width: 12 },
    { header: "OT", key: "overtime", width: 10 },
    { header: "Bonus", key: "bonus", width: 10 },
    { header: "Deduction", key: "deduction", width: 10 },
    { header: "Gross (USD)", key: "gross", width: 12 },
    { header: "Net (USD)", key: "netUsd", width: 12 },
    { header: "Net (KHR)", key: "netKhr", width: 14 },
  ];

  const noAttendanceWarning = previewLoaded && preview.filter((r) => !r.hasAttendance);

  if (periods.length === 0) {
    return (
      <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-3)", fontSize: 13, border: "2px dashed var(--border)", borderRadius: 8 }}>
        No pay periods exist yet. Create one in the <strong>Periods</strong> tab first.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Period selector */}
      <div className="panel">
        <div className="panel-head"><span className="panel-title">Select Period</span></div>
        <div>
          {periods.map((p, i) => {
            const active = p.id === selectedId;
            const status = periodStatus(p);
            return (
              <button key={p.id} onClick={() => selectPeriod(p.id)} style={{
                display: "flex", width: "100%", alignItems: "center", justifyContent: "space-between",
                padding: "11px 20px", fontSize: 13,
                background: active ? "var(--steel-light)" : "transparent",
                borderBottom: i < periods.length - 1 ? "1px solid var(--border)" : "none",
                border: "none", borderTop: "none", borderLeft: "none", borderRight: "none",
                cursor: "pointer", textAlign: "left",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.locked ? "var(--green)" : "var(--amber)", flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 500, color: active ? "var(--steel)" : "var(--text)" }}>{periodLabel(p)}</div>
                    <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                      {fmtShort(p.startDate)} – {fmtShort(p.endDate)}
                      {p.payrollDate && ` · Payroll: ${fmtShort(p.payrollDate)}`}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {p.payslipCount > 0 && (
                    <span style={{ fontSize: 11, color: "var(--text-3)" }}>{p.payslipCount} payslips</span>
                  )}
                  <span className="tag" style={status.style}>{status.label}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Attendance completeness warning */}
      {noAttendanceWarning && noAttendanceWarning.length > 0 && (
        <div style={{ padding: "10px 14px", borderRadius: 8, background: "var(--amber-bg)", color: "var(--amber)", fontSize: 13, borderLeft: "4px solid var(--amber)" }}>
          <strong>Attendance missing</strong> for {noAttendanceWarning.length} employee{noAttendanceWarning.length > 1 ? "s" : ""}:{" "}
          {noAttendanceWarning.map((r) => r.nameEn).join(", ")} — they will be computed as 0 days worked.
        </div>
      )}

      {/* Adjustments panel */}
      {period && !period.locked && previewLoaded && preview.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">Bonus / Deduction Adjustments</span>
            <button
              className="btn"
              style={{ height: 28, padding: "0 10px", fontSize: 12 }}
              onClick={() => setShowAdj((v) => !v)}
            >
              {showAdj ? "Hide" : "Show"}
            </button>
          </div>
          {showAdj && (
            <div>
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Dept</th>
                      <th style={{ textAlign: "right" }}>Days</th>
                      <th style={{ textAlign: "right" }}>OT</th>
                      <th style={{ textAlign: "right", width: 120 }}>Bonus (USD)</th>
                      <th style={{ textAlign: "right", width: 120 }}>Deduction (USD)</th>
                      <th style={{ textAlign: "right" }}>Est. Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r) => {
                      const adj = adjEdits[r.employeeId] ?? { bonus: "0.00", deduction: "0.00" };
                      const bonus = parseFloat(adj.bonus) || 0;
                      const deduction = parseFloat(adj.deduction) || 0;
                      const base = Math.round(r.dailyRateUsd * r.daysWorked * 100) / 100;
                      const gross = Math.round((base + r.overtimeUsd + bonus) * 100) / 100;
                      const net = Math.round((gross - deduction) * 100) / 100;
                      return (
                        <tr key={r.employeeId}>
                          <td>
                            <div style={{ fontWeight: 500, fontSize: 13 }}>{r.nameEn}</div>
                            <div style={{ fontSize: 11, color: "var(--text-3)" }}>{r.nameKh}</div>
                          </td>
                          <td style={{ fontSize: 12, color: "var(--text-2)" }}>{r.departmentName ?? "—"}</td>
                          <td className="num" style={{ color: !r.hasAttendance ? "var(--amber)" : undefined }}>
                            {r.daysWorked}
                          </td>
                          <td className="num">{fmtUsd(r.overtimeUsd)}</td>
                          <td style={{ textAlign: "right" }}>
                            <input
                              type="number" step="0.01" min="0"
                              value={adj.bonus}
                              onChange={(e) => handleAdjChange(r.employeeId, "bonus", e.target.value)}
                              style={{ width: 100, textAlign: "right", padding: "3px 6px", border: "1px solid var(--border)", borderRadius: 4, fontSize: 13 }}
                            />
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <input
                              type="number" step="0.01" min="0"
                              value={adj.deduction}
                              onChange={(e) => handleAdjChange(r.employeeId, "deduction", e.target.value)}
                              style={{ width: 100, textAlign: "right", padding: "3px 6px", border: "1px solid var(--border)", borderRadius: 4, fontSize: 13 }}
                            />
                          </td>
                          <td className="num" style={{ fontWeight: 600, color: net < 0 ? "var(--red)" : undefined }}>
                            {fmtUsd(net)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ padding: "12px 20px", display: "flex", alignItems: "center", gap: 10 }}>
                <button className="btn btn-primary" onClick={saveAdjustments} disabled={isPending}>
                  {isPending ? <><span className="spinner" /> Saving…</> : "Save Adjustments"}
                </button>
                {adjSaved && <span style={{ fontSize: 13, color: "var(--green)" }}>Saved ✓</span>}
                <span style={{ fontSize: 12, color: "var(--text-3)", marginLeft: 8 }}>
                  Adjustments are applied when you click Run Payroll.
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action bar */}
      {period && (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
          {canRun && !period.locked && (
            <button onClick={doRunPayroll} disabled={isPending} className="btn btn-primary">
              {isPending ? <><span className="spinner" />Running…</> : "Run Payroll"}
            </button>
          )}
          {canLock && !period.locked && payslips.length > 0 && (
            <button onClick={doLock} disabled={isPending} className="btn">
              Close Period
            </button>
          )}
          {canExport && payslips.length > 0 && (
            <>
              <button onClick={exportCsv} disabled={isPending} className="btn">
                ↓ CSV
              </button>
              <ExportMenu
                data={payslipExportData}
                columns={payslipExportCols}
                filename={`payroll-${periodLabel(period).replace(/\s/g, "-")}`}
                title={`Payroll — ${periodLabel(period)}`}
                subtitle="ZY Steel HR Dashboard"
              />
            </>
          )}
          {msg && (
            <p style={{ fontSize: 13, color: msg.type === "ok" ? "var(--green)" : "var(--red)" }}>{msg.text}</p>
          )}
        </div>
      )}

      {/* Payslips table */}
      {loaded && (
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">
              Payslips{payslips.length > 0 ? ` — ${payslips.length} employees` : ""}
            </span>
            {period && (
              <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                {periodLabel(period)} · {period.workingDays} working days
              </span>
            )}
          </div>
          {payslips.length === 0 ? (
            <div className="panel-body">
              <p style={{ fontSize: 13, color: "var(--text-3)", textAlign: "center", padding: "24px 0" }}>
                No payslips yet. Click <strong>Run Payroll</strong> to generate them.
              </p>
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th style={{ textAlign: "right" }}>Days</th>
                    <th style={{ textAlign: "right" }}>Rate/day</th>
                    <th style={{ textAlign: "right" }}>Base</th>
                    <th style={{ textAlign: "right" }}>OT</th>
                    <th style={{ textAlign: "right" }}>Bonus</th>
                    <th style={{ textAlign: "right" }}>Deduction</th>
                    <th style={{ textAlign: "right" }}>Gross</th>
                    <th style={{ textAlign: "right", fontWeight: 700 }}>Net (USD)</th>
                    <th style={{ textAlign: "right", fontWeight: 700 }}>Net (KHR)</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {payslips.map((p) => (
                    <tr key={p.employeeId}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{p.nameEn}</div>
                        <div style={{ fontSize: 11, color: "var(--text-3)" }}>{p.nameKh}</div>
                      </td>
                      <td className="num">{p.daysWorked}</td>
                      <td className="num" style={{ color: "var(--text-2)" }}>{fmtUsd(p.dailyRateUsd)}</td>
                      <td className="num">{fmtUsd(p.baseUsd)}</td>
                      <td className="num">{fmtUsd(p.overtimeUsd)}</td>
                      <td className="num" style={{ color: "var(--text-2)" }}>{fmtUsd(p.bonusUsd)}</td>
                      <td className="num" style={{ color: "var(--red)" }}>
                        {p.deductionUsd > 0 ? `-${fmtUsd(p.deductionUsd)}` : "—"}
                      </td>
                      <td className="num">{fmtUsd(p.grossUsd)}</td>
                      <td className="num" style={{ fontWeight: 600 }}>{fmtUsd(p.netUsd)}</td>
                      <td className="num" style={{ fontWeight: 600 }}>{p.netKhr.toLocaleString()}&#x17DB;</td>
                      <td style={{ textAlign: "right", paddingRight: 12 }}>
                        <Link
                          href={`/print/payslip/${p.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: 12, color: "var(--steel)", textDecoration: "none", whiteSpace: "nowrap" }}
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3}>Total ({payslips.length})</td>
                    <td className="num">{fmtUsd(payslips.reduce((a, p) => a + p.baseUsd, 0))}</td>
                    <td className="num">{fmtUsd(payslips.reduce((a, p) => a + p.overtimeUsd, 0))}</td>
                    <td className="num">{fmtUsd(payslips.reduce((a, p) => a + p.bonusUsd, 0))}</td>
                    <td className="num" style={{ color: "var(--red)" }}>
                      -{fmtUsd(payslips.reduce((a, p) => a + p.deductionUsd, 0))}
                    </td>
                    <td className="num">{fmtUsd(totalGross)}</td>
                    <td className="num" style={{ fontWeight: 700 }}>{fmtUsd(totalNet)}</td>
                    <td className="num" style={{ fontWeight: 700 }}>{totalKhr.toLocaleString()}&#x17DB;</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── HistoryTab ────────────────────────────────────────────────────────────────

function HistoryTab({ periods, canExport, isPending, startTransition }: {
  periods: Period[];
  canExport: boolean;
  isPending: boolean;
  startTransition: (fn: () => Promise<void>) => void;
}) {
  const [rows, setRows]           = useState<PayslipHistoryRow[]>([]);
  const [loaded, setLoaded]       = useState(false);
  const [search, setSearch]       = useState("");
  const [filterPeriod, setFilterPeriod] = useState<string>("");
  const [filterFinal, setFilterFinal]   = useState<string>("");

  useEffect(() => {
    startTransition(async () => {
      const res = await listPayrollHistory();
      if (res.ok) setRows(res.data);
      setLoaded(true);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    let out = rows;
    if (filterPeriod) out = out.filter((r) => String(r.periodId) === filterPeriod);
    if (filterFinal === "finalized") out = out.filter((r) => r.finalized);
    if (filterFinal === "draft") out = out.filter((r) => !r.finalized);
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter((r) =>
        r.nameEn.toLowerCase().includes(q) ||
        r.nameKh.toLowerCase().includes(q) ||
        (r.departmentName ?? "").toLowerCase().includes(q) ||
        r.periodLabel.toLowerCase().includes(q)
      );
    }
    return out;
  }, [rows, filterPeriod, filterFinal, search]);

  const totalGross = filtered.reduce((a, r) => a + r.grossUsd, 0);
  const totalNet   = filtered.reduce((a, r) => a + r.netUsd, 0);

  const exportData = useMemo(() => filtered.map((r) => ({
    period: r.periodLabel,
    employee: r.nameEn,
    nameKh: r.nameKh,
    department: r.departmentName ?? "",
    daysWorked: r.daysWorked,
    base: r.baseUsd,
    overtime: r.overtimeUsd,
    bonus: r.bonusUsd,
    deduction: r.deductionUsd,
    gross: r.grossUsd,
    netUsd: r.netUsd,
    netKhr: r.netKhr,
    status: r.finalized ? "Finalized" : "Draft",
  })), [filtered]);

  const exportCols = [
    { header: "Period", key: "period", width: 20 },
    { header: "Employee", key: "employee", width: 22 },
    { header: "Name (KH)", key: "nameKh", width: 18 },
    { header: "Department", key: "department", width: 16 },
    { header: "Days", key: "daysWorked", width: 8 },
    { header: "Base USD", key: "base", width: 12 },
    { header: "OT USD", key: "overtime", width: 10 },
    { header: "Bonus USD", key: "bonus", width: 10 },
    { header: "Deduction USD", key: "deduction", width: 12 },
    { header: "Gross USD", key: "gross", width: 12 },
    { header: "Net USD", key: "netUsd", width: 12 },
    { header: "Net KHR", key: "netKhr", width: 14 },
    { header: "Status", key: "status", width: 10 },
  ];

  // Unique periods from history for filter dropdown
  const periodOptions = useMemo(() => {
    const seen = new Map<number, string>();
    for (const r of rows) seen.set(r.periodId, r.periodLabel);
    return Array.from(seen.entries()).sort((a, b) => b[0] - a[0]);
  }, [rows]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Summary KPIs */}
      {loaded && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
          <div className="kpi-card">
            <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500, marginBottom: 6 }}>Total Payslips</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "var(--text)" }}>{rows.length}</div>
          </div>
          <div className="kpi-card">
            <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500, marginBottom: 6 }}>Finalized</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: "var(--green)" }}>{rows.filter((r) => r.finalized).length}</div>
          </div>
          <div className="kpi-card">
            <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500, marginBottom: 6 }}>Showing / Gross</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)" }}>{fmtUsd(totalGross)}</div>
            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 3 }}>{filtered.length} payslips</div>
          </div>
          <div className="kpi-card">
            <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500, marginBottom: 6 }}>Showing / Net</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--steel)" }}>{fmtUsd(totalNet)}</div>
            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 3 }}>USD</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          type="text"
          className="form-input"
          placeholder="Search employee or department…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 260 }}
        />
        <select
          className="form-select"
          value={filterPeriod}
          onChange={(e) => setFilterPeriod(e.target.value)}
          style={{ maxWidth: 200 }}
        >
          <option value="">All periods</option>
          {periodOptions.map(([id, label]) => (
            <option key={id} value={String(id)}>{label}</option>
          ))}
        </select>
        <select
          className="form-select"
          value={filterFinal}
          onChange={(e) => setFilterFinal(e.target.value)}
          style={{ maxWidth: 140 }}
        >
          <option value="">All statuses</option>
          <option value="finalized">Finalized</option>
          <option value="draft">Draft</option>
        </select>
        {(search || filterPeriod || filterFinal) && (
          <button className="btn" style={{ height: 32, padding: "0 12px", fontSize: 12 }}
            onClick={() => { setSearch(""); setFilterPeriod(""); setFilterFinal(""); }}>
            Clear
          </button>
        )}
        {canExport && filtered.length > 0 && (
          <div style={{ marginLeft: "auto" }}>
            <ExportMenu
              data={exportData}
              columns={exportCols}
              filename="payroll-history"
              title="Payroll History"
              subtitle="ZY Steel HR Dashboard"
            />
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Payroll History</span>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>
            {!loaded ? "Loading…" : `${filtered.length} of ${rows.length} payslips`}
          </span>
        </div>
        {!loaded ? (
          <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
            <span className="spinner" /> Loading history…
          </div>
        ) : rows.length === 0 ? (
          <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
            No payslips found. Run payroll for a period to generate them.
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
            No payslips match the current filters.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Employee</th>
                  <th>Dept</th>
                  <th style={{ textAlign: "right" }}>Days</th>
                  <th style={{ textAlign: "right" }}>Gross</th>
                  <th style={{ textAlign: "right" }}>Net (USD)</th>
                  <th style={{ textAlign: "right" }}>Net (KHR)</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: "nowrap", fontSize: 13 }}>
                      <div style={{ fontWeight: 500 }}>{r.periodLabel}</div>
                      <div style={{ fontSize: 11, color: "var(--text-3)" }}>{fmtDate(r.createdAt)}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{r.nameEn}</div>
                      <div style={{ fontSize: 11, color: "var(--text-3)" }}>{r.nameKh}</div>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-2)" }}>{r.departmentName ?? "—"}</td>
                    <td className="num">{r.daysWorked}</td>
                    <td className="num">{fmtUsd(r.grossUsd)}</td>
                    <td className="num" style={{ fontWeight: 600 }}>{fmtUsd(r.netUsd)}</td>
                    <td className="num">{r.netKhr.toLocaleString()}&#x17DB;</td>
                    <td>
                      <span className="tag" style={r.finalized
                        ? { color: "var(--green)", background: "var(--green-bg)" }
                        : { color: "var(--amber)", background: "var(--amber-bg)" }
                      }>
                        {r.finalized ? "Final" : "Draft"}
                      </span>
                    </td>
                    <td style={{ textAlign: "right", paddingRight: 12 }}>
                      <Link
                        href={`/print/payslip/${r.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 12, color: "var(--steel)", textDecoration: "none", whiteSpace: "nowrap" }}
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={4}>Total</td>
                  <td className="num">{fmtUsd(totalGross)}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{fmtUsd(totalNet)}</td>
                  <td className="num" style={{ fontWeight: 700 }}>{filtered.reduce((a, r) => a + r.netKhr, 0).toLocaleString()}&#x17DB;</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Root component ────────────────────────────────────────────────────────────

export function PayrollManager({ periods, canRun, canLock, canExport }: Props) {
  const [tab, setTab] = useState<"periods" | "run" | "history">("periods");
  const [isPending, startTransition] = useTransition();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 8 }}>
        <TabBtn label="Periods"     active={tab === "periods"} onClick={() => setTab("periods")} />
        <TabBtn label="Run Payroll" active={tab === "run"}     onClick={() => setTab("run")} />
        <TabBtn label="History"     active={tab === "history"} onClick={() => setTab("history")} />
      </div>

      <div style={{ display: tab === "periods" ? "block" : "none" }}>
        <PeriodsTab
          periods={periods}
          canRun={canRun}
          canLock={canLock}
          isPending={isPending}
          startTransition={startTransition}
        />
      </div>
      <div style={{ display: tab === "run" ? "block" : "none" }}>
        <RunPayrollTab
          periods={periods}
          canRun={canRun}
          canLock={canLock}
          canExport={canExport}
          isPending={isPending}
          startTransition={startTransition}
        />
      </div>
      <div style={{ display: tab === "history" ? "block" : "none" }}>
        <HistoryTab
          periods={periods}
          canExport={canExport}
          isPending={isPending}
          startTransition={startTransition}
        />
      </div>
    </div>
  );
}
