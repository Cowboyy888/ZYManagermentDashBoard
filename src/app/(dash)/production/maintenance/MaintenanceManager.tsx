"use client";
import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createMaintenanceLog, completeMaintenanceLog } from "@/actions/production";

type Log = {
  id: string; machineId: number; type: string;
  startedAt: string; completedAt: string | null;
  downtimeMinutes: number; description: string;
  cost: number | null;
  machine: { id: number; code: string; name: string } | null;
  performedBy: { id: number; nameEn: string } | null;
  createdAt: string;
};

interface Props {
  logs: Log[];
  machines: { id: number; code: string; name: string; status: string }[];
  employees: { id: number; nameEn: string }[];
  canWrite: boolean;
}

const TYPE_STYLE: Record<string, React.CSSProperties> = {
  PREVENTIVE: { color: "var(--steel)", background: "var(--surface-2)" },
  CORRECTIVE: { color: "var(--amber)", background: "var(--amber-bg)" },
  BREAKDOWN:  { color: "var(--red)",   background: "var(--red-bg)" },
};

const emptyForm = { machineId: "", type: "PREVENTIVE", startedAt: new Date().toISOString().slice(0, 16), performedById: "", downtimeMinutes: "0", description: "", cost: "" };

export function MaintenanceManager({ logs, machines, employees, canWrite }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [machineFilter, setMachineFilter] = useState("ALL");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [completing, setCompleting] = useState<string | null>(null);
  const [completeAt, setCompleteAt] = useState("");

  const filtered = useMemo(() => machineFilter === "ALL" ? logs : logs.filter((l) => l.machineId === Number(machineFilter)), [logs, machineFilter]);

  const totalDowntime = useMemo(() => logs.reduce((s, l) => s + l.downtimeMinutes, 0), [logs]);
  const totalCost = useMemo(() => logs.reduce((s, l) => s + (l.cost ?? 0), 0), [logs]);
  const openCount = useMemo(() => logs.filter((l) => !l.completedAt).length, [logs]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const res = await createMaintenanceLog({
        machineId: Number(form.machineId),
        type: form.type,
        startedAt: form.startedAt,
        performedById: form.performedById ? Number(form.performedById) : null,
        downtimeMinutes: Number(form.downtimeMinutes),
        description: form.description,
        cost: form.cost ? Number(form.cost) : null,
      });
      if (res.ok) { setMsg({ ok: true, text: "Log created." }); setShowForm(false); setForm(emptyForm); router.refresh(); }
      else { setMsg({ ok: false, text: "error" in res ? res.error : "Error" }); }
    });
  }

  async function handleComplete(id: string) {
    if (!completeAt) return;
    setMsg(null);
    const res = await completeMaintenanceLog(id, new Date(completeAt));
    if (res.ok) { setCompleting(null); setCompleteAt(""); router.refresh(); }
    else { setMsg({ ok: false, text: "error" in res ? res.error : "Error" }); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        {[
          { label: "Total Logs", value: logs.length.toString(), color: "var(--steel)" },
          { label: "Open (not completed)", value: openCount.toString(), color: openCount > 0 ? "var(--amber)" : "var(--green)" },
          { label: "Downtime (min)", value: totalDowntime.toLocaleString(), color: totalDowntime > 0 ? "var(--amber)" : "var(--text-3)" },
          { label: "Total Cost ($)", value: totalCost > 0 ? `$${totalCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—", color: "var(--text)" },
        ].map(({ label, value, color }) => (
          <div key={label} className="kpi-card">
            <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500, marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Actions + filter */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {canWrite && (
          <button className="btn btn-primary" onClick={() => { setShowForm((v) => !v); setMsg(null); }}>{showForm ? "Cancel" : "+ Log Maintenance"}</button>
        )}
        <select className="form-select" style={{ width: "auto" }} value={machineFilter} onChange={(e) => setMachineFilter(e.target.value)}>
          <option value="ALL">All Machines</option>
          {machines.map((m) => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
        </select>
      </div>

      {msg && <div style={{ padding: "10px 14px", borderRadius: 8, fontSize: 13, background: msg.ok ? "var(--green-bg)" : "var(--red-bg)", color: msg.ok ? "var(--green)" : "var(--red)" }}>{msg.text}</div>}

      {/* Create form */}
      {showForm && canWrite && (
        <div className="panel">
          <div className="panel-head"><span className="panel-title">New Maintenance Log</span></div>
          <form onSubmit={handleCreate} className="panel-body">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Machine</label>
                <select className="form-select" required value={form.machineId} onChange={(e) => setForm((f) => ({ ...f, machineId: e.target.value }))}>
                  <option value="">Select machine…</option>
                  {machines.map((m) => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Type</label>
                <select className="form-select" required value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                  <option value="PREVENTIVE">Preventive</option>
                  <option value="CORRECTIVE">Corrective</option>
                  <option value="BREAKDOWN">Breakdown</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Started At</label>
                <input type="datetime-local" className="form-input" required value={form.startedAt} onChange={(e) => setForm((f) => ({ ...f, startedAt: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Performed By</label>
                <select className="form-select" value={form.performedById} onChange={(e) => setForm((f) => ({ ...f, performedById: e.target.value }))}>
                  <option value="">— none —</option>
                  {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.nameEn}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Downtime (min)</label>
                <input type="number" className="form-input" min={0} placeholder="0" value={form.downtimeMinutes} onChange={(e) => setForm((f) => ({ ...f, downtimeMinutes: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Cost ($)</label>
                <input type="number" className="form-input" step={0.01} min={0} placeholder="0.00" value={form.cost} onChange={(e) => setForm((f) => ({ ...f, cost: e.target.value }))} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Description</label>
                <textarea className="form-input" style={{ height: 60, paddingTop: 8, resize: "vertical" }} required value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
              <button type="submit" className="btn btn-primary" disabled={isPending}>{isPending ? <><span className="spinner" />Saving…</> : "Create Log"}</button>
              <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Maintenance Logs</span>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>{filtered.length} shown</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>No logs found</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>Machine</th><th>Type</th><th>Started</th><th>Completed</th><th>Downtime</th><th>Cost</th><th>Performed By</th><th>Description</th>{canWrite && <th>Complete</th>}</tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.id}>
                    <td style={{ fontWeight: 500 }}>{l.machine?.code ?? l.machineId}</td>
                    <td><span className="tag" style={{ ...TYPE_STYLE[l.type] }}>{l.type}</span></td>
                    <td style={{ fontSize: 12, whiteSpace: "nowrap", color: "var(--text-2)" }}>{new Date(l.startedAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                    <td style={{ fontSize: 12, whiteSpace: "nowrap", color: l.completedAt ? "var(--green)" : "var(--amber)" }}>
                      {l.completedAt ? new Date(l.completedAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "Open"}
                    </td>
                    <td style={{ fontSize: 12.5 }}>{l.downtimeMinutes > 0 ? `${l.downtimeMinutes} min` : "—"}</td>
                    <td style={{ fontSize: 12.5 }}>{l.cost != null ? `$${l.cost.toFixed(2)}` : "—"}</td>
                    <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{l.performedBy?.nameEn ?? "—"}</td>
                    <td style={{ fontSize: 12, color: "var(--text-2)", maxWidth: 200 }}><span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{l.description}</span></td>
                    {canWrite && (
                      <td>
                        {!l.completedAt && (
                          completing === l.id ? (
                            <div style={{ display: "flex", gap: 4 }}>
                              <input type="datetime-local" className="form-input" style={{ height: 28, fontSize: 11, padding: "0 6px" }} value={completeAt} onChange={(e) => setCompleteAt(e.target.value)} />
                              <button className="btn btn-primary" style={{ height: 28, padding: "0 8px", fontSize: 12 }} onClick={() => handleComplete(l.id)}>Done</button>
                              <button className="btn" style={{ height: 28, padding: "0 6px", fontSize: 12 }} onClick={() => setCompleting(null)}>✕</button>
                            </div>
                          ) : (
                            <button className="btn" style={{ height: 28, padding: "0 10px", fontSize: 12 }} onClick={() => { setCompleting(l.id); setCompleteAt(new Date().toISOString().slice(0, 16)); }}>Mark Complete</button>
                          )
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
