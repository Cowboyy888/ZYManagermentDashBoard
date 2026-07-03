"use client";
import { useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import dynamic from "next/dynamic";

const ExportMenu = dynamic(() => import("@/components/ExportMenu").then((m) => m.ExportMenu), { ssr: false });

type Summary = {
  totalPOs: number; pendingApproval: number; approvedPOs: number;
  awaitingReceipt: number; monthlyPOs: number; monthlySpendUsd: number;
  supplierCount: number;
  topSuppliers: { id: number; name: string; supplierCode: string; orderCount: number; status: string }[];
  posByStatus: { status: string; count: number; totalUsd: number }[];
  spendTrend: { month: string; amount: number }[];
  recentPOs: { id: number; poNumber: string; supplierName: string; status: string; totalAmountUsd: number; orderDate: string; createdBy: string }[];
  recentReceipts: { id: string; receiptNumber: string; poNumber: string; supplierName: string; status: string; itemCount: number; receivedBy: string; receivedDate: string }[];
  lowStockNeedingPurchase: { id: number; itemCode: string; name: string; currentStock: number; minStock: number; unitOfMeasure: string; categoryCode: string; warehouseCode: string }[];
};

const PO_STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  DRAFT:              { bg: "var(--border)",    color: "var(--text-3)", label: "Draft" },
  PENDING_APPROVAL:   { bg: "var(--amber-bg)",  color: "var(--amber)",  label: "Pending Approval" },
  APPROVED:           { bg: "var(--blue-bg)",   color: "var(--blue)",   label: "Approved" },
  PARTIALLY_RECEIVED: { bg: "var(--purple-bg)", color: "var(--purple)", label: "Partial" },
  RECEIVED:           { bg: "var(--green-bg)",  color: "var(--green)",  label: "Received" },
  CANCELLED:          { bg: "var(--red-bg)",    color: "var(--red)",    label: "Cancelled" },
};

const STATUS_COLORS = ["var(--steel)", "var(--amber)", "var(--blue)", "var(--purple)", "var(--green)", "var(--red)"];

function fmtUsd(n: number) { return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }

export function PurchasingDashboard({ summary, canManage: _cm, canApprove: _ca }: { summary: Summary; canManage: boolean; canApprove: boolean }) {
  const { totalPOs, pendingApproval, approvedPOs, awaitingReceipt,
          monthlyPOs, monthlySpendUsd, supplierCount, topSuppliers,
          posByStatus, spendTrend, recentPOs, recentReceipts, lowStockNeedingPurchase } = summary;

  const kpiExport = useMemo(() => [
    { Metric: "Total Purchase Orders", Value: totalPOs },
    { Metric: "Pending Approval", Value: pendingApproval },
    { Metric: "Approved (Awaiting Receipt)", Value: awaitingReceipt },
    { Metric: "This Month Orders", Value: monthlyPOs },
    { Metric: "This Month Spend (USD)", Value: fmtUsd(monthlySpendUsd) },
    { Metric: "Active Suppliers", Value: supplierCount },
  ], [totalPOs, pendingApproval, awaitingReceipt, monthlyPOs, monthlySpendUsd, supplierCount]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Alerts ── */}
      {(pendingApproval > 0 || lowStockNeedingPurchase.length > 0) && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {pendingApproval > 0 && (
            <div style={{ padding: "9px 14px", borderRadius: 8, background: "var(--amber-bg)", color: "var(--amber)", fontSize: 13, fontWeight: 500 }}>
              {pendingApproval} purchase order{pendingApproval !== 1 ? "s" : ""} awaiting approval
            </div>
          )}
          {lowStockNeedingPurchase.length > 0 && (
            <div style={{ padding: "9px 14px", borderRadius: 8, background: "var(--red-bg)", color: "var(--red)", fontSize: 13, fontWeight: 500 }}>
              {lowStockNeedingPurchase.length} item{lowStockNeedingPurchase.length !== 1 ? "s" : ""} below minimum stock — reorder required
            </div>
          )}
        </div>
      )}

      {/* ── KPI row ── */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <ExportMenu title="Purchasing KPIs" filename="purchasing-kpis" data={kpiExport} columns={[{ key: "Metric", header: "Metric" }, { key: "Value", header: "Value" }]} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
        {[
          { label: "Total POs", value: totalPOs, color: "var(--steel)" },
          { label: "Pending Approval", value: pendingApproval, color: pendingApproval > 0 ? "var(--amber)" : "var(--text-3)" },
          { label: "Awaiting Receipt", value: awaitingReceipt, color: awaitingReceipt > 0 ? "var(--blue)" : "var(--text-3)" },
          { label: "This Month Orders", value: monthlyPOs, color: "var(--text)" },
          { label: "Monthly Spend", value: fmtUsd(monthlySpendUsd), color: "var(--steel)" },
          { label: "Active Suppliers", value: supplierCount, color: "var(--text)" },
        ].map(({ label, value, color }) => (
          <div key={label} className="kpi-card">
            <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500, marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: label === "Monthly Spend" ? 16 : 22, fontWeight: 800, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Charts row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 16 }}>
        <div className="panel">
          <div className="panel-head"><span className="panel-title">Monthly Spend Trend (USD)</span></div>
          <div style={{ padding: "8px 8px 0" }}>
            {spendTrend.every((s) => s.amount === 0) ? (
              <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>No purchase data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={spendTrend.map((s) => ({ name: s.month.slice(5), amount: s.amount }))} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--text-3)" }} />
                  <YAxis tick={{ fontSize: 10, fill: "var(--text-3)" }} width={60} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmtUsd(v)} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                  <Bar dataKey="amount" fill="var(--steel)" radius={[4, 4, 0, 0]} name="Spend (USD)" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><span className="panel-title">Orders by Status</span></div>
          <div style={{ padding: "12px 8px" }}>
            {posByStatus.length === 0 ? (
              <div style={{ padding: "32px 0", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>No orders yet</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {posByStatus.map((s, idx) => {
                  const style = PO_STATUS_STYLE[s.status] ?? PO_STATUS_STYLE.DRAFT;
                  const total = posByStatus.reduce((a, x) => a + x.count, 0);
                  const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
                  return (
                    <div key={s.status}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                        <span className="tag" style={{ background: style.bg, color: style.color }}>{style.label}</span>
                        <span style={{ color: "var(--text-2)", fontWeight: 600 }}>{s.count} ({pct}%) · {fmtUsd(s.totalUsd)}</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 3, background: "var(--border)" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: STATUS_COLORS[idx % STATUS_COLORS.length], borderRadius: 3 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Top suppliers + Low stock ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">Top Suppliers</span>
            <a href="/purchasing/suppliers" style={{ fontSize: 12, color: "var(--steel)", textDecoration: "none" }}>Manage →</a>
          </div>
          {topSuppliers.length === 0 ? (
            <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>No suppliers yet</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead><tr><th>Supplier</th><th>Code</th><th className="num">Orders</th></tr></thead>
                <tbody>
                  {topSuppliers.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td><code style={{ fontSize: 11, color: "var(--text-2)" }}>{s.supplierCode}</code></td>
                      <td className="num">{s.orderCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-head">
            <span className="panel-title" style={{ color: "var(--red)" }}>Low Stock Requiring Purchase</span>
            <a href="/purchasing/requisitions" style={{ fontSize: 12, color: "var(--steel)", textDecoration: "none" }}>Request →</a>
          </div>
          {lowStockNeedingPurchase.length === 0 ? (
            <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--green)", fontSize: 13, fontWeight: 600 }}>All items above minimum stock</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table">
                <thead><tr><th>Item</th><th>Stock</th><th>Min</th></tr></thead>
                <tbody>
                  {lowStockNeedingPurchase.map((i) => (
                    <tr key={i.id}>
                      <td>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{i.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-3)" }}>{i.itemCode}</div>
                      </td>
                      <td className="num" style={{ fontWeight: 700, color: i.currentStock === 0 ? "var(--red)" : "var(--amber)" }}>
                        {i.currentStock} {i.unitOfMeasure}
                      </td>
                      <td className="num" style={{ color: "var(--text-2)", fontSize: 12.5 }}>{i.minStock} {i.unitOfMeasure}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Recent POs ── */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Recent Purchase Orders</span>
          <a href="/purchasing/orders" style={{ fontSize: 12, color: "var(--steel)", textDecoration: "none" }}>View all →</a>
        </div>
        {recentPOs.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>No purchase orders yet</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead><tr><th>PO Number</th><th>Supplier</th><th>Date</th><th>Amount</th><th>Status</th><th>By</th></tr></thead>
              <tbody>
                {recentPOs.map((po) => {
                  const s = PO_STATUS_STYLE[po.status] ?? PO_STATUS_STYLE.DRAFT;
                  return (
                    <tr key={po.id}>
                      <td><code style={{ fontSize: 12, fontWeight: 700, color: "var(--steel)" }}>{po.poNumber}</code></td>
                      <td style={{ fontWeight: 500 }}>{po.supplierName}</td>
                      <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{fmtDate(po.orderDate)}</td>
                      <td className="num" style={{ fontWeight: 700 }}>{fmtUsd(po.totalAmountUsd)}</td>
                      <td><span className="tag" style={{ background: s.bg, color: s.color }}>{s.label}</span></td>
                      <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{po.createdBy}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Recent receipts ── */}
      {recentReceipts.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">Recent Goods Receipts</span>
            <a href="/purchasing/receipts" style={{ fontSize: 12, color: "var(--steel)", textDecoration: "none" }}>View all →</a>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead><tr><th>Receipt</th><th>PO</th><th>Supplier</th><th>Date</th><th>Items</th><th>By</th></tr></thead>
              <tbody>
                {recentReceipts.map((r) => (
                  <tr key={r.id}>
                    <td><code style={{ fontSize: 12, fontWeight: 700, color: "var(--steel)" }}>{r.receiptNumber}</code></td>
                    <td style={{ fontSize: 12, color: "var(--text-2)" }}>{r.poNumber}</td>
                    <td style={{ fontWeight: 500 }}>{r.supplierName}</td>
                    <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{fmtDate(r.receivedDate)}</td>
                    <td className="num">{r.itemCount}</td>
                    <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{r.receivedBy}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
