"use client";

import { useState, useTransition } from "react";
import { createWorkOrder, updateWorkOrderStatus, addSparePartUsage } from "@/actions/maintenance";

interface WorkOrder {
  id: number;
  woNumber: string;
  type: string;
  priority: string;
  status: string;
  title: string;
  description: string | null;
  machineId: number;
  machineCode: string;
  machineName: string;
  assignedToId: number | null;
  assignedToName: string | null;
  scheduleId: number | null;
  scheduleTitle: string | null;
  scheduledDate: string;
  startedAt: string | null;
  completedAt: string | null;
  downtimeMinutes: number | null;
  laborHours: number | null;
  partsCostUsd: number | null;
  laborCostUsd: number | null;
  totalCostUsd: number | null;
  notes: string | null;
  createdBy: string | null;
  sparePartCount: number;
  createdAt: string;
}

interface Machine { id: number; code: string; name: string; status: string }
interface Employee { id: number; nameEn: string }
interface InventoryItem { id: number; itemCode: string; name: string; unitOfMeasure: string; currentStock: number; unitCostUsd: number | null }

interface Props {
  workOrders: WorkOrder[];
  machines: Machine[];
  employees: Employee[];
  inventoryItems: InventoryItem[];
  canWrite: boolean;
  canManage: boolean;
}

const TYPE_OPTIONS = ["PREVENTIVE", "CORRECTIVE", "EMERGENCY", "INSPECTION", "UPGRADE"];
const PRIORITY_OPTIONS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const STATUS_TRANSITIONS: Record<string, string[]> = {
  OPEN: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["ON_HOLD", "COMPLETE", "CANCELLED"],
  ON_HOLD: ["IN_PROGRESS", "CANCELLED"],
  COMPLETE: [],
  CANCELLED: [],
};

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444", HIGH: "#f97316", MEDIUM: "#f59e0b", LOW: "#10b981",
};
const STATUS_COLORS: Record<string, string> = {
  OPEN: "#6366f1", IN_PROGRESS: "#f59e0b", ON_HOLD: "#94a3b8", COMPLETE: "#10b981", CANCELLED: "#ef4444",
};

function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
function fmtCost(n: number | null) { return n !== null ? "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"; }

export function WorkOrdersManager({ workOrders, machines, employees, inventoryItems, canWrite, canManage: _canManage }: Props) {
  const [tab, setTab] = useState<"list" | "create">("list");
  const [viewId, setViewId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const [addPartWoId, setAddPartWoId] = useState<number | null>(null);

  const filtered = workOrders.filter((w) => {
    const matchSearch = !search || `${w.woNumber} ${w.title} ${w.machineCode} ${w.machineName}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "ALL" || w.status === statusFilter;
    const matchType = typeFilter === "ALL" || w.type === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  const viewWO = viewId !== null ? workOrders.find((w) => w.id === viewId) : null;

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createWorkOrder({
        type: fd.get("type") as string,
        priority: fd.get("priority") as string,
        title: fd.get("title") as string,
        description: fd.get("description") as string || null,
        machineId: Number(fd.get("machineId")),
        assignedToId: fd.get("assignedToId") ? Number(fd.get("assignedToId")) : null,
        scheduledDate: fd.get("scheduledDate") as string,
        laborHours: fd.get("laborHours") ? Number(fd.get("laborHours")) : null,
        laborCostUsd: fd.get("laborCostUsd") ? Number(fd.get("laborCostUsd")) : null,
        notes: fd.get("notes") as string || null,
      });
      if ("error" in res) { setError(res.error); } else { setTab("list"); setError(""); }
    });
  }

  function handleStatusChange(wo: WorkOrder, newStatus: string) {
    const extra: { downtimeMinutes?: number; laborHours?: number; laborCostUsd?: number } = {};
    if (newStatus === "COMPLETE") {
      const dt = prompt("Downtime (minutes)?");
      const lh = prompt("Labor hours?");
      const lc = prompt("Labor cost (USD)?");
      if (dt) extra.downtimeMinutes = Number(dt);
      if (lh) extra.laborHours = Number(lh);
      if (lc) extra.laborCostUsd = Number(lc);
    }
    startTransition(async () => {
      const res = await updateWorkOrderStatus({ id: wo.id, status: newStatus as "OPEN" | "IN_PROGRESS" | "ON_HOLD" | "COMPLETE" | "CANCELLED", ...extra });
      if ("error" in res) setError(res.error);
    });
  }

  function handleAddPart(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!addPartWoId) return;
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await addSparePartUsage({
        workOrderId: addPartWoId,
        itemId: Number(fd.get("itemId")),
        quantityUsed: Number(fd.get("quantityUsed")),
        notes: fd.get("notes") as string || null,
      });
      if ("error" in res) { setError(res.error); } else { setAddPartWoId(null); setError(""); }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        {tab === "list" && (
          <>
            <input className="input" placeholder="Search WO#, title, machine..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 220 }} />
            <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 150 }}>
              <option value="ALL">All Statuses</option>
              {Object.keys(STATUS_TRANSITIONS).map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
            </select>
            <select className="input" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ width: 160 }}>
              <option value="ALL">All Types</option>
              {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>{filtered.length} results</span>
          </>
        )}
        <div style={{ marginLeft: "auto" }}>
          {canWrite && (
            <button className="btn btn-primary" onClick={() => { setTab(tab === "list" ? "create" : "list"); setError(""); }}>
              {tab === "list" ? "+ New Work Order" : "← Back to List"}
            </button>
          )}
        </div>
      </div>

      {error && <div style={{ padding: "10px 14px", borderRadius: 8, background: "var(--red-bg)", color: "var(--red)", fontSize: 13 }}>{error}</div>}

      {/* Create Form */}
      {tab === "create" && (
        <div className="panel">
          <div className="panel-head">New Work Order</div>
          <form className="panel-body" onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Type *</span>
                <select className="input" name="type" required>
                  {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Priority *</span>
                <select className="input" name="priority" required>
                  {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "span 2" }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Title *</span>
                <input className="input" name="title" required placeholder="Brief description of the work" />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Machine *</span>
                <select className="input" name="machineId" required>
                  <option value="">Select machine</option>
                  {machines.map((m) => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Assigned To</span>
                <select className="input" name="assignedToId">
                  <option value="">— Unassigned —</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.nameEn}</option>)}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Scheduled Date *</span>
                <input className="input" type="date" name="scheduledDate" required defaultValue={new Date().toISOString().slice(0, 10)} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Labor Hours (est.)</span>
                <input className="input" type="number" name="laborHours" step="0.5" min="0" placeholder="0.0" />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "span 2" }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Description</span>
                <textarea className="input" name="description" rows={3} placeholder="Detailed work description, symptoms, checklist..." />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "span 2" }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Notes</span>
                <textarea className="input" name="notes" rows={2} />
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn" onClick={() => { setTab("list"); setError(""); }}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isPending}>{isPending ? "Creating…" : "Create Work Order"}</button>
            </div>
          </form>
        </div>
      )}

      {/* List */}
      {tab === "list" && (
        <div className="panel">
          <div style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>WO #</th>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Priority</th>
                  <th>Machine</th>
                  <th>Status</th>
                  <th>Scheduled</th>
                  <th>Assigned To</th>
                  <th>Total Cost</th>
                  <th>Parts</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={11} style={{ textAlign: "center", color: "var(--text-3)", padding: 24 }}>No work orders found</td></tr>
                ) : filtered.map((w) => {
                  const transitions = STATUS_TRANSITIONS[w.status] ?? [];
                  return (
                    <tr key={w.id}>
                      <td><code style={{ fontSize: 11 }}>{w.woNumber}</code></td>
                      <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>{w.title}</td>
                      <td style={{ fontSize: 11 }}>{w.type}</td>
                      <td>
                        <span className="tag" style={{ background: PRIORITY_COLORS[w.priority] + "20", color: PRIORITY_COLORS[w.priority], fontSize: 11 }}>
                          {w.priority}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>{w.machineCode}</td>
                      <td>
                        <span className="tag" style={{ background: (STATUS_COLORS[w.status] ?? "#94a3b8") + "20", color: STATUS_COLORS[w.status] ?? "#94a3b8", fontSize: 11 }}>
                          {w.status.replace("_", " ")}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>{fmtDate(w.scheduledDate)}</td>
                      <td style={{ fontSize: 12 }}>{w.assignedToName ?? "—"}</td>
                      <td style={{ fontSize: 12 }}>{fmtCost(w.totalCostUsd)}</td>
                      <td style={{ textAlign: "center", fontSize: 12 }}>{w.sparePartCount}</td>
                      <td>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          <button className="btn btn-sm" onClick={() => setViewId(w.id)}>View</button>
                          {canWrite && transitions.map((next) => (
                            <button key={next} className="btn btn-sm btn-primary" style={{ fontSize: 10 }} onClick={() => handleStatusChange(w, next)} disabled={isPending}>
                              {next.replace("_", " ")}
                            </button>
                          ))}
                          {canWrite && w.status === "IN_PROGRESS" && (
                            <button className="btn btn-sm" style={{ fontSize: 10 }} onClick={() => setAddPartWoId(w.id)}>+ Part</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewWO && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div className="panel" style={{ width: 560, maxHeight: "85vh", overflowY: "auto" }}>
            <div className="panel-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{viewWO.woNumber} — {viewWO.title}</span>
              <button className="btn btn-sm" onClick={() => setViewId(null)}>Close</button>
            </div>
            <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {([
                  ["Type", viewWO.type],
                  ["Priority", viewWO.priority],
                  ["Status", viewWO.status.replace("_", " ")],
                  ["Machine", `${viewWO.machineCode} — ${viewWO.machineName}`],
                  ["Assigned To", viewWO.assignedToName ?? "—"],
                  ["Schedule", viewWO.scheduleTitle ?? "—"],
                  ["Scheduled", fmtDate(viewWO.scheduledDate)],
                  ["Started", viewWO.startedAt ? fmtDate(viewWO.startedAt) : "—"],
                  ["Completed", viewWO.completedAt ? fmtDate(viewWO.completedAt) : "—"],
                  ["Downtime", viewWO.downtimeMinutes != null ? `${viewWO.downtimeMinutes} min` : "—"],
                  ["Labor Hours", viewWO.laborHours ?? "—"],
                  ["Parts Cost", fmtCost(viewWO.partsCostUsd)],
                  ["Labor Cost", fmtCost(viewWO.laborCostUsd)],
                  ["Total Cost", fmtCost(viewWO.totalCostUsd)],
                  ["Spare Parts Used", viewWO.sparePartCount],
                  ["Created By", viewWO.createdBy ?? "—"],
                ] as [string, string | number | null][]).map(([label, val]) => (
                  <div key={label}>
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 13 }}>{val ?? "—"}</div>
                  </div>
                ))}
              </div>
              {viewWO.description && (
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>Description</div>
                  <div style={{ fontSize: 13, whiteSpace: "pre-wrap", background: "var(--bg-2)", borderRadius: 6, padding: "8px 12px" }}>{viewWO.description}</div>
                </div>
              )}
              {viewWO.notes && (
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>Notes</div>
                  <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{viewWO.notes}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Spare Part Modal */}
      {addPartWoId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div className="panel" style={{ width: 420 }}>
            <div className="panel-head">Add Spare Part Usage</div>
            <form className="panel-body" onSubmit={handleAddPart} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Inventory Item *</span>
                <select className="input" name="itemId" required>
                  <option value="">Select item</option>
                  {inventoryItems.map((i) => (
                    <option key={i.id} value={i.id}>{i.itemCode} — {i.name} (Stock: {i.currentStock} {i.unitOfMeasure})</option>
                  ))}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Quantity Used *</span>
                <input className="input" type="number" name="quantityUsed" required min="0.001" step="0.001" placeholder="0" />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Notes</span>
                <input className="input" name="notes" placeholder="Optional" />
              </label>
              {error && <div style={{ padding: "8px 12px", borderRadius: 6, background: "var(--red-bg)", color: "var(--red)", fontSize: 13 }}>{error}</div>}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" className="btn" onClick={() => { setAddPartWoId(null); setError(""); }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isPending}>{isPending ? "Adding…" : "Add Part"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
