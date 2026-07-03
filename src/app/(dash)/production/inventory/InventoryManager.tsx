"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createWireBatch, updateWireRemaining, createMeshSku, adjustMeshStock } from "@/actions/production";

type Wire = { id: number; batchCode: string; wireDiameterMm: number; weightKg: number; remainingKg: number; supplier: string | null; receivedDate: string; notes: string | null };
type Mesh = { id: number; sku: string; lengthM: number; widthM: number; wireDiameterMm: number; gridSpacingMm: number; qtyInStock: number; unitWeightKg: number; notes: string | null };

interface Props {
  wire: Wire[];
  mesh: Mesh[];
  canWrite: boolean;
  canManage: boolean;
}

const emptyWireForm = { batchCode: "", wireDiameterMm: "", weightKg: "", supplier: "", receivedDate: new Date().toISOString().slice(0, 10), notes: "" };
const emptyMeshForm = { sku: "", lengthM: "", widthM: "", wireDiameterMm: "", gridSpacingMm: "", unitWeightKg: "", qtyInitial: "0", notes: "" };

export function InventoryManager({ wire, mesh, canWrite, canManage }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tab, setTab] = useState<"wire" | "mesh">("wire");
  const [showWireForm, setShowWireForm] = useState(false);
  const [showMeshForm, setShowMeshForm] = useState(false);
  const [wireForm, setWireForm] = useState(emptyWireForm);
  const [meshForm, setMeshForm] = useState(emptyMeshForm);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [adjustId, setAdjustId] = useState<number | null>(null);
  const [adjustQty, setAdjustQty] = useState("");
  const [adjustingWireId, setAdjustingWireId] = useState<number | null>(null);
  const [wireRemaining, setWireRemaining] = useState("");

  async function handleAddWire(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const res = await createWireBatch({
        batchCode: wireForm.batchCode,
        wireDiameterMm: Number(wireForm.wireDiameterMm),
        weightKg: Number(wireForm.weightKg),
        supplier: wireForm.supplier || null,
        receivedDate: wireForm.receivedDate,
        notes: wireForm.notes || null,
      });
      if (res.ok) { setMsg({ ok: true, text: "Wire batch added." }); setShowWireForm(false); setWireForm(emptyWireForm); router.refresh(); }
      else { setMsg({ ok: false, text: "error" in res ? res.error : "Error" }); }
    });
  }

  async function handleAddMesh(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const res = await createMeshSku({
        sku: meshForm.sku,
        lengthM: Number(meshForm.lengthM),
        widthM: Number(meshForm.widthM),
        wireDiameterMm: Number(meshForm.wireDiameterMm),
        gridSpacingMm: Number(meshForm.gridSpacingMm),
        unitWeightKg: Number(meshForm.unitWeightKg),
        qtyInStock: Number(meshForm.qtyInitial),
        notes: meshForm.notes || null,
      });
      if (res.ok) { setMsg({ ok: true, text: "Mesh SKU added." }); setShowMeshForm(false); setMeshForm(emptyMeshForm); router.refresh(); }
      else { setMsg({ ok: false, text: "error" in res ? res.error : "Error" }); }
    });
  }

  async function handleMeshAdjust(id: number) {
    if (!adjustQty) return;
    setMsg(null);
    const res = await adjustMeshStock(id, Number(adjustQty));
    if (res.ok) { setAdjustId(null); setAdjustQty(""); router.refresh(); }
    else { setMsg({ ok: false, text: "error" in res ? res.error : "Error" }); }
  }

  async function handleWireUpdate(id: number) {
    if (!wireRemaining) return;
    setMsg(null);
    const res = await updateWireRemaining(id, Number(wireRemaining));
    if (res.ok) { setAdjustingWireId(null); setWireRemaining(""); router.refresh(); }
    else { setMsg({ ok: false, text: "error" in res ? res.error : "Error" }); }
  }

  const totalWireKg = wire.reduce((s, w) => s + w.weightKg, 0);
  const totalWireRemainingKg = wire.reduce((s, w) => s + w.remainingKg, 0);
  const totalMeshPcs = mesh.reduce((s, m) => s + m.qtyInStock, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
        {[
          { label: "Wire Batches", value: wire.length.toString(), color: "var(--steel)" },
          { label: "Wire Remaining (kg)", value: `${totalWireRemainingKg.toLocaleString(undefined, { maximumFractionDigits: 0 })} / ${totalWireKg.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, color: "var(--text)" },
          { label: "Mesh In Stock (pcs)", value: totalMeshPcs.toLocaleString(), color: "var(--green)" },
        ].map(({ label, value, color }) => (
          <div key={label} className="kpi-card">
            <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500, marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)" }}>
        {(["wire", "mesh"] as const).map((t) => (
          <button key={t} onClick={() => { setTab(t); setMsg(null); }} style={{ padding: "8px 20px", fontSize: 13, fontWeight: 600, border: "none", borderBottom: tab === t ? "2px solid var(--steel)" : "2px solid transparent", background: "none", cursor: "pointer", color: tab === t ? "var(--steel)" : "var(--text-2)", textTransform: "capitalize" }}>
            {t === "wire" ? "Wire Stock" : "Mesh Inventory"}
          </button>
        ))}
      </div>

      {msg && <div style={{ padding: "10px 14px", borderRadius: 8, fontSize: 13, background: msg.ok ? "var(--green-bg)" : "var(--red-bg)", color: msg.ok ? "var(--green)" : "var(--red)" }}>{msg.text}</div>}

      {/* Wire tab */}
      {tab === "wire" && (
        <>
          {canWrite && (
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-primary" onClick={() => { setShowWireForm((v) => !v); setMsg(null); }}>{showWireForm ? "Cancel" : "+ Add Wire Batch"}</button>
            </div>
          )}
          {showWireForm && canWrite && (
            <div className="panel">
              <div className="panel-head"><span className="panel-title">New Wire Batch</span></div>
              <form onSubmit={handleAddWire} className="panel-body">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Batch Code</label>
                    <input className="form-input" required placeholder="WB-2026-001" value={wireForm.batchCode} onChange={(e) => setWireForm((f) => ({ ...f, batchCode: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Diameter (mm)</label>
                    <input type="number" className="form-input" required step={0.1} min={0.1} placeholder="4.0" value={wireForm.wireDiameterMm} onChange={(e) => setWireForm((f) => ({ ...f, wireDiameterMm: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Total Weight (kg)</label>
                    <input type="number" className="form-input" required step={0.1} min={0} placeholder="1000" value={wireForm.weightKg} onChange={(e) => setWireForm((f) => ({ ...f, weightKg: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Supplier</label>
                    <input className="form-input" placeholder="Supplier name" value={wireForm.supplier} onChange={(e) => setWireForm((f) => ({ ...f, supplier: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Received Date</label>
                    <input type="date" className="form-input" required value={wireForm.receivedDate} onChange={(e) => setWireForm((f) => ({ ...f, receivedDate: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Notes</label>
                    <input className="form-input" value={wireForm.notes} onChange={(e) => setWireForm((f) => ({ ...f, notes: e.target.value }))} />
                  </div>
                </div>
                <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
                  <button type="submit" className="btn btn-primary" disabled={isPending}>{isPending ? <><span className="spinner" />Saving…</> : "Add Batch"}</button>
                  <button type="button" className="btn" onClick={() => setShowWireForm(false)}>Cancel</button>
                </div>
              </form>
            </div>
          )}
          <div className="panel">
            <div className="panel-head"><span className="panel-title">Wire Batches</span></div>
            <div style={{ overflowX: "auto" }}>
              {wire.length === 0 ? (
                <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>No wire batches</div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr><th>Batch Code</th><th>Diameter</th><th>Total (kg)</th><th>Remaining (kg)</th><th>Usage %</th><th>Supplier</th><th>Received</th>{canWrite && <th>Update</th>}</tr>
                  </thead>
                  <tbody>
                    {wire.map((w) => {
                      const usedPct = w.weightKg > 0 ? Math.round(((w.weightKg - w.remainingKg) / w.weightKg) * 100) : 0;
                      return (
                        <tr key={w.id}>
                          <td><code style={{ fontSize: 12, fontWeight: 700, color: "var(--steel)" }}>{w.batchCode}</code></td>
                          <td>{w.wireDiameterMm} mm</td>
                          <td style={{ fontVariantNumeric: "tabular-nums" }}>{w.weightKg.toLocaleString()}</td>
                          <td style={{ fontVariantNumeric: "tabular-nums", color: w.remainingKg < w.weightKg * 0.1 ? "var(--red)" : "var(--text)" }}>{w.remainingKg.toLocaleString()}</td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <div style={{ width: 60, height: 5, borderRadius: 3, background: "var(--border)", overflow: "hidden" }}>
                                <div style={{ width: `${usedPct}%`, height: "100%", background: usedPct > 90 ? "var(--red)" : "var(--steel)", borderRadius: 3 }} />
                              </div>
                              <span style={{ fontSize: 11.5, color: "var(--text-2)" }}>{usedPct}%</span>
                            </div>
                          </td>
                          <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{w.supplier ?? "—"}</td>
                          <td style={{ fontSize: 12.5, color: "var(--text-2)", whiteSpace: "nowrap" }}>{new Date(w.receivedDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
                          {canWrite && (
                            <td>
                              {adjustingWireId === w.id ? (
                                <div style={{ display: "flex", gap: 4 }}>
                                  <input type="number" className="form-input" style={{ width: 80, height: 28, fontSize: 12 }} placeholder="kg" min={0} value={wireRemaining} onChange={(e) => setWireRemaining(e.target.value)} />
                                  <button className="btn btn-primary" style={{ height: 28, padding: "0 8px", fontSize: 12 }} onClick={() => handleWireUpdate(w.id)}>Set</button>
                                  <button className="btn" style={{ height: 28, padding: "0 6px", fontSize: 12 }} onClick={() => setAdjustingWireId(null)}>✕</button>
                                </div>
                              ) : (
                                <button className="btn" style={{ height: 28, padding: "0 10px", fontSize: 12 }} onClick={() => { setAdjustingWireId(w.id); setWireRemaining(w.remainingKg.toString()); }}>Update kg</button>
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
        </>
      )}

      {/* Mesh tab */}
      {tab === "mesh" && (
        <>
          {canManage && (
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-primary" onClick={() => { setShowMeshForm((v) => !v); setMsg(null); }}>{showMeshForm ? "Cancel" : "+ Add Mesh SKU"}</button>
            </div>
          )}
          {showMeshForm && canManage && (
            <div className="panel">
              <div className="panel-head"><span className="panel-title">New Mesh SKU</span></div>
              <form onSubmit={handleAddMesh} className="panel-body">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>SKU</label>
                    <input className="form-input" required placeholder="RM-4.0-2x3-150" value={meshForm.sku} onChange={(e) => setMeshForm((f) => ({ ...f, sku: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Length (m)</label>
                    <input type="number" className="form-input" required step={0.01} min={0.01} placeholder="6.0" value={meshForm.lengthM} onChange={(e) => setMeshForm((f) => ({ ...f, lengthM: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Width (m)</label>
                    <input type="number" className="form-input" required step={0.01} min={0.01} placeholder="2.4" value={meshForm.widthM} onChange={(e) => setMeshForm((f) => ({ ...f, widthM: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Wire Diameter (mm)</label>
                    <input type="number" className="form-input" required step={0.1} min={0.1} placeholder="4.0" value={meshForm.wireDiameterMm} onChange={(e) => setMeshForm((f) => ({ ...f, wireDiameterMm: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Grid Spacing (mm)</label>
                    <input type="number" className="form-input" required min={1} placeholder="150" value={meshForm.gridSpacingMm} onChange={(e) => setMeshForm((f) => ({ ...f, gridSpacingMm: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Unit Weight (kg)</label>
                    <input type="number" className="form-input" required step={0.01} min={0} placeholder="12.5" value={meshForm.unitWeightKg} onChange={(e) => setMeshForm((f) => ({ ...f, unitWeightKg: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Opening Stock (pcs)</label>
                    <input type="number" className="form-input" min={0} placeholder="0" value={meshForm.qtyInitial} onChange={(e) => setMeshForm((f) => ({ ...f, qtyInitial: e.target.value }))} />
                  </div>
                  <div style={{ gridColumn: "2/-1" }}>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Notes</label>
                    <input className="form-input" value={meshForm.notes} onChange={(e) => setMeshForm((f) => ({ ...f, notes: e.target.value }))} />
                  </div>
                </div>
                <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
                  <button type="submit" className="btn btn-primary" disabled={isPending}>{isPending ? <><span className="spinner" />Saving…</> : "Add SKU"}</button>
                  <button type="button" className="btn" onClick={() => setShowMeshForm(false)}>Cancel</button>
                </div>
              </form>
            </div>
          )}
          <div className="panel">
            <div className="panel-head"><span className="panel-title">Mesh SKUs</span></div>
            <div style={{ overflowX: "auto" }}>
              {mesh.length === 0 ? (
                <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>No mesh SKUs defined</div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr><th>SKU</th><th>Dimensions</th><th>Ø Wire</th><th>Grid</th><th>Unit kg</th><th>In Stock</th>{canWrite && <th>Adjust</th>}</tr>
                  </thead>
                  <tbody>
                    {mesh.map((m) => (
                      <tr key={m.id}>
                        <td><code style={{ fontSize: 12, fontWeight: 700, color: "var(--steel)" }}>{m.sku}</code></td>
                        <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{m.lengthM}m × {m.widthM}m</td>
                        <td style={{ fontSize: 12.5 }}>{m.wireDiameterMm} mm</td>
                        <td style={{ fontSize: 12.5 }}>{m.gridSpacingMm} mm</td>
                        <td style={{ fontSize: 12.5 }}>{m.unitWeightKg}</td>
                        <td style={{ fontWeight: 600, color: m.qtyInStock === 0 ? "var(--red)" : "var(--text)" }}>{m.qtyInStock}</td>
                        {canWrite && (
                          <td>
                            {adjustId === m.id ? (
                              <div style={{ display: "flex", gap: 4 }}>
                                <input type="number" className="form-input" style={{ width: 72, height: 28, fontSize: 12 }} placeholder="±qty" value={adjustQty} onChange={(e) => setAdjustQty(e.target.value)} />
                                <button className="btn btn-primary" style={{ height: 28, padding: "0 8px", fontSize: 12 }} onClick={() => handleMeshAdjust(m.id)}>Apply</button>
                                <button className="btn" style={{ height: 28, padding: "0 6px", fontSize: 12 }} onClick={() => setAdjustId(null)}>✕</button>
                              </div>
                            ) : (
                              <button className="btn" style={{ height: 28, padding: "0 10px", fontSize: 12 }} onClick={() => { setAdjustId(m.id); setAdjustQty(""); }}>Adjust</button>
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
        </>
      )}
    </div>
  );
}
