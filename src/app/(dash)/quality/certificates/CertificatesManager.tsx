"use client";

import { useState, useMemo, useCallback } from "react";
import { createCertificate } from "@/actions/quality";

interface Certificate {
  id: number; certificateNumber: string; type: string;
  inspectionId: number | null; inspectionNumber: string | null;
  customerId: number | null; customerName: string | null;
  salesOrderId: number | null; salesOrderNumber: string | null;
  productDescription: string | null; batchNumber: string | null;
  issuedDate: string; validUntil: string | null; issuedBy: string;
  remarks: string | null; createdAt: string;
}

interface CompletedInspection { id: number; inspectionNumber: string; type: string }
interface Customer { id: number; name: string; customerCode: string }
interface SalesOrder { id: number; orderNumber: string; customerName: string }

interface Props {
  certificates: Certificate[];
  completedInspections: CompletedInspection[];
  customers: Customer[];
  salesOrders: SalesOrder[];
  canWrite: boolean;
}

const TYPE_COLOR: Record<string, string> = {
  COC: "#22c55e",
  TEST_REPORT: "#3b82f6",
  INSPECTION_CERT: "#8b5cf6",
};

const TYPE_LABEL: Record<string, string> = {
  COC: "Certificate of Conformance",
  TEST_REPORT: "Test Report",
  INSPECTION_CERT: "Inspection Certificate",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function CertificatesManager({ certificates: initial, completedInspections, customers, salesOrders, canWrite }: Props) {
  const [certs, setCerts] = useState(initial);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [viewId, setViewId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    type: "COC", inspectionId: "", customerId: "", salesOrderId: "",
    productDescription: "", batchNumber: "", issuedDate: new Date().toISOString().slice(0, 10),
    validUntil: "", remarks: "",
  });

  const filtered = useMemo(() => certs.filter((c) => {
    if (typeFilter !== "ALL" && c.type !== typeFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        c.certificateNumber.toLowerCase().includes(q) ||
        (c.customerName ?? "").toLowerCase().includes(q) ||
        (c.batchNumber ?? "").toLowerCase().includes(q) ||
        (c.productDescription ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  }), [certs, typeFilter, search]);

  const viewCert = useMemo(() => viewId ? certs.find((c) => c.id === viewId) ?? null : null, [certs, viewId]);

  const handleCreate = useCallback(async () => {
    if (!form.productDescription.trim()) { setError("Product description is required"); return; }
    setSaving(true);
    setError("");
    const res = await createCertificate({
      type: form.type,
      inspectionId: form.inspectionId || null,
      customerId: form.customerId || null,
      salesOrderId: form.salesOrderId || null,
      productDescription: form.productDescription,
      batchNumber: form.batchNumber || null,
      issuedDate: form.issuedDate,
      validUntil: form.validUntil || null,
      remarks: form.remarks || null,
    });
    setSaving(false);
    if ("error" in res) { setError(res.error); return; }
    const d = res.data;
    const shaped: Certificate = {
      id: d.id, certificateNumber: d.certificateNumber, type: d.type as string,
      inspectionId: d.inspectionId,
      inspectionNumber: completedInspections.find((i) => i.id === d.inspectionId)?.inspectionNumber ?? null,
      customerId: d.customerId,
      customerName: customers.find((c) => c.id === d.customerId)?.name ?? null,
      salesOrderId: d.salesOrderId,
      salesOrderNumber: salesOrders.find((o) => o.id === d.salesOrderId)?.orderNumber ?? null,
      productDescription: d.productDescription, batchNumber: d.batchNumber,
      issuedDate: (d.issuedDate as Date).toISOString(),
      validUntil: d.validUntil ? (d.validUntil as Date).toISOString() : null,
      issuedBy: "You", remarks: d.remarks,
      createdAt: d.createdAt.toISOString(),
    };
    setCerts((prev) => [shaped, ...prev]);
    setShowCreate(false);
    setForm({ type: "COC", inspectionId: "", customerId: "", salesOrderId: "", productDescription: "", batchNumber: "", issuedDate: new Date().toISOString().slice(0, 10), validUntil: "", remarks: "" });
  }, [form, completedInspections, customers, salesOrders]);

  const INPUT = { style: { width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 13 } };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {["COC", "TEST_REPORT", "INSPECTION_CERT"].map((t) => (
          <div key={t} className="kpi-card" style={{ cursor: "pointer" }} onClick={() => setTypeFilter(typeFilter === t ? "ALL" : t)}>
            <div style={{ fontSize: 11, color: "var(--text-3)" }}>{TYPE_LABEL[t]}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: TYPE_COLOR[t], marginTop: 4 }}>{certs.filter((c) => c.type === t).length}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input {...INPUT} placeholder="Search certificates..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...INPUT.style, width: 220 }} />
        <select {...INPUT} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ ...INPUT.style, width: 200 }}>
          <option value="ALL">All Types</option>
          <option value="COC">Certificate of Conformance</option>
          <option value="TEST_REPORT">Test Report</option>
          <option value="INSPECTION_CERT">Inspection Certificate</option>
        </select>
        {canWrite && (
          <button className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }} onClick={() => setShowCreate(true)}>
            + Issue Certificate
          </button>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "var(--surface)", borderRadius: 12, padding: 24, width: "100%", maxWidth: 600, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700 }}>Issue Quality Certificate</h2>
            {error && <div style={{ padding: "8px 12px", borderRadius: 6, background: "var(--red-bg)", color: "var(--red)", fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "1 / -1" }}>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>Certificate Type *</span>
                <select {...INPUT} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                  <option value="COC">Certificate of Conformance (COC)</option>
                  <option value="TEST_REPORT">Test Report</option>
                  <option value="INSPECTION_CERT">Inspection Certificate</option>
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>Linked Inspection</span>
                <select {...INPUT} value={form.inspectionId} onChange={(e) => setForm((f) => ({ ...f, inspectionId: e.target.value }))}>
                  <option value="">— None —</option>
                  {completedInspections.map((i) => <option key={i.id} value={i.id}>{i.inspectionNumber} ({i.type.replace(/_/g, " ")})</option>)}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>Customer</span>
                <select {...INPUT} value={form.customerId} onChange={(e) => setForm((f) => ({ ...f, customerId: e.target.value }))}>
                  <option value="">— None —</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>Sales Order</span>
                <select {...INPUT} value={form.salesOrderId} onChange={(e) => setForm((f) => ({ ...f, salesOrderId: e.target.value }))}>
                  <option value="">— None —</option>
                  {salesOrders.map((o) => <option key={o.id} value={o.id}>{o.orderNumber} — {o.customerName}</option>)}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "1 / -1" }}>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>Product Description *</span>
                <input {...INPUT} value={form.productDescription} onChange={(e) => setForm((f) => ({ ...f, productDescription: e.target.value }))} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>Batch Number</span>
                <input {...INPUT} value={form.batchNumber} onChange={(e) => setForm((f) => ({ ...f, batchNumber: e.target.value }))} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>Issued Date *</span>
                <input {...INPUT} type="date" value={form.issuedDate} onChange={(e) => setForm((f) => ({ ...f, issuedDate: e.target.value }))} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>Valid Until</span>
                <input {...INPUT} type="date" value={form.validUntil} onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "1 / -1" }}>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>Remarks</span>
                <textarea {...INPUT} rows={2} value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} />
              </label>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>{saving ? "Saving…" : "Issue Certificate"}</button>
              <button className="btn" onClick={() => { setShowCreate(false); setError(""); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* View modal */}
      {viewCert && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={() => setViewId(null)}>
          <div style={{ background: "var(--surface)", borderRadius: 12, padding: 24, width: "100%", maxWidth: 560, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontFamily: "monospace" }}>{viewCert.certificateNumber}</h2>
                <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
                  <span className="tag" style={{ background: (TYPE_COLOR[viewCert.type] ?? "#6b7280") + "20", color: TYPE_COLOR[viewCert.type] ?? "#6b7280" }}>
                    {TYPE_LABEL[viewCert.type] ?? viewCert.type}
                  </span>
                </div>
              </div>
              <button className="btn btn-sm" onClick={() => setViewId(null)}>Close</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 13 }}>
              {[
                ["Customer", viewCert.customerName ?? "—"],
                ["Sales Order", viewCert.salesOrderNumber ?? "—"],
                ["Product", viewCert.productDescription ?? "—"],
                ["Batch #", viewCert.batchNumber ?? "—"],
                ["Inspection", viewCert.inspectionNumber ?? "—"],
                ["Issued By", viewCert.issuedBy],
                ["Issued Date", fmt(viewCert.issuedDate)],
                ["Valid Until", viewCert.validUntil ? fmt(viewCert.validUntil) : "—"],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>{k}</div>
                  <div style={{ marginTop: 2 }}>{v as React.ReactNode}</div>
                </div>
              ))}
            </div>
            {viewCert.remarks && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>Remarks</div>
                <div style={{ marginTop: 4, padding: "8px 10px", background: "var(--surface-2)", borderRadius: 6, fontSize: 13 }}>{viewCert.remarks}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="panel">
        <div className="panel-head">Certificates ({filtered.length})</div>
        <div className="panel-body" style={{ padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Certificate #</th>
                <th>Type</th>
                <th>Customer</th>
                <th>Product</th>
                <th>Batch #</th>
                <th>Issued Date</th>
                <th>Valid Until</th>
                <th>Issued By</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--text-3)", padding: 24 }}>No certificates found</td></tr>
              )}
              {filtered.map((c) => {
                const expired = c.validUntil && new Date(c.validUntil) < new Date();
                return (
                  <tr key={c.id} style={{ cursor: "pointer" }} onClick={() => setViewId(c.id)}>
                    <td style={{ fontFamily: "monospace", fontSize: 12 }}>{c.certificateNumber}</td>
                    <td>
                      <span className="tag" style={{ background: (TYPE_COLOR[c.type] ?? "#6b7280") + "20", color: TYPE_COLOR[c.type] ?? "#6b7280" }}>
                        {c.type.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td>{c.customerName ?? "—"}</td>
                    <td style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.productDescription ?? "—"}</td>
                    <td style={{ fontSize: 12, color: "var(--text-3)" }}>{c.batchNumber ?? "—"}</td>
                    <td style={{ color: "var(--text-3)", fontSize: 12 }}>{fmt(c.issuedDate)}</td>
                    <td style={{ color: expired ? "#ef4444" : "var(--text-3)", fontSize: 12, fontWeight: expired ? 600 : 400 }}>
                      {c.validUntil ? fmt(c.validUntil) : "—"}
                    </td>
                    <td>{c.issuedBy}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
