"use client";
import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createQualityCheck } from "@/actions/production";

type Check = {
  id: string; checkDate: string; meshSku: string;
  sampleSize: number; defectCount: number; result: string; notes: string | null;
  order: { id: number; orderCode: string } | null;
  inspectedBy: { id: number; nameEn: string } | null;
  createdAt: string;
};

interface Props {
  checks: Check[];
  orders: { id: number; orderCode: string }[];
  meshSkus: string[];
  employees: { id: number; nameEn: string }[];
  canWrite: boolean;
}

const RESULT_STYLE: Record<string, React.CSSProperties> = {
  PASS:   { color: "var(--green)", background: "var(--green-bg)" },
  FAIL:   { color: "var(--red)",   background: "var(--red-bg)" },
  REWORK: { color: "var(--amber)", background: "var(--amber-bg)" },
};

const emptyForm = { checkDate: new Date().toISOString().slice(0, 10), meshSku: "", sampleSize: "", defectCount: "0", result: "PASS", orderId: "", inspectedById: "", notes: "" };

export function QualityManager({ checks, orders, meshSkus, employees, canWrite }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [resultFilter, setResultFilter] = useState("ALL");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const filtered = useMemo(() => resultFilter === "ALL" ? checks : checks.filter((c) => c.result === resultFilter), [checks, resultFilter]);

  const passCount = checks.filter((c) => c.result === "PASS").length;
  const failCount = checks.filter((c) => c.result === "FAIL").length;
  const reworkCount = checks.filter((c) => c.result === "REWORK").length;
  const passRate = checks.length > 0 ? Math.round((passCount / checks.length) * 100) : 0;

  const totalDefects = useMemo(() => checks.reduce((s, c) => s + c.defectCount, 0), [checks]);
  const totalSampled = useMemo(() => checks.reduce((s, c) => s + c.sampleSize, 0), [checks]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const res = await createQualityCheck({
        checkDate: form.checkDate,
        meshSku: form.meshSku,
        sampleSize: Number(form.sampleSize),
        defectCount: Number(form.defectCount),
        result: form.result as "PASS" | "FAIL" | "REWORK",
        orderId: form.orderId ? Number(form.orderId) : null,
        inspectedById: form.inspectedById ? Number(form.inspectedById) : null,
        notes: form.notes || null,
      });
      if (res.ok) { setMsg({ ok: true, text: "QC record saved." }); setShowForm(false); setForm(emptyForm); router.refresh(); }
      else { setMsg({ ok: false, text: "error" in res ? res.error : "Error" }); }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        <div className="kpi-card">
          <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500, marginBottom: 6 }}>Pass Rate</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: passRate >= 95 ? "var(--green)" : passRate >= 80 ? "var(--amber)" : "var(--red)" }}>{passRate}%</div>
        </div>
        <div className="kpi-card">
          <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500, marginBottom: 6 }}>Passed</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "var(--green)" }}>{passCount}</div>
        </div>
        <div className="kpi-card">
          <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500, marginBottom: 6 }}>Failed</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: failCount > 0 ? "var(--red)" : "var(--text-3)" }}>{failCount}</div>
        </div>
        <div className="kpi-card">
          <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500, marginBottom: 6 }}>Defects / Sampled</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)" }}>{totalDefects} / {totalSampled}</div>
        </div>
      </div>

      {/* Actions + filter */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {canWrite && (
          <button className="btn btn-primary" onClick={() => { setShowForm((v) => !v); setMsg(null); }}>{showForm ? "Cancel" : "+ Log QC Check"}</button>
        )}
        <div style={{ display: "flex", gap: 4 }}>
          {["ALL", "PASS", "FAIL", "REWORK"].map((r) => (
            <button key={r} onClick={() => setResultFilter(r)} style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 12, cursor: "pointer", fontWeight: 500, background: resultFilter === r ? "var(--steel)" : "var(--surface)", color: resultFilter === r ? "#fff" : "var(--text-2)" }}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {msg && <div style={{ padding: "10px 14px", borderRadius: 8, fontSize: 13, background: msg.ok ? "var(--green-bg)" : "var(--red-bg)", color: msg.ok ? "var(--green)" : "var(--red)" }}>{msg.text}</div>}

      {/* Entry form */}
      {showForm && canWrite && (
        <div className="panel">
          <div className="panel-head"><span className="panel-title">New QC Inspection</span></div>
          <form onSubmit={handleCreate} className="panel-body">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Check Date</label>
                <input type="date" className="form-input" required value={form.checkDate} onChange={(e) => setForm((f) => ({ ...f, checkDate: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Mesh SKU</label>
                {meshSkus.length > 0 ? (
                  <select className="form-select" required value={form.meshSku} onChange={(e) => setForm((f) => ({ ...f, meshSku: e.target.value }))}>
                    <option value="">Select SKU…</option>
                    {meshSkus.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <input className="form-input" required placeholder="RM-4.0-2x3-150" value={form.meshSku} onChange={(e) => setForm((f) => ({ ...f, meshSku: e.target.value }))} />
                )}
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Result</label>
                <select className="form-select" required value={form.result} onChange={(e) => setForm((f) => ({ ...f, result: e.target.value }))}>
                  <option value="PASS">PASS</option>
                  <option value="FAIL">FAIL</option>
                  <option value="REWORK">REWORK</option>
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Sample Size (pcs)</label>
                <input type="number" className="form-input" required min={1} placeholder="10" value={form.sampleSize} onChange={(e) => setForm((f) => ({ ...f, sampleSize: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Defect Count</label>
                <input type="number" className="form-input" min={0} placeholder="0" value={form.defectCount} onChange={(e) => setForm((f) => ({ ...f, defectCount: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Production Order</label>
                <select className="form-select" value={form.orderId} onChange={(e) => setForm((f) => ({ ...f, orderId: e.target.value }))}>
                  <option value="">— none —</option>
                  {orders.map((o) => <option key={o.id} value={o.id}>{o.orderCode}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Inspector</label>
                <select className="form-select" value={form.inspectedById} onChange={(e) => setForm((f) => ({ ...f, inspectedById: e.target.value }))}>
                  <option value="">— none —</option>
                  {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.nameEn}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "2/-1" }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Notes</label>
                <input className="form-input" value={form.notes} placeholder="Optional notes…" onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
              <button type="submit" className="btn btn-primary" disabled={isPending}>{isPending ? <><span className="spinner" />Saving…</> : "Save QC Check"}</button>
              <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Inspection Records</span>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>{filtered.length} shown</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>No QC records found</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>Date</th><th>SKU</th><th>Result</th><th>Sample</th><th>Defects</th><th>Defect Rate</th><th>Order</th><th>Inspector</th><th>Notes</th></tr>
              </thead>
              <tbody>
                {filtered.map((c) => {
                  const defectPct = c.sampleSize > 0 ? ((c.defectCount / c.sampleSize) * 100).toFixed(1) : "0.0";
                  return (
                    <tr key={c.id}>
                      <td style={{ whiteSpace: "nowrap", fontWeight: 500 }}>{new Date(c.checkDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
                      <td><code style={{ fontSize: 12, fontWeight: 600, color: "var(--steel)" }}>{c.meshSku}</code></td>
                      <td><span className="tag" style={{ ...RESULT_STYLE[c.result], fontWeight: 700 }}>{c.result}</span></td>
                      <td>{c.sampleSize}</td>
                      <td style={{ color: c.defectCount > 0 ? "var(--red)" : "var(--text-3)" }}>{c.defectCount}</td>
                      <td style={{ fontSize: 12.5, color: Number(defectPct) > 5 ? "var(--red)" : "var(--text-2)" }}>{defectPct}%</td>
                      <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{c.order?.orderCode ?? "—"}</td>
                      <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{c.inspectedBy?.nameEn ?? "—"}</td>
                      <td style={{ fontSize: 12, color: "var(--text-3)", maxWidth: 160 }}><span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{c.notes ?? "—"}</span></td>
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
