"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createProductionPlan,
  updateProductionPlan,
  updatePlanStatus,
  deleteProductionPlan,
} from "@/actions/productionPlanning";

// ── Types ────────────────────────────────────────────────────────

type PlanStatus = "DRAFT" | "RELEASED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
type Priority   = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

interface Plan {
  id: number;
  planNumber: string;
  title: string;
  description: string | null;
  startDate: Date | string;
  endDate: Date | string;
  status: PlanStatus;
  priority: Priority;
  shiftId: number | null;
  machineId: number | null;
  targetQtyKg: number | null;
  notes: string | null;
  shift: { id: number; name: string; color: string; startTime: string; endTime: string } | null;
  machine: { id: number; code: string; name: string } | null;
  createdBy: { id: string; name: string };
}

interface Capacity {
  machines: number;
  shifts: number;
  pendingOrders: number;
  activePlans: number;
}

interface Shift    { id: number; name: string; color: string; startTime: string; endTime: string }
interface Machine  { id: number; code: string; name: string }

interface Props {
  plans:    Plan[];
  capacity: Capacity;
  shifts:   Shift[];
  machines: Machine[];
}

// ── Constants ────────────────────────────────────────────────────

const STATUS_CFG: Record<PlanStatus, { label: string; bg: string; color: string }> = {
  DRAFT:       { label: "Draft",       bg: "var(--border)",    color: "var(--text-3)" },
  RELEASED:    { label: "Released",    bg: "var(--blue-bg)",   color: "var(--blue)"   },
  IN_PROGRESS: { label: "In Progress", bg: "var(--amber-bg)",  color: "var(--amber)"  },
  COMPLETED:   { label: "Completed",   bg: "var(--green-bg)",  color: "var(--green)"  },
  CANCELLED:   { label: "Cancelled",   bg: "var(--red-bg)",    color: "var(--red)"    },
};

const PRIORITY_CFG: Record<Priority, { label: string; color: string }> = {
  LOW:    { label: "Low",    color: "var(--text-3)" },
  MEDIUM: { label: "Medium", color: "var(--blue)"   },
  HIGH:   { label: "High",   color: "var(--amber)"  },
  URGENT: { label: "Urgent", color: "var(--red)"    },
};

const CARD: React.CSSProperties = {
  background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: 12, padding: 20,
};

function fmt(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Calendar helpers ─────────────────────────────────────────────

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function planSpansDay(plan: Plan, year: number, month: number, day: number): boolean {
  const d    = new Date(year, month - 1, day);
  const from = new Date(plan.startDate);
  const to   = new Date(plan.endDate);
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);
  return d >= from && d <= to;
}

// ── Form component ───────────────────────────────────────────────

function PlanForm({
  initial, shifts, machines, onClose,
}: {
  initial?: Plan;
  shifts: Shift[];
  machines: Machine[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title:       initial?.title ?? "",
    description: initial?.description ?? "",
    startDate:   initial ? new Date(initial.startDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    endDate:     initial ? new Date(initial.endDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    priority:    initial?.priority ?? "MEDIUM",
    shiftId:     initial?.shiftId ? String(initial.shiftId) : "",
    machineId:   initial?.machineId ? String(initial.machineId) : "",
    targetQtyKg: initial?.targetQtyKg ? String(initial.targetQtyKg) : "",
    notes:       initial?.notes ?? "",
  });

  function field(k: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(f => ({ ...f, [k]: e.target.value }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const data = {
      ...form,
      shiftId:     form.shiftId   ? Number(form.shiftId)   : null,
      machineId:   form.machineId ? Number(form.machineId) : null,
      targetQtyKg: form.targetQtyKg ? Number(form.targetQtyKg) : null,
    };
    startTransition(async () => {
      const res = initial
        ? await updateProductionPlan(initial.id, data)
        : await createProductionPlan(data);
      if (res.ok) { router.refresh(); onClose(); }
      else setError("error" in res ? res.error : "Unknown error");
    });
  }

  const inp: React.CSSProperties = {
    width: "100%", padding: "7px 10px", borderRadius: 6,
    border: "1px solid var(--border)", fontSize: 13,
    background: "var(--surface)", color: "var(--text)",
  };
  const lbl: React.CSSProperties = { display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 4 };

  return (
    <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <div style={{ gridColumn: "1/-1" }}>
        <label style={lbl}>Title *</label>
        <input style={inp} value={form.title} onChange={field("title")} required maxLength={200} />
      </div>
      <div>
        <label style={lbl}>Start Date *</label>
        <input style={inp} type="date" value={form.startDate} onChange={field("startDate")} required />
      </div>
      <div>
        <label style={lbl}>End Date *</label>
        <input style={inp} type="date" value={form.endDate} onChange={field("endDate")} required />
      </div>
      <div>
        <label style={lbl}>Priority</label>
        <select style={inp} value={form.priority} onChange={field("priority")}>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </select>
      </div>
      <div>
        <label style={lbl}>Target Output (kg)</label>
        <input style={inp} type="number" min={0} step={0.01} value={form.targetQtyKg} onChange={field("targetQtyKg")} placeholder="Optional" />
      </div>
      <div>
        <label style={lbl}>Assigned Shift</label>
        <select style={inp} value={form.shiftId} onChange={field("shiftId")}>
          <option value="">— Any shift —</option>
          {shifts.map(s => <option key={s.id} value={s.id}>{s.name} ({s.startTime}–{s.endTime})</option>)}
        </select>
      </div>
      <div>
        <label style={lbl}>Assigned Machine</label>
        <select style={inp} value={form.machineId} onChange={field("machineId")}>
          <option value="">— Any machine —</option>
          {machines.map(m => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
        </select>
      </div>
      <div style={{ gridColumn: "1/-1" }}>
        <label style={lbl}>Description</label>
        <textarea style={{ ...inp, height: 64, resize: "vertical" }} value={form.description} onChange={field("description")} maxLength={500} />
      </div>
      <div style={{ gridColumn: "1/-1" }}>
        <label style={lbl}>Notes</label>
        <textarea style={{ ...inp, height: 48, resize: "vertical" }} value={form.notes} onChange={field("notes")} maxLength={500} />
      </div>
      {error && (
        <div style={{ gridColumn: "1/-1", padding: "8px 12px", borderRadius: 6, background: "var(--red-bg)", color: "var(--red)", fontSize: 12 }}>
          {error}
        </div>
      )}
      <div style={{ gridColumn: "1/-1", display: "flex", gap: 10 }}>
        <button type="submit" disabled={pending}
          style={{ padding: "8px 20px", borderRadius: 8, background: "var(--steel)", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          {pending ? "Saving…" : initial ? "Save Changes" : "Create Plan"}
        </button>
        <button type="button" onClick={onClose}
          style={{ padding: "8px 16px", borderRadius: 8, background: "var(--surface-2)", color: "var(--text-2)", border: "1px solid var(--border)", fontSize: 13, cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ── Calendar view ────────────────────────────────────────────────

function CalendarView({ plans, year, month }: { plans: Plan[]; year: number; month: number }) {
  const days     = getDaysInMonth(year, month);
  const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const monthName = new Date(year, month - 1).toLocaleString("en-GB", { month: "long", year: "numeric" });

  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", marginBottom: 12 }}>{monthName}</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
          <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: "var(--text-3)", padding: "4px 0" }}>{d}</div>
        ))}
        {cells.map((day, i) => {
          const dayPlans = day ? plans.filter(p => planSpansDay(p, year, month, day)) : [];
          return (
            <div key={i} style={{
              minHeight: 64, padding: 4, borderRadius: 6,
              background: day ? "var(--surface)" : "transparent",
              border: day ? "1px solid var(--border)" : "none",
              opacity: day ? 1 : 0,
            }}>
              {day && (
                <>
                  <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>{day}</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: 2 }}>
                    {dayPlans.slice(0, 3).map(p => (
                      <div key={p.id} style={{
                        fontSize: 10, padding: "1px 4px", borderRadius: 3,
                        background: p.shift?.color ?? "var(--steel)", color: "#fff",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }} title={p.title}>
                        {p.planNumber}
                      </div>
                    ))}
                    {dayPlans.length > 3 && (
                      <span style={{ fontSize: 10, color: "var(--text-3)" }}>+{dayPlans.length - 3} more</span>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────

export function PlanningClient({ plans, capacity, shifts, machines }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [view,      setView]      = useState<"list" | "calendar">("list");
  const [showForm,  setShowForm]  = useState(false);
  const [editing,   setEditing]   = useState<Plan | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const now = new Date();
  const [calYear,  setCalYear]  = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth() + 1);

  const filtered = statusFilter === "ALL" ? plans : plans.filter(p => p.status === statusFilter);

  function changeStatus(id: number, status: PlanStatus) {
    startTransition(async () => {
      await updatePlanStatus(id, status);
      router.refresh();
    });
  }

  function deletePlan(id: number) {
    if (!confirm("Delete this production plan?")) return;
    startTransition(async () => {
      await deleteProductionPlan(id);
      router.refresh();
    });
  }

  function prevMonth() {
    if (calMonth === 1) { setCalYear(y => y - 1); setCalMonth(12); }
    else setCalMonth(m => m - 1);
  }
  function nextMonth() {
    if (calMonth === 12) { setCalYear(y => y + 1); setCalMonth(1); }
    else setCalMonth(m => m + 1);
  }

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", margin: 0 }}>Production Planning</h1>
          <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Master Production Schedule — plan, assign, and track factory output</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }}
          style={{ padding: "9px 18px", borderRadius: 8, background: "var(--steel)", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          + New Plan
        </button>
      </div>

      {/* Capacity KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        {[
          { label: "Operational Machines", value: capacity.machines },
          { label: "Active Shifts",        value: capacity.shifts },
          { label: "Pending Orders",       value: capacity.pendingOrders },
          { label: "Active Plans",         value: capacity.activePlans },
        ].map(k => (
          <div key={k.label} style={{ ...CARD, textAlign: "center" }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: "var(--steel)" }}>{k.value}</div>
            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Form */}
      {(showForm || editing) && (
        <div style={CARD}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>
            {editing ? `Edit — ${editing.planNumber}` : "New Production Plan"}
          </h3>
          <PlanForm
            initial={editing ?? undefined}
            shifts={shifts}
            machines={machines}
            onClose={() => { setShowForm(false); setEditing(null); }}
          />
        </div>
      )}

      {/* View toggle + filters */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 4, background: "var(--surface-2)", padding: 4, borderRadius: 8 }}>
          {(["list", "calendar"] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: "6px 14px", borderRadius: 6, border: "none", fontSize: 13,
              background: view === v ? "var(--steel)" : "transparent",
              color: view === v ? "#fff" : "var(--text-2)",
              fontWeight: view === v ? 600 : 400, cursor: "pointer",
            }}>
              {v === "list" ? "MPS List" : "Calendar"}
            </button>
          ))}
        </div>
        {view === "list" && (
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 13, background: "var(--surface)", color: "var(--text)" }}>
            <option value="ALL">All Statuses</option>
            {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        )}
        {view === "calendar" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={prevMonth} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", fontSize: 13 }}>‹</button>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", minWidth: 120, textAlign: "center" }}>
              {new Date(calYear, calMonth - 1).toLocaleString("en-GB", { month: "long", year: "numeric" })}
            </span>
            <button onClick={nextMonth} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", fontSize: 13 }}>›</button>
          </div>
        )}
      </div>

      {/* List view */}
      {view === "list" && (
        <div style={CARD}>
          {filtered.length === 0 ? (
            <p style={{ color: "var(--text-3)", fontSize: 13, textAlign: "center", padding: "32px 0" }}>
              No production plans found. Create one to get started.
            </p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "var(--surface-2)" }}>
                    {["Plan #", "Title", "Dates", "Priority", "Shift", "Machine", "Target (kg)", "Status", ""].map(h => (
                      <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-3)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(p => {
                    const sc = STATUS_CFG[p.status];
                    const pc = PRIORITY_CFG[p.priority];
                    return (
                      <tr key={p.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "10px 12px", fontWeight: 600, color: "var(--steel)", whiteSpace: "nowrap" }}>{p.planNumber}</td>
                        <td style={{ padding: "10px 12px", maxWidth: 200 }}>
                          <div style={{ fontWeight: 600 }}>{p.title}</div>
                          {p.description && <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{p.description.slice(0, 60)}{p.description.length > 60 ? "…" : ""}</div>}
                        </td>
                        <td style={{ padding: "10px 12px", whiteSpace: "nowrap", fontSize: 12 }}>
                          <div>{fmt(p.startDate)}</div>
                          <div style={{ color: "var(--text-3)" }}>→ {fmt(p.endDate)}</div>
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{ fontWeight: 600, color: pc.color, fontSize: 12 }}>{pc.label}</span>
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: 12 }}>
                          {p.shift ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                              <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.shift.color, display: "inline-block" }} />
                              {p.shift.name}
                            </span>
                          ) : "—"}
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: 12, color: "var(--text-2)" }}>{p.machine?.code ?? "—"}</td>
                        <td style={{ padding: "10px 12px", fontVariantNumeric: "tabular-nums" }}>
                          {p.targetQtyKg ? `${Number(p.targetQtyKg).toLocaleString()} kg` : "—"}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <select value={p.status} onChange={e => changeStatus(p.id, e.target.value as PlanStatus)}
                            style={{ padding: "3px 6px", borderRadius: 6, fontSize: 11, fontWeight: 600, border: "none", background: sc.bg, color: sc.color, cursor: "pointer" }}>
                            {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button onClick={() => { setEditing(p); setShowForm(false); }}
                              style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-2)", cursor: "pointer" }}>
                              Edit
                            </button>
                            <button onClick={() => deletePlan(p.id)}
                              style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, border: "none", background: "var(--red-bg)", color: "var(--red)", cursor: "pointer" }}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Calendar view */}
      {view === "calendar" && (
        <div style={CARD}>
          <CalendarView plans={plans} year={calYear} month={calMonth} />
          <div style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 10 }}>
            {shifts.map(s => (
              <span key={s.id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--text-2)" }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: s.color, display: "inline-block" }} />
                {s.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
