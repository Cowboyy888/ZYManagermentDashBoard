"use client";
import { useState, useTransition, useMemo } from "react";
import dynamic from "next/dynamic";
import { createRequisition, submitRequisition, approveRequisition } from "@/actions/purchasing";

const ExportMenu = dynamic(() => import("@/components/ExportMenu").then((m) => m.ExportMenu), { ssr: false });

type PRItem = { id: number; description: string; unitOfMeasure: string; quantity: number; estimatedUnitCost: number | null; notes: string | null; inventoryItemId: number | null };
type PR = { id: number; prNumber: string; departmentName: string | null; requestedBy: string; approvedBy: string | null; status: string; requiredDate: string; reason: string | null; notes: string | null; itemCount: number; linkedPOs: number; items: PRItem[]; createdAt: string };
type Dept = { id: number; name: string };
type InvItem = { id: number; itemCode: string; name: string; unitOfMeasure: string };

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  DRAFT:     { bg: "var(--border)",    color: "var(--text-3)", label: "Draft" },
  SUBMITTED: { bg: "var(--amber-bg)", color: "var(--amber)",  label: "Submitted" },
  APPROVED:  { bg: "var(--green-bg)", color: "var(--green)",  label: "Approved" },
  REJECTED:  { bg: "var(--red-bg)",   color: "var(--red)",    label: "Rejected" },
  ORDERED:   { bg: "var(--blue-bg)",  color: "var(--blue)",   label: "Ordered" },
};

const blankLine = { inventoryItemId: "", description: "", unitOfMeasure: "", quantity: "", estimatedUnitCost: "", notes: "" };
const blankForm = { departmentId: "", requiredDate: "", reason: "", notes: "", items: [{ ...blankLine }] };

function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }

export function RequisitionsManager({ requisitions: initial, departments, inventoryItems, canWrite, canApprove }: {
  requisitions: PR[]; departments: Dept[]; inventoryItems: InvItem[]; canWrite: boolean; canApprove: boolean;
}) {
  const [prs, setPRs]         = useState(initial);
  const [filter, setFilter]   = useState("");
  const [search, setSearch]   = useState("");
  const [viewPR, setView]     = useState<PR | null>(null);
  const [showForm, setShow]   = useState(false);
  const [form, setForm]       = useState(blankForm);
  const [err, setErr]         = useState("");
  const [pending, startT]     = useTransition();

  const filtered = useMemo(() => prs.filter((p) => {
    if (filter && p.status !== filter) return false;
    if (search && !`${p.prNumber} ${p.requestedBy} ${p.departmentName ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [prs, filter, search]);

  const exportData = useMemo(() => filtered.map((pr) => ({
    "PR Number": pr.prNumber, "Department": pr.departmentName ?? "", "Requested By": pr.requestedBy,
    "Status": pr.status, "Required Date": fmtDate(pr.requiredDate),
    "Items": pr.itemCount, "Reason": pr.reason ?? "",
  })), [filtered]);

  function addLine() { setForm((p) => ({ ...p, items: [...p.items, { ...blankLine }] })); }
  function removeLine(idx: number) { setForm((p) => ({ ...p, items: p.items.filter((_, i) => i !== idx) })); }
  function setLine(idx: number, key: string, val: string) {
    setForm((p) => { const items = [...p.items]; items[idx] = { ...items[idx], [key]: val }; return { ...p, items }; });
  }

  function populateLine(idx: number, itemId: string) {
    const item = inventoryItems.find((i) => String(i.id) === itemId);
    if (!item) return;
    setForm((p) => {
      const items = [...p.items];
      items[idx] = { ...items[idx], inventoryItemId: itemId, description: item.name, unitOfMeasure: item.unitOfMeasure };
      return { ...p, items };
    });
  }

  function openForm() { setForm(blankForm); setErr(""); setShow(true); }

  function submit() {
    setErr("");
    startT(async () => {
      const payload = {
        departmentId: form.departmentId ? Number(form.departmentId) : undefined,
        requiredDate: form.requiredDate,
        reason: form.reason || undefined,
        notes: form.notes || undefined,
        items: form.items.filter((i) => i.description && i.quantity).map((i) => ({
          inventoryItemId: i.inventoryItemId ? Number(i.inventoryItemId) : undefined,
          description: i.description, unitOfMeasure: i.unitOfMeasure || "pcs",
          quantity: Number(i.quantity),
          estimatedUnitCost: i.estimatedUnitCost ? Number(i.estimatedUnitCost) : undefined,
          notes: i.notes || undefined,
        })),
      };
      const res = await createRequisition(payload);
      if ("error" in res) { setErr(res.error); return; }
      const dept = departments.find((d) => d.id === (form.departmentId ? Number(form.departmentId) : -1));
      setPRs((p) => [{
        id: res.data.id, prNumber: res.data.prNumber,
        departmentName: dept?.name ?? null, requestedBy: "Me",
        approvedBy: null, status: res.data.status,
        requiredDate: res.data.requiredDate.toISOString(),
        reason: res.data.reason, notes: res.data.notes,
        itemCount: res.data.items.length, linkedPOs: 0,
        items: res.data.items.map((i) => ({
          id: i.id, description: i.description, unitOfMeasure: i.unitOfMeasure,
          quantity: Number(i.quantity), estimatedUnitCost: i.estimatedUnitCost !== null ? Number(i.estimatedUnitCost) : null,
          notes: i.notes, inventoryItemId: i.inventoryItemId,
        })),
        createdAt: res.data.createdAt.toISOString(),
      }, ...p]);
      setShow(false);
    });
  }

  function doSubmit(pr: PR) {
    startT(async () => {
      const res = await submitRequisition(pr.id);
      if (!("error" in res)) setPRs((p) => p.map((x) => x.id === pr.id ? { ...x, status: "SUBMITTED" } : x));
    });
  }

  function doApprove(pr: PR, approve: boolean) {
    startT(async () => {
      const res = await approveRequisition({ id: pr.id, approve });
      if (!("error" in res)) {
        setPRs((p) => p.map((x) => x.id === pr.id ? { ...x, status: approve ? "APPROVED" : "REJECTED", approvedBy: "Me" } : x));
        if (viewPR?.id === pr.id) setView((v) => v ? { ...v, status: approve ? "APPROVED" : "REJECTED" } : null);
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search PR#, requester…"
          style={{ padding: "7px 12px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, width: 220 }} />
        <select value={filter} onChange={(e) => setFilter(e.target.value)}
          style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13 }}>
          <option value="">All Statuses</option>
          {["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "ORDERED"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <ExportMenu title="Purchase Requisitions" filename="purchase-requisitions" data={exportData} columns={[
            { key: "PR Number", header: "PR#" }, { key: "Department", header: "Dept" },
            { key: "Requested By", header: "By" }, { key: "Status", header: "Status" },
            { key: "Required Date", header: "Required" }, { key: "Items", header: "Items" }, { key: "Reason", header: "Reason" },
          ]} />
          {canWrite && <button className="btn btn-primary" onClick={openForm}>+ New Requisition</button>}
        </div>
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="panel">
          <div className="panel-head"><span className="panel-title">New Purchase Requisition</span><button className="btn btn-sm" onClick={() => setShow(false)}>×</button></div>
          <div className="panel-body">
            {err && <div style={{ marginBottom: 14, padding: "8px 12px", borderRadius: 6, background: "var(--red-bg)", color: "var(--red)", fontSize: 12.5 }}>{err}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px 16px", marginBottom: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-2)" }}>Department</label>
                <select value={form.departmentId} onChange={(e) => setForm((p) => ({ ...p, departmentId: e.target.value }))}
                  style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13 }}>
                  <option value="">Select department</option>
                  {departments.map((d) => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-2)" }}>Required Date *</label>
                <input type="date" value={form.requiredDate} onChange={(e) => setForm((p) => ({ ...p, requiredDate: e.target.value }))}
                  style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13 }} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-2)" }}>Reason</label>
                <input value={form.reason} onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
                  style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13 }} />
              </div>
            </div>

            {/* Line items */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", marginBottom: 8 }}>Items *</div>
              {form.items.map((line, idx) => (
                <div key={idx} style={{ display: "grid", gridTemplateColumns: "2fr 2fr 1fr 1fr 1fr auto", gap: 8, marginBottom: 8, alignItems: "end" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <label style={{ fontSize: 10.5, color: "var(--text-3)" }}>Inventory Item (optional)</label>
                    <select value={line.inventoryItemId} onChange={(e) => populateLine(idx, e.target.value)}
                      style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 12 }}>
                      <option value="">— None —</option>
                      {inventoryItems.map((i) => <option key={i.id} value={String(i.id)}>{i.itemCode} — {i.name}</option>)}
                    </select>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <label style={{ fontSize: 10.5, color: "var(--text-3)" }}>Description *</label>
                    <input value={line.description} onChange={(e) => setLine(idx, "description", e.target.value)}
                      style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 12 }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <label style={{ fontSize: 10.5, color: "var(--text-3)" }}>UOM</label>
                    <input value={line.unitOfMeasure} onChange={(e) => setLine(idx, "unitOfMeasure", e.target.value)} placeholder="pcs"
                      style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 12 }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <label style={{ fontSize: 10.5, color: "var(--text-3)" }}>Qty *</label>
                    <input type="number" step="any" min="0" value={line.quantity} onChange={(e) => setLine(idx, "quantity", e.target.value)}
                      style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 12 }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <label style={{ fontSize: 10.5, color: "var(--text-3)" }}>Est. Cost (USD)</label>
                    <input type="number" step="any" min="0" value={line.estimatedUnitCost} onChange={(e) => setLine(idx, "estimatedUnitCost", e.target.value)}
                      style={{ padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 12 }} />
                  </div>
                  <button className="btn btn-sm" onClick={() => removeLine(idx)} style={{ color: "var(--red)" }} disabled={form.items.length === 1}>×</button>
                </div>
              ))}
              <button className="btn btn-sm" onClick={addLine}>+ Add Item</button>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setShow(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={submit} disabled={pending || !form.requiredDate}>
                {pending ? "Saving…" : "Save as Draft"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Requisitions ({filtered.length}{filtered.length !== prs.length ? ` of ${prs.length}` : ""})</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr><th>PR Number</th><th>Department</th><th>Requested By</th><th>Required</th><th>Items</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", padding: "40px 0", color: "var(--text-3)", fontSize: 13 }}>No requisitions found</td></tr>}
              {filtered.map((pr) => {
                const s = STATUS_STYLE[pr.status] ?? STATUS_STYLE.DRAFT;
                return (
                  <tr key={pr.id}>
                    <td><code style={{ fontSize: 12, fontWeight: 700, color: "var(--steel)", background: "var(--steel-light)", padding: "2px 6px", borderRadius: 4 }}>{pr.prNumber}</code></td>
                    <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{pr.departmentName ?? "—"}</td>
                    <td style={{ fontWeight: 500 }}>{pr.requestedBy}</td>
                    <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{fmtDate(pr.requiredDate)}</td>
                    <td className="num">{pr.itemCount}</td>
                    <td><span className="tag" style={{ background: s.bg, color: s.color }}>{s.label}</span></td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-sm" onClick={() => setView(pr)}>View</button>
                        {canWrite && pr.status === "DRAFT" && <button className="btn btn-sm" onClick={() => doSubmit(pr)} disabled={pending}>Submit</button>}
                        {canApprove && pr.status === "SUBMITTED" && (
                          <>
                            <button className="btn btn-sm" style={{ color: "var(--green)" }} onClick={() => doApprove(pr, true)} disabled={pending}>Approve</button>
                            <button className="btn btn-sm" style={{ color: "var(--red)" }} onClick={() => doApprove(pr, false)} disabled={pending}>Reject</button>
                          </>
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

      {/* View modal */}
      {viewPR && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", overflowY: "auto" }} onClick={() => setView(null)}>
          <div style={{ background: "var(--surface)", borderRadius: 12, padding: 28, width: 640, maxWidth: "95vw", boxShadow: "0 8px 40px rgba(0,0,0,0.25)", margin: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{viewPR.prNumber}</h2>
                <div style={{ fontSize: 12.5, color: "var(--text-3)", marginTop: 2 }}>Requested by {viewPR.requestedBy} · Required by {fmtDate(viewPR.requiredDate)}</div>
              </div>
              {(() => { const s = STATUS_STYLE[viewPR.status] ?? STATUS_STYLE.DRAFT; return <span className="tag" style={{ background: s.bg, color: s.color, fontSize: 12.5 }}>{s.label}</span>; })()}
            </div>
            {viewPR.reason && <div style={{ marginBottom: 16, padding: "8px 12px", background: "var(--surface-2)", borderRadius: 8, fontSize: 13, color: "var(--text-2)" }}>{viewPR.reason}</div>}
            <table className="data-table" style={{ marginBottom: 20 }}>
              <thead><tr><th>Description</th><th>UOM</th><th className="num">Qty</th><th className="num">Est. Cost</th></tr></thead>
              <tbody>
                {viewPR.items.map((i) => (
                  <tr key={i.id}>
                    <td>{i.description}</td>
                    <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{i.unitOfMeasure}</td>
                    <td className="num" style={{ fontWeight: 700 }}>{i.quantity}</td>
                    <td className="num" style={{ color: "var(--text-2)" }}>{i.estimatedUnitCost !== null ? `$${i.estimatedUnitCost.toFixed(4)}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn" onClick={() => setView(null)}>Close</button>
              {canWrite && viewPR.status === "DRAFT" && <button className="btn btn-primary" onClick={() => { doSubmit(viewPR); setView(null); }} disabled={pending}>Submit</button>}
              {canApprove && viewPR.status === "SUBMITTED" && (
                <>
                  <button className="btn" style={{ color: "var(--red)", borderColor: "var(--red)" }} onClick={() => doApprove(viewPR, false)} disabled={pending}>Reject</button>
                  <button className="btn btn-primary" onClick={() => doApprove(viewPR, true)} disabled={pending}>Approve</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
