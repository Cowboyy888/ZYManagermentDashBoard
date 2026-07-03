"use client";

import { useState, useMemo, useCallback } from "react";
import { createInspection, updateInspectionStatus } from "@/actions/quality";

interface TestResult {
  id: number; parameter: string; unit: string | null;
  specMin: number | null; specMax: number | null;
  measuredValue: number | null; result: string | null; notes: string | null;
}

interface Inspection {
  id: number; inspectionNumber: string; type: string; status: string;
  productionOrderId: number | null; inventoryItemId: number | null; salesOrderId: number | null;
  batchNumber: string | null; productDescription: string | null; sampleSize: number | null;
  defectCount: number | null; result: string | null; inspectorId: number | null;
  inspectorName: string | null; inspectionDate: string; remarks: string | null;
  orderCode: string | null; inventoryItemName: string | null; salesOrderNumber: string | null;
  ncrCount: number; testResults: TestResult[]; createdAt: string;
}

interface Employee { id: number; nameEn: string }
interface ProductionOrder { id: number; orderCode: string }
interface InventoryItem { id: number; itemCode: string; name: string }
interface SalesOrder { id: number; orderNumber: string; customerName: string }

interface Props {
  inspections: Inspection[];
  employees: Employee[];
  productionOrders: ProductionOrder[];
  inventoryItems: InventoryItem[];
  salesOrders: SalesOrder[];
  canWrite: boolean;
  canApprove: boolean;
}

const TYPE_COLOR: Record<string, string> = {
  INCOMING: "#3b82f6",
  IN_PROCESS: "#f97316",
  FINAL: "#8b5cf6",
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: "#eab308",
  IN_PROGRESS: "#3b82f6",
  COMPLETE: "#22c55e",
  FAILED: "#ef4444",
};

const RESULT_COLOR: Record<string, string> = {
  PASS: "#22c55e",
  FAIL: "#ef4444",
  CONDITIONAL_PASS: "#f97316",
  REWORK: "#eab308",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const EMPTY_ROW = { parameter: "", unit: "", specMin: "", specMax: "", measuredValue: "", result: "PASS", notes: "" };

export function InspectionsManager({ inspections: initial, employees, productionOrders, inventoryItems, salesOrders, canWrite, canApprove }: Props) {
  const [inspections, setInspections] = useState(initial);
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [viewId, setViewId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    type: "INCOMING", productionOrderId: "", inventoryItemId: "", salesOrderId: "",
    batchNumber: "", productDescription: "", sampleSize: "", defectCount: "0",
    inspectorId: "", inspectionDate: new Date().toISOString().slice(0, 10), remarks: "",
    testResults: [{ ...EMPTY_ROW }] as typeof EMPTY_ROW[],
  });

  const filtered = useMemo(() => inspections.filter((i) => {
    if (typeFilter !== "ALL" && i.type !== typeFilter) return false;
    if (statusFilter !== "ALL" && i.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        i.inspectionNumber.toLowerCase().includes(q) ||
        (i.productDescription ?? "").toLowerCase().includes(q) ||
        (i.batchNumber ?? "").toLowerCase().includes(q) ||
        (i.orderCode ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  }), [inspections, typeFilter, statusFilter, search]);

  const viewInsp = useMemo(() => viewId ? inspections.find((i) => i.id === viewId) ?? null : null, [inspections, viewId]);

  const addRow = () => setForm((f) => ({ ...f, testResults: [...f.testResults, { ...EMPTY_ROW }] }));
  const removeRow = (idx: number) => setForm((f) => ({ ...f, testResults: f.testResults.filter((_, i) => i !== idx) }));
  const updateRow = (idx: number, key: string, val: string) => setForm((f) => ({
    ...f,
    testResults: f.testResults.map((r, i) => i === idx ? { ...r, [key]: val } : r),
  }));

  const handleCreate = useCallback(async () => {
    setSaving(true);
    setError("");
    const res = await createInspection({
      type: form.type,
      productionOrderId: form.productionOrderId || null,
      inventoryItemId: form.inventoryItemId || null,
      salesOrderId: form.salesOrderId || null,
      batchNumber: form.batchNumber || null,
      productDescription: form.productDescription || null,
      sampleSize: form.sampleSize ? Number(form.sampleSize) : null,
      defectCount: Number(form.defectCount),
      inspectorId: form.inspectorId || null,
      inspectionDate: form.inspectionDate,
      remarks: form.remarks || null,
      testResults: form.testResults
        .filter((r) => r.parameter)
        .map((r) => ({
          parameter: r.parameter,
          unit: r.unit || null,
          specMin: r.specMin ? Number(r.specMin) : null,
          specMax: r.specMax ? Number(r.specMax) : null,
          measuredValue: r.measuredValue ? Number(r.measuredValue) : null,
          result: r.result || null,
          notes: r.notes || null,
        })),
    });
    setSaving(false);
    if ("error" in res) { setError(res.error); return; }
    const d = res.data;
    const shaped: Inspection = {
      id: d.id, inspectionNumber: d.inspectionNumber,
      type: d.type as string, status: d.status as string,
      productionOrderId: d.productionOrderId, inventoryItemId: d.inventoryItemId, salesOrderId: d.salesOrderId,
      batchNumber: d.batchNumber, productDescription: d.productDescription,
      sampleSize: d.sampleSize, defectCount: d.defectCount, result: d.result as string | null,
      inspectorId: d.inspectorId,
      inspectorName: employees.find((e) => e.id === d.inspectorId)?.nameEn ?? null,
      inspectionDate: (d.inspectionDate as Date).toISOString(),
      remarks: d.remarks,
      orderCode: productionOrders.find((p) => p.id === d.productionOrderId)?.orderCode ?? null,
      inventoryItemName: inventoryItems.find((i) => i.id === d.inventoryItemId)?.name ?? null,
      salesOrderNumber: salesOrders.find((o) => o.id === d.salesOrderId)?.orderNumber ?? null,
      ncrCount: 0,
      testResults: (d.testResults ?? []).map((t) => ({
        id: t.id, parameter: t.parameter, unit: t.unit,
        specMin: t.specMin !== null ? Number(t.specMin) : null,
        specMax: t.specMax !== null ? Number(t.specMax) : null,
        measuredValue: t.measuredValue !== null ? Number(t.measuredValue) : null,
        result: t.result as string | null, notes: t.notes,
      })),
      createdAt: d.createdAt.toISOString(),
    };
    setInspections((prev) => [shaped, ...prev]);
    setShowCreate(false);
    setForm({ type: "INCOMING", productionOrderId: "", inventoryItemId: "", salesOrderId: "", batchNumber: "", productDescription: "", sampleSize: "", defectCount: "0", inspectorId: "", inspectionDate: new Date().toISOString().slice(0, 10), remarks: "", testResults: [{ ...EMPTY_ROW }] });
  }, [form, employees, productionOrders, inventoryItems, salesOrders]);

  const handleStatusChange = useCallback(async (id: number, status: string, result?: string) => {
    const res = await updateInspectionStatus({ id, status, result: result ?? null });
    if ("error" in res) return;
    const d = res.data;
    setInspections((prev) => prev.map((i) => i.id === id ? { ...i, status: d.status as string, result: d.result as string | null } : i));
  }, []);

  const INPUT = { style: { width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)", fontSize: 13 } };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <input {...INPUT} placeholder="Search inspections..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...INPUT.style, width: 220 }} />
        <select {...INPUT} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ ...INPUT.style, width: 160 }}>
          <option value="ALL">All Types</option>
          <option value="INCOMING">Incoming</option>
          <option value="IN_PROCESS">In-Process</option>
          <option value="FINAL">Final</option>
        </select>
        <select {...INPUT} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ ...INPUT.style, width: 160 }}>
          <option value="ALL">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="COMPLETE">Complete</option>
          <option value="FAILED">Failed</option>
        </select>
        {canWrite && (
          <button className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }} onClick={() => setShowCreate(true)}>
            + New Inspection
          </button>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto" }}>
          <div style={{ background: "var(--surface)", borderRadius: 12, padding: 24, width: "100%", maxWidth: 800, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700 }}>New Inspection</h2>
            {error && <div style={{ padding: "8px 12px", borderRadius: 6, background: "var(--red-bg)", color: "var(--red)", fontSize: 13, marginBottom: 12 }}>{error}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>Type *</span>
                <select {...INPUT} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                  <option value="INCOMING">Incoming Material</option>
                  <option value="IN_PROCESS">In-Process</option>
                  <option value="FINAL">Final Product</option>
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>Inspector</span>
                <select {...INPUT} value={form.inspectorId} onChange={(e) => setForm((f) => ({ ...f, inspectorId: e.target.value }))}>
                  <option value="">— Select —</option>
                  {employees.map((e) => <option key={e.id} value={e.id}>{e.nameEn}</option>)}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>Production Order</span>
                <select {...INPUT} value={form.productionOrderId} onChange={(e) => setForm((f) => ({ ...f, productionOrderId: e.target.value }))}>
                  <option value="">— None —</option>
                  {productionOrders.map((p) => <option key={p.id} value={p.id}>{p.orderCode}</option>)}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>Sales Order</span>
                <select {...INPUT} value={form.salesOrderId} onChange={(e) => setForm((f) => ({ ...f, salesOrderId: e.target.value }))}>
                  <option value="">— None —</option>
                  {salesOrders.map((o) => <option key={o.id} value={o.id}>{o.orderNumber} — {o.customerName}</option>)}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>Inventory Item</span>
                <select {...INPUT} value={form.inventoryItemId} onChange={(e) => setForm((f) => ({ ...f, inventoryItemId: e.target.value }))}>
                  <option value="">— None —</option>
                  {inventoryItems.map((i) => <option key={i.id} value={i.id}>{i.itemCode} — {i.name}</option>)}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>Inspection Date *</span>
                <input {...INPUT} type="date" value={form.inspectionDate} onChange={(e) => setForm((f) => ({ ...f, inspectionDate: e.target.value }))} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>Batch Number</span>
                <input {...INPUT} value={form.batchNumber} onChange={(e) => setForm((f) => ({ ...f, batchNumber: e.target.value }))} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>Product Description</span>
                <input {...INPUT} value={form.productDescription} onChange={(e) => setForm((f) => ({ ...f, productDescription: e.target.value }))} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>Sample Size</span>
                <input {...INPUT} type="number" min={1} value={form.sampleSize} onChange={(e) => setForm((f) => ({ ...f, sampleSize: e.target.value }))} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>Defect Count</span>
                <input {...INPUT} type="number" min={0} value={form.defectCount} onChange={(e) => setForm((f) => ({ ...f, defectCount: e.target.value }))} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "1 / -1" }}>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>Remarks</span>
                <textarea {...INPUT} rows={2} value={form.remarks} onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))} />
              </label>
            </div>

            {/* Test Results */}
            <div style={{ marginTop: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>Test Results</span>
                <button className="btn btn-sm" onClick={addRow}>+ Add Row</button>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "var(--surface-2)" }}>
                    {["Parameter", "Unit", "Spec Min", "Spec Max", "Measured", "Result", "Notes", ""].map((h) => (
                      <th key={h} style={{ padding: "4px 6px", textAlign: "left", color: "var(--text-3)", fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {form.testResults.map((row, idx) => (
                    <tr key={idx}>
                      <td><input value={row.parameter} onChange={(e) => updateRow(idx, "parameter", e.target.value)} style={{ width: 100, padding: "3px 6px", border: "1px solid var(--border)", borderRadius: 4, background: "var(--surface)", fontSize: 12 }} /></td>
                      <td><input value={row.unit} onChange={(e) => updateRow(idx, "unit", e.target.value)} style={{ width: 60, padding: "3px 6px", border: "1px solid var(--border)", borderRadius: 4, background: "var(--surface)", fontSize: 12 }} /></td>
                      <td><input type="number" value={row.specMin} onChange={(e) => updateRow(idx, "specMin", e.target.value)} style={{ width: 60, padding: "3px 6px", border: "1px solid var(--border)", borderRadius: 4, background: "var(--surface)", fontSize: 12 }} /></td>
                      <td><input type="number" value={row.specMax} onChange={(e) => updateRow(idx, "specMax", e.target.value)} style={{ width: 60, padding: "3px 6px", border: "1px solid var(--border)", borderRadius: 4, background: "var(--surface)", fontSize: 12 }} /></td>
                      <td><input type="number" value={row.measuredValue} onChange={(e) => updateRow(idx, "measuredValue", e.target.value)} style={{ width: 70, padding: "3px 6px", border: "1px solid var(--border)", borderRadius: 4, background: "var(--surface)", fontSize: 12 }} /></td>
                      <td>
                        <select value={row.result} onChange={(e) => updateRow(idx, "result", e.target.value)} style={{ padding: "3px 6px", border: "1px solid var(--border)", borderRadius: 4, background: "var(--surface)", fontSize: 12 }}>
                          <option value="PASS">PASS</option>
                          <option value="FAIL">FAIL</option>
                          <option value="CONDITIONAL_PASS">COND. PASS</option>
                        </select>
                      </td>
                      <td><input value={row.notes} onChange={(e) => updateRow(idx, "notes", e.target.value)} style={{ width: 100, padding: "3px 6px", border: "1px solid var(--border)", borderRadius: 4, background: "var(--surface)", fontSize: 12 }} /></td>
                      <td><button className="btn btn-sm" style={{ color: "var(--red)", fontSize: 11 }} onClick={() => removeRow(idx)}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button className="btn btn-primary" onClick={handleCreate} disabled={saving}>{saving ? "Saving…" : "Create Inspection"}</button>
              <button className="btn" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* View modal */}
      {viewInsp && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "40px 16px", overflowY: "auto" }} onClick={() => setViewId(null)}>
          <div style={{ background: "var(--surface)", borderRadius: 12, padding: 24, width: "100%", maxWidth: 720, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontFamily: "monospace" }}>{viewInsp.inspectionNumber}</h2>
                <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{viewInsp.type.replace(/_/g, " ")} • {fmt(viewInsp.inspectionDate)}</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {viewInsp.status === "PENDING" && canWrite && (
                  <button className="btn btn-sm" style={{ background: "#3b82f6", color: "#fff" }} onClick={() => handleStatusChange(viewInsp.id, "IN_PROGRESS")}>Start</button>
                )}
                {viewInsp.status === "IN_PROGRESS" && canApprove && (
                  <>
                    <button className="btn btn-sm" style={{ background: "#22c55e", color: "#fff" }} onClick={() => handleStatusChange(viewInsp.id, "COMPLETE", "PASS")}>Pass</button>
                    <button className="btn btn-sm" style={{ background: "#ef4444", color: "#fff" }} onClick={() => handleStatusChange(viewInsp.id, "FAILED", "FAIL")}>Fail</button>
                  </>
                )}
                <button className="btn btn-sm" onClick={() => setViewId(null)}>Close</button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 13, marginBottom: 16 }}>
              {[
                ["Status", <span key="s" className="tag" style={{ background: (STATUS_COLOR[viewInsp.status] ?? "#6b7280") + "20", color: STATUS_COLOR[viewInsp.status] ?? "#6b7280" }}>{viewInsp.status.replace(/_/g, " ")}</span>],
                ["Result", viewInsp.result ? <span key="r" className="tag" style={{ background: (RESULT_COLOR[viewInsp.result] ?? "#6b7280") + "20", color: RESULT_COLOR[viewInsp.result] ?? "#6b7280" }}>{viewInsp.result}</span> : "—"],
                ["Inspector", viewInsp.inspectorName ?? "—"],
                ["Sample Size", viewInsp.sampleSize ?? "—"],
                ["Defect Count", viewInsp.defectCount ?? 0],
                ["Batch #", viewInsp.batchNumber ?? "—"],
                ["Production Order", viewInsp.orderCode ?? "—"],
                ["Sales Order", viewInsp.salesOrderNumber ?? "—"],
                ["Product", viewInsp.productDescription ?? "—"],
                ["NCRs Raised", viewInsp.ncrCount],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>{k}</div>
                  <div style={{ marginTop: 2 }}>{v as React.ReactNode}</div>
                </div>
              ))}
            </div>
            {viewInsp.remarks && (
              <div style={{ marginBottom: 12, fontSize: 13 }}>
                <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600 }}>Remarks</div>
                <div style={{ marginTop: 4, padding: "8px 10px", background: "var(--surface-2)", borderRadius: 6 }}>{viewInsp.remarks}</div>
              </div>
            )}
            {viewInsp.testResults.length > 0 && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Test Results</div>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Parameter</th>
                      <th>Unit</th>
                      <th>Spec Min</th>
                      <th>Spec Max</th>
                      <th>Measured</th>
                      <th>Result</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewInsp.testResults.map((t) => (
                      <tr key={t.id}>
                        <td>{t.parameter}</td>
                        <td>{t.unit ?? "—"}</td>
                        <td>{t.specMin ?? "—"}</td>
                        <td>{t.specMax ?? "—"}</td>
                        <td>{t.measuredValue ?? "—"}</td>
                        <td>
                          {t.result && (
                            <span className="tag" style={{ background: (RESULT_COLOR[t.result] ?? "#6b7280") + "20", color: RESULT_COLOR[t.result] ?? "#6b7280" }}>{t.result}</span>
                          )}
                        </td>
                        <td style={{ color: "var(--text-3)" }}>{t.notes ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="panel">
        <div className="panel-head" style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Inspections ({filtered.length})</span>
        </div>
        <div className="panel-body" style={{ padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Inspection #</th>
                <th>Type</th>
                <th>Product</th>
                <th>Batch</th>
                <th>Inspector</th>
                <th>Date</th>
                <th>Status</th>
                <th>Result</th>
                <th>NCRs</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: "center", color: "var(--text-3)", padding: 24 }}>No inspections found</td></tr>
              )}
              {filtered.map((i) => (
                <tr key={i.id} style={{ cursor: "pointer" }} onClick={() => setViewId(i.id)}>
                  <td style={{ fontFamily: "monospace", fontSize: 12 }}>{i.inspectionNumber}</td>
                  <td>
                    <span className="tag" style={{ background: (TYPE_COLOR[i.type] ?? "#6b7280") + "20", color: TYPE_COLOR[i.type] ?? "#6b7280" }}>
                      {i.type.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.productDescription ?? "—"}</td>
                  <td style={{ fontSize: 12, color: "var(--text-3)" }}>{i.batchNumber ?? "—"}</td>
                  <td>{i.inspectorName ?? "—"}</td>
                  <td style={{ color: "var(--text-3)", fontSize: 12 }}>{fmt(i.inspectionDate)}</td>
                  <td>
                    <span className="tag" style={{ background: (STATUS_COLOR[i.status] ?? "#6b7280") + "20", color: STATUS_COLOR[i.status] ?? "#6b7280" }}>
                      {i.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td>
                    {i.result && (
                      <span className="tag" style={{ background: (RESULT_COLOR[i.result] ?? "#6b7280") + "20", color: RESULT_COLOR[i.result] ?? "#6b7280" }}>
                        {i.result}
                      </span>
                    )}
                  </td>
                  <td>{i.ncrCount > 0 ? <span className="tag" style={{ background: "#ef444420", color: "#ef4444" }}>{i.ncrCount}</span> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
