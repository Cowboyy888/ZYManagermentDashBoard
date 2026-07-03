"use client";
import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { createProductionOrder, updateOrderStatus, updateOrderLineQty } from "@/actions/production";

const ExportMenu = dynamic(() => import("@/components/ExportMenu").then((m) => m.ExportMenu), { ssr: false });

type OrderLine = { id: number; meshId: number; qtyOrdered: number; qtyProduced: number; mesh: { sku: string; lengthM: number; widthM: number; wireDiameterMm: number; gridSpacingMm: number } };
type Order = { id: number; orderCode: string; customer: string | null; priority: string; status: string; plannedDate: string; completedDate: string | null; notes: string | null; machine: { id: number; code: string; name: string } | null; supervisor: { id: number; nameEn: string } | null; lines: OrderLine[]; createdAt: string };
type MeshSku = { id: number; sku: string; lengthM: number; widthM: number; wireDiameterMm: number; gridSpacingMm: number; qtyInStock: number };

interface Props {
  orders: Order[];
  machines: { id: number; code: string; name: string }[];
  meshSkus: MeshSku[];
  supervisors: { id: number; nameEn: string }[];
  canManage: boolean;
  canWrite: boolean;
}

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  DRAFT:       { color: "var(--text-3)", background: "var(--surface-2)" },
  IN_PROGRESS: { color: "var(--amber)",  background: "var(--amber-bg)" },
  COMPLETED:   { color: "var(--green)",  background: "var(--green-bg)" },
  CANCELLED:   { color: "var(--red)",    background: "var(--red-bg)" },
};

const NEXT_STATUS: Record<string, "IN_PROGRESS" | "COMPLETED" | "CANCELLED"> = {
  DRAFT: "IN_PROGRESS", IN_PROGRESS: "COMPLETED",
};

export function OrdersManager({ orders, machines, meshSkus, supervisors, canManage, canWrite }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState("ALL");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ orderCode: "", customer: "", priority: "MEDIUM", machineId: "", supervisorId: "", plannedDate: "", notes: "" });
  const [lines, setLines] = useState<{ meshId: string; qtyOrdered: string }[]>([{ meshId: "", qtyOrdered: "" }]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [changing, setChanging] = useState<number | null>(null);

  const filtered = useMemo(() => filter === "ALL" ? orders : orders.filter((o) => o.status === filter), [orders, filter]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const res = await createProductionOrder({
        orderCode: form.orderCode,
        customer: form.customer || null,
        priority: form.priority as "LOW" | "MEDIUM" | "HIGH",
        machineId: form.machineId ? Number(form.machineId) : null,
        supervisorId: form.supervisorId ? Number(form.supervisorId) : null,
        plannedDate: form.plannedDate,
        notes: form.notes || null,
        lines: lines.filter((l) => l.meshId && l.qtyOrdered).map((l) => ({ meshId: Number(l.meshId), qtyOrdered: Number(l.qtyOrdered) })),
      });
      if (res.ok) { setMsg({ ok: true, text: `Order ${form.orderCode} created.` }); setShowForm(false); router.refresh(); }
      else { setMsg({ ok: false, text: "error" in res ? res.error : "Error" }); }
    });
  }

  async function handleStatusChange(id: number, status: "DRAFT" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED") {
    setChanging(id);
    const res = await updateOrderStatus(id, status);
    setChanging(null);
    if (res.ok) { router.refresh(); }
    else { setMsg({ ok: false, text: "error" in res ? res.error : "Error" }); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        {["DRAFT", "IN_PROGRESS", "COMPLETED", "CANCELLED"].map((s) => {
          const count = orders.filter((o) => o.status === s).length;
          return (
            <div key={s} className="kpi-card">
              <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500, marginBottom: 6 }}>{s.replace("_", " ")}</div>
              <div style={{ fontSize: 26, fontWeight: 800, ...STATUS_STYLE[s] }}>{count}</div>
            </div>
          );
        })}
      </div>

      {/* Bar */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {canManage && <button className="btn btn-primary" onClick={() => { setShowForm((v) => !v); setMsg(null); }}>{showForm ? "Cancel" : "+ New Order"}</button>}
        <ExportMenu
          title="Production Orders"
          filename="production-orders"
          data={filtered.map((o) => ({
            "Order Code": o.orderCode,
            Customer: o.customer ?? "",
            Priority: o.priority,
            Status: o.status,
            Machine: o.machine?.code ?? "",
            "Planned Date": new Date(o.plannedDate).toLocaleDateString("en-GB"),
            "Qty Ordered": o.lines.reduce((s, l) => s + l.qtyOrdered, 0),
            "Qty Produced": o.lines.reduce((s, l) => s + l.qtyProduced, 0),
          }))}
          columns={[
            { key: "Order Code", header: "Order Code" },
            { key: "Customer", header: "Customer" },
            { key: "Priority", header: "Priority" },
            { key: "Status", header: "Status" },
            { key: "Machine", header: "Machine" },
            { key: "Planned Date", header: "Planned Date" },
            { key: "Qty Ordered", header: "Qty Ordered" },
            { key: "Qty Produced", header: "Qty Produced" },
          ]}
        />
      </div>
        <div style={{ display: "flex", gap: 4 }}>
          {["ALL", "DRAFT", "IN_PROGRESS", "COMPLETED", "CANCELLED"].map((s) => (
            <button key={s} onClick={() => setFilter(s)} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 12, cursor: "pointer", fontWeight: 500, background: filter === s ? "var(--steel)" : "var(--surface)", color: filter === s ? "#fff" : "var(--text-2)" }}>
              {s === "ALL" ? "All" : s.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {msg && <div style={{ padding: "10px 14px", borderRadius: 8, fontSize: 13, background: msg.ok ? "var(--green-bg)" : "var(--red-bg)", color: msg.ok ? "var(--green)" : "var(--red)" }}>{msg.text}</div>}

      {/* Create form */}
      {showForm && canManage && (
        <div className="panel">
          <div className="panel-head"><span className="panel-title">New Production Order</span></div>
          <form onSubmit={handleCreate} className="panel-body">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Order Code</label>
                <input className="form-input" required placeholder="PO-2026-001" value={form.orderCode} onChange={(e) => setForm((f) => ({ ...f, orderCode: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Customer</label>
                <input className="form-input" placeholder="Customer name" value={form.customer} onChange={(e) => setForm((f) => ({ ...f, customer: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Priority</label>
                <select className="form-select" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}>
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Planned Date</label>
                <input type="date" className="form-input" required value={form.plannedDate} onChange={(e) => setForm((f) => ({ ...f, plannedDate: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Machine</label>
                <select className="form-select" value={form.machineId} onChange={(e) => setForm((f) => ({ ...f, machineId: e.target.value }))}>
                  <option value="">— any —</option>
                  {machines.map((m) => <option key={m.id} value={m.id}>{m.code} — {m.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Supervisor</label>
                <select className="form-select" value={form.supervisorId} onChange={(e) => setForm((f) => ({ ...f, supervisorId: e.target.value }))}>
                  <option value="">— none —</option>
                  {supervisors.map((s) => <option key={s.id} value={s.id}>{s.nameEn}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Notes</label>
                <input className="form-input" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>

            {/* Line items */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 8 }}>Mesh items to produce</div>
              {lines.map((line, i) => (
                <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "center" }}>
                  <select className="form-select" style={{ flex: 1 }} value={line.meshId} onChange={(e) => setLines((ls) => ls.map((l, j) => j === i ? { ...l, meshId: e.target.value } : l))}>
                    <option value="">Select SKU…</option>
                    {meshSkus.map((m) => <option key={m.id} value={m.id}>{m.sku}</option>)}
                  </select>
                  <input type="number" className="form-input" style={{ width: 100 }} placeholder="Qty" min={1} value={line.qtyOrdered} onChange={(e) => setLines((ls) => ls.map((l, j) => j === i ? { ...l, qtyOrdered: e.target.value } : l))} />
                  {lines.length > 1 && <button type="button" className="btn btn-danger" style={{ height: 28, padding: "0 8px", fontSize: 12 }} onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>✕</button>}
                </div>
              ))}
              <button type="button" className="btn" style={{ height: 28, fontSize: 12 }} onClick={() => setLines((ls) => [...ls, { meshId: "", qtyOrdered: "" }])}>+ Add line</button>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button type="submit" className="btn btn-primary" disabled={isPending}>{isPending ? <><span className="spinner" />Saving…</> : "Create Order"}</button>
              <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Orders table */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Orders</span>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>{filtered.length} shown</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>No orders found</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>Order Code</th><th>Customer</th><th>Priority</th><th>Status</th><th>Machine</th><th>Planned</th><th>Progress</th>{canManage && <th>Actions</th>}</tr>
              </thead>
              <tbody>
                {filtered.map((o) => {
                  const totalOrdered = o.lines.reduce((s, l) => s + l.qtyOrdered, 0);
                  const totalProduced = o.lines.reduce((s, l) => s + l.qtyProduced, 0);
                  const pct = totalOrdered > 0 ? Math.min(100, Math.round((totalProduced / totalOrdered) * 100)) : 0;
                  return (
                    <tr key={o.id}>
                      <td><code style={{ fontSize: 12, fontWeight: 700, color: "var(--steel)" }}>{o.orderCode}</code></td>
                      <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{o.customer ?? "—"}</td>
                      <td>
                        <span className="tag" style={{ background: o.priority === "HIGH" ? "var(--red-bg)" : o.priority === "LOW" ? "var(--blue-bg)" : "var(--amber-bg)", color: o.priority === "HIGH" ? "var(--red)" : o.priority === "LOW" ? "var(--blue)" : "var(--amber)" }}>
                          {o.priority}
                        </span>
                      </td>
                      <td><span className="tag" style={{ ...STATUS_STYLE[o.status] }}>{o.status.replace("_", " ")}</span></td>
                      <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{o.machine?.code ?? "—"}</td>
                      <td style={{ fontSize: 12.5, color: "var(--text-2)", whiteSpace: "nowrap" }}>{new Date(o.plannedDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
                      <td>
                        {totalOrdered > 0 && (
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 80, height: 6, borderRadius: 3, background: "var(--border)", overflow: "hidden" }}>
                              <div style={{ width: `${pct}%`, height: "100%", background: pct === 100 ? "var(--green)" : "var(--steel)", borderRadius: 3 }} />
                            </div>
                            <span style={{ fontSize: 11.5, color: "var(--text-2)" }}>{pct}%</span>
                          </div>
                        )}
                      </td>
                      {canManage && (
                        <td>
                          {NEXT_STATUS[o.status] && (
                            <button
                              className="btn"
                              style={{ height: 28, padding: "0 10px", fontSize: 12 }}
                              disabled={changing === o.id}
                              onClick={() => handleStatusChange(o.id, NEXT_STATUS[o.status])}
                            >
                              {changing === o.id ? <span className="spinner" /> : `→ ${NEXT_STATUS[o.status].replace("_", " ")}`}
                            </button>
                          )}
                          {o.status !== "CANCELLED" && o.status !== "COMPLETED" && (
                            <button className="btn btn-danger" style={{ height: 28, padding: "0 8px", fontSize: 12, marginLeft: 4 }} onClick={() => handleStatusChange(o.id, "CANCELLED")}>Cancel</button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
