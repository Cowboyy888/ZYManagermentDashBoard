"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  startExecution, pauseExecution, completeExecution,
  reportDowntime, resolveDowntime,
} from "@/actions/mes";

// ── Types ────────────────────────────────────────────────────────

type ExStatus = "QUEUED" | "IN_PROGRESS" | "PAUSED" | "COMPLETED" | "CANCELLED";
type DtReason = "BREAKDOWN" | "SETUP" | "MATERIAL_SHORTAGE" | "QUALITY_ISSUE" | "POWER_OUTAGE" | "PLANNED_MAINTENANCE" | "OTHER";

interface Execution {
  id: number;
  status: ExStatus;
  startedAt: Date | string | null;
  completedAt: Date | string | null;
  qtyProduced: number;
  qtyScrap: number;
  notes: string | null;
  order: { id: number; orderCode: string; customer: string | null; status: string; plannedDate: Date | string };
  operator: { id: number; nameEn: string; nameKh: string } | null;
  machine:  { id: number; code: string; name: string } | null;
  _count: { downtimeEvents: number };
}

interface DowntimeEvent {
  id: number;
  reason: DtReason;
  startedAt: Date | string;
  endedAt: Date | string | null;
  durationMin: number | null;
  notes: string | null;
  execution: { id: number; order: { orderCode: string } };
  reportedBy: { id: string; name: string };
}

interface Summary { active: number; queued: number; completedToday: number; activeDowntime: number }
interface Machine  { id: number; code: string; name: string }

interface Props {
  executions:    Execution[];
  summary:       Summary;
  downtimeEvents: DowntimeEvent[];
  machines:      Machine[];
}

// ── Constants ────────────────────────────────────────────────────

const STATUS_CFG: Record<ExStatus, { label: string; bg: string; color: string }> = {
  QUEUED:      { label: "Queued",      bg: "var(--border)",   color: "var(--text-3)" },
  IN_PROGRESS: { label: "In Progress", bg: "var(--amber-bg)", color: "var(--amber)"  },
  PAUSED:      { label: "Paused",      bg: "var(--blue-bg)",  color: "var(--blue)"   },
  COMPLETED:   { label: "Completed",   bg: "var(--green-bg)", color: "var(--green)"  },
  CANCELLED:   { label: "Cancelled",   bg: "var(--red-bg)",   color: "var(--red)"    },
};

const DT_LABELS: Record<DtReason, string> = {
  BREAKDOWN:          "Breakdown",
  SETUP:              "Setup / Changeover",
  MATERIAL_SHORTAGE:  "Material Shortage",
  QUALITY_ISSUE:      "Quality Issue",
  POWER_OUTAGE:       "Power Outage",
  PLANNED_MAINTENANCE:"Planned Maintenance",
  OTHER:              "Other",
};

const CARD: React.CSSProperties = {
  background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: 12, padding: 20,
};

function fmt(d: Date | string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

// ── Complete dialog ───────────────────────────────────────────────

function CompleteDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [qty, setQty]   = useState(0);
  const [scrap, setScrap] = useState(0);
  const [err, setErr]   = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await completeExecution(id, qty, scrap);
      if (res.ok) { router.refresh(); onClose(); }
      else setErr("error" in res ? res.error : "Unknown error");
    });
  }

  const inp: React.CSSProperties = {
    width: "100%", padding: "7px 10px", borderRadius: 6,
    border: "1px solid var(--border)", fontSize: 13,
    background: "var(--surface)", color: "var(--text)",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ ...CARD, width: 340, display: "flex", flexDirection: "column", gap: 14 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Complete Work Order</h3>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 4 }}>Qty Produced (pcs)</label>
            <input style={inp} type="number" min={0} value={qty} onChange={e => setQty(Number(e.target.value))} required />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 4 }}>Qty Scrap (pcs)</label>
            <input style={inp} type="number" min={0} value={scrap} onChange={e => setScrap(Number(e.target.value))} />
          </div>
          {err && <div style={{ fontSize: 12, color: "var(--red)", background: "var(--red-bg)", padding: "6px 10px", borderRadius: 6 }}>{err}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" disabled={pending}
              style={{ flex: 1, padding: "8px", borderRadius: 8, background: "var(--green)", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {pending ? "Saving…" : "Mark Complete"}
            </button>
            <button type="button" onClick={onClose}
              style={{ padding: "8px 14px", borderRadius: 8, background: "var(--surface-2)", color: "var(--text-2)", border: "1px solid var(--border)", fontSize: 13, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Downtime dialog ───────────────────────────────────────────────

function DowntimeDialog({ executionId, onClose }: { executionId: number; onClose: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState<DtReason>("BREAKDOWN");
  const [notes, setNotes]   = useState("");
  const [err, setErr]       = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await reportDowntime({ executionId, reason, notes: notes || null });
      if (res.ok) { router.refresh(); onClose(); }
      else setErr("error" in res ? res.error : "Unknown error");
    });
  }

  const inp: React.CSSProperties = {
    width: "100%", padding: "7px 10px", borderRadius: 6,
    border: "1px solid var(--border)", fontSize: 13,
    background: "var(--surface)", color: "var(--text)",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ ...CARD, width: 360, display: "flex", flexDirection: "column", gap: 14 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Report Downtime</h3>
        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 4 }}>Reason</label>
            <select style={inp} value={reason} onChange={e => setReason(e.target.value as DtReason)}>
              {Object.entries(DT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 4 }}>Notes</label>
            <textarea style={{ ...inp, height: 72, resize: "vertical" }} value={notes} onChange={e => setNotes(e.target.value)} maxLength={300} />
          </div>
          {err && <div style={{ fontSize: 12, color: "var(--red)", background: "var(--red-bg)", padding: "6px 10px", borderRadius: 6 }}>{err}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" disabled={pending}
              style={{ flex: 1, padding: "8px", borderRadius: 8, background: "var(--red)", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              {pending ? "Reporting…" : "Report Downtime"}
            </button>
            <button type="button" onClick={onClose}
              style={{ padding: "8px 14px", borderRadius: 8, background: "var(--surface-2)", color: "var(--text-2)", border: "1px solid var(--border)", fontSize: 13, cursor: "pointer" }}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────

export function ShopFloorClient({ executions, summary, downtimeEvents }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [tab,         setTab]         = useState<"executions" | "downtime">("executions");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [completeId,  setCompleteId]  = useState<number | null>(null);
  const [downtimeId,  setDowntimeId]  = useState<number | null>(null);

  const filtered = statusFilter === "ALL" ? executions : executions.filter(e => e.status === statusFilter);

  function doStart(id: number) {
    startTransition(async () => { await startExecution(id); router.refresh(); });
  }
  function doPause(id: number) {
    startTransition(async () => { await pauseExecution(id); router.refresh(); });
  }
  function doResolveDowntime(id: number) {
    startTransition(async () => { await resolveDowntime(id); router.refresh(); });
  }

  const tabStyle = (t: string): React.CSSProperties => ({
    padding: "8px 16px", borderRadius: 8, border: "none",
    background: tab === t ? "var(--steel)" : "transparent",
    color: tab === t ? "#fff" : "var(--text-2)",
    fontWeight: tab === t ? 600 : 400, fontSize: 13, cursor: "pointer",
  });

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Dialogs */}
      {completeId !== null && <CompleteDialog id={completeId} onClose={() => setCompleteId(null)} />}
      {downtimeId !== null && <DowntimeDialog executionId={downtimeId} onClose={() => setDowntimeId(null)} />}

      {/* Header */}
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", margin: 0 }}>Shop Floor</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Manufacturing Execution System — real-time work order tracking</p>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        {[
          { label: "Active Work Orders", value: summary.active,         color: "var(--amber)" },
          { label: "Queued",             value: summary.queued,         color: "var(--blue)"  },
          { label: "Completed Today",    value: summary.completedToday, color: "var(--green)" },
          { label: "Active Downtime",    value: summary.activeDowntime, color: "var(--red)"   },
        ].map(k => (
          <div key={k.label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20, textAlign: "center" }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 4 }}>{k.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 4, background: "var(--surface-2)", padding: 4, borderRadius: 10 }}>
          <button style={tabStyle("executions")} onClick={() => setTab("executions")}>Work Orders</button>
          <button style={tabStyle("downtime")} onClick={() => setTab("downtime")}>
            Downtime
            {summary.activeDowntime > 0 && (
              <span style={{ marginLeft: 6, background: "var(--red)", borderRadius: 10, padding: "0 6px", fontSize: 10, color: "#fff" }}>
                {summary.activeDowntime}
              </span>
            )}
          </button>
        </div>
        {tab === "executions" && (
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 13, background: "var(--surface)", color: "var(--text)" }}>
            <option value="ALL">All Statuses</option>
            {Object.entries(STATUS_CFG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        )}
      </div>

      {/* Work Orders */}
      {tab === "executions" && (
        <div style={CARD}>
          {filtered.length === 0 ? (
            <p style={{ color: "var(--text-3)", fontSize: 13, textAlign: "center", padding: "32px 0" }}>No work executions found.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "var(--surface-2)" }}>
                    {["Order", "Operator", "Machine", "Started", "Produced", "Scrap", "Downtime", "Status", "Actions"].map(h => (
                      <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-3)", borderBottom: "1px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(ex => {
                    const sc = STATUS_CFG[ex.status];
                    return (
                      <tr key={ex.id} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ fontWeight: 600, color: "var(--steel)" }}>{ex.order.orderCode}</div>
                          {ex.order.customer && <div style={{ fontSize: 11, color: "var(--text-3)" }}>{ex.order.customer}</div>}
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: 12 }}>{ex.operator?.nameEn ?? "—"}</td>
                        <td style={{ padding: "10px 12px", fontSize: 12 }}>{ex.machine?.code ?? "—"}</td>
                        <td style={{ padding: "10px 12px", fontSize: 12 }}>{fmt(ex.startedAt)}</td>
                        <td style={{ padding: "10px 12px", fontVariantNumeric: "tabular-nums" }}>{ex.qtyProduced}</td>
                        <td style={{ padding: "10px 12px", fontVariantNumeric: "tabular-nums", color: ex.qtyScrap > 0 ? "var(--red)" : "var(--text)" }}>{ex.qtyScrap}</td>
                        <td style={{ padding: "10px 12px" }}>
                          {ex._count.downtimeEvents > 0 && (
                            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--red)", background: "var(--red-bg)", padding: "2px 6px", borderRadius: 10 }}>
                              {ex._count.downtimeEvents}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <span style={{ display: "inline-block", padding: "3px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600, background: sc.bg, color: sc.color }}>
                            {sc.label}
                          </span>
                        </td>
                        <td style={{ padding: "10px 12px" }}>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {ex.status === "QUEUED" && (
                              <button onClick={() => doStart(ex.id)}
                                style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "none", background: "var(--green)", color: "#fff", cursor: "pointer", fontWeight: 600 }}>
                                Start
                              </button>
                            )}
                            {ex.status === "IN_PROGRESS" && (
                              <>
                                <button onClick={() => doPause(ex.id)}
                                  style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text-2)", cursor: "pointer" }}>
                                  Pause
                                </button>
                                <button onClick={() => setDowntimeId(ex.id)}
                                  style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "none", background: "var(--red-bg)", color: "var(--red)", cursor: "pointer", fontWeight: 600 }}>
                                  ↓ Downtime
                                </button>
                                <button onClick={() => setCompleteId(ex.id)}
                                  style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "none", background: "var(--steel)", color: "#fff", cursor: "pointer", fontWeight: 600 }}>
                                  Complete
                                </button>
                              </>
                            )}
                            {ex.status === "PAUSED" && (
                              <button onClick={() => doStart(ex.id)}
                                style={{ fontSize: 11, padding: "4px 10px", borderRadius: 6, border: "none", background: "var(--amber)", color: "#fff", cursor: "pointer", fontWeight: 600 }}>
                                Resume
                              </button>
                            )}
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

      {/* Downtime log */}
      {tab === "downtime" && (
        <div style={CARD}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>Downtime Events</h3>
          {downtimeEvents.length === 0 ? (
            <p style={{ color: "var(--text-3)", fontSize: 13, textAlign: "center", padding: "32px 0" }}>No downtime events recorded.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {downtimeEvents.map(dt => (
                <div key={dt.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
                  padding: "12px 16px", borderRadius: 8,
                  background: dt.endedAt ? "var(--surface)" : "var(--red-bg)",
                  border: "1px solid var(--border)",
                }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: dt.endedAt ? "var(--text)" : "var(--red)" }}>
                        {DT_LABELS[dt.reason]}
                      </span>
                      {!dt.endedAt && (
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", background: "var(--red)", borderRadius: 10, padding: "1px 6px" }}>
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                      Order: {dt.execution.order.orderCode} · Started: {fmt(dt.startedAt)}
                      {dt.endedAt && ` · Duration: ${dt.durationMin ?? "?"} min`}
                      {dt.notes && ` · ${dt.notes}`}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-3)" }}>Reported by {dt.reportedBy.name}</div>
                  </div>
                  {!dt.endedAt && (
                    <button onClick={() => doResolveDowntime(dt.id)}
                      style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "var(--green)", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                      Resolve
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
