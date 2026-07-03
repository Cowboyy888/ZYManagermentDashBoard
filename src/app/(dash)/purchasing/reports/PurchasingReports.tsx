"use client";
import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import dynamic from "next/dynamic";

const ExportMenu = dynamic(() => import("@/components/ExportMenu").then((m) => m.ExportMenu), { ssr: false });

type PORow = {
  id: number; poNumber: string; supplierName: string; supplierCode: string;
  warehouseCode: string | null; status: string; orderDate: string;
  expectedDelivery: string | null; totalAmountUsd: number; currency: string;
  itemCount: number; receiptCount: number; createdBy: string; approvedBy: string | null;
};
type SupplierRow = {
  id: number; supplierCode: string; name: string; status: string; orderCount: number;
  currency: string; paymentTerms: string | null;
};
type GRRow = {
  id: string; receiptNumber: string; poNumber: string; supplierName: string;
  warehouseCode: string; status: string; receivedBy: string; receivedDate: string;
  itemCount: number; totalReceived: number; totalRejected: number;
};

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  DRAFT:              { bg: "var(--border)",    color: "var(--text-3)", label: "Draft" },
  PENDING_APPROVAL:   { bg: "var(--amber-bg)", color: "var(--amber)",  label: "Pending Approval" },
  APPROVED:           { bg: "var(--blue-bg)",  color: "var(--blue)",   label: "Approved" },
  PARTIALLY_RECEIVED: { bg: "var(--purple-bg)", color: "var(--purple)", label: "Partial" },
  RECEIVED:           { bg: "var(--green-bg)", color: "var(--green)",  label: "Received" },
  CANCELLED:          { bg: "var(--red-bg)",   color: "var(--red)",    label: "Cancelled" },
};

const TABS = ["PO Summary", "Supplier Performance", "Outstanding POs", "GR Report", "Monthly Spend"] as const;
type Tab = (typeof TABS)[number];

function fmtUsd(n: number) { return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }

export function PurchasingReports({ orders, suppliers, receipts }: {
  orders: PORow[];
  suppliers: SupplierRow[];
  receipts: GRRow[];
  canExport?: boolean;
}) {
  const [tab, setTab]               = useState<Tab>("PO Summary");
  const [statusFilter, setStatus]   = useState("");
  const [supplierFilter, setSupFil] = useState("");
  const [dateFrom, setDateFrom]     = useState("");
  const [dateTo, setDateTo]         = useState("");

  const filteredOrders = useMemo(() => orders.filter((o) => {
    if (statusFilter && o.status !== statusFilter) return false;
    if (supplierFilter && !o.supplierName.toLowerCase().includes(supplierFilter.toLowerCase())) return false;
    if (dateFrom && o.orderDate < dateFrom) return false;
    if (dateTo && o.orderDate > dateTo + "T23:59:59") return false;
    return true;
  }), [orders, statusFilter, supplierFilter, dateFrom, dateTo]);

  const filteredGRs = useMemo(() => receipts.filter((g) => {
    if (supplierFilter && !g.supplierName.toLowerCase().includes(supplierFilter.toLowerCase())) return false;
    if (dateFrom && g.receivedDate < dateFrom) return false;
    if (dateTo && g.receivedDate > dateTo + "T23:59:59") return false;
    return true;
  }), [receipts, supplierFilter, dateFrom, dateTo]);

  const outstandingPOs = useMemo(() => orders.filter((o) =>
    o.status === "APPROVED" || o.status === "PARTIALLY_RECEIVED" || o.status === "PENDING_APPROVAL"
  ), [orders]);

  const monthlySpend = useMemo(() => {
    const map: Record<string, number> = {};
    orders.filter((o) => o.status !== "CANCELLED" && o.status !== "DRAFT").forEach((o) => {
      const m = o.orderDate.slice(0, 7);
      map[m] = (map[m] ?? 0) + o.totalAmountUsd;
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([month, amount]) => ({ month, amount }));
  }, [orders]);

  // Derive supplier performance from orders
  const supplierPerformance = useMemo(() => {
    const map: Record<string, { totalSpendUsd: number; orderCount: number; fullyReceived: number }> = {};
    orders.filter((o) => o.status !== "CANCELLED").forEach((o) => {
      if (!map[o.supplierName]) map[o.supplierName] = { totalSpendUsd: 0, orderCount: 0, fullyReceived: 0 };
      map[o.supplierName].totalSpendUsd += o.totalAmountUsd;
      map[o.supplierName].orderCount += 1;
      if (o.status === "RECEIVED") map[o.supplierName].fullyReceived += 1;
    });
    return suppliers.map((s) => {
      const perf = map[s.name] ?? { totalSpendUsd: 0, orderCount: s.orderCount, fullyReceived: 0 };
      return { id: s.id, supplierCode: s.supplierCode, name: s.name, orderCount: perf.orderCount, totalSpendUsd: perf.totalSpendUsd, fullyReceived: perf.fullyReceived };
    }).filter((s) => s.orderCount > 0 || suppliers.find((x) => x.id === s.id));
  }, [orders, suppliers]);

  const totalFilteredSpend = filteredOrders
    .filter((o) => o.status !== "CANCELLED" && o.status !== "DRAFT")
    .reduce((s, o) => s + o.totalAmountUsd, 0);

  function clearFilters() { setStatus(""); setSupFil(""); setDateFrom(""); setDateTo(""); }
  const hasFilters = statusFilter || supplierFilter || dateFrom || dateTo;

  const poExportData = filteredOrders.map((o) => ({
    "PO#": o.poNumber, "Supplier": o.supplierName, "Date": fmtDate(o.orderDate),
    "Expected": o.expectedDelivery ? fmtDate(o.expectedDelivery) : "",
    "Amount (USD)": o.totalAmountUsd.toFixed(2), "Status": o.status,
    "Items": o.itemCount, "Receipts": o.receiptCount,
    "Created By": o.createdBy, "Approved By": o.approvedBy ?? "",
  }));

  const suppExportData = supplierPerformance.map((s) => ({
    "Code": s.supplierCode, "Supplier": s.name,
    "Orders": s.orderCount, "Total Spend (USD)": s.totalSpendUsd.toFixed(2),
    "Fully Received": s.fullyReceived,
  }));

  const grExportData = filteredGRs.map((g) => ({
    "Receipt#": g.receiptNumber, "PO#": g.poNumber, "Supplier": g.supplierName,
    "Warehouse": g.warehouseCode, "Date": fmtDate(g.receivedDate),
    "Items": g.itemCount, "Received": g.totalReceived, "Rejected": g.totalRejected,
    "By": g.receivedBy,
  }));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)" }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "8px 14px", fontSize: 13, fontWeight: 500, border: "none", cursor: "pointer",
            background: "transparent", color: tab === t ? "var(--steel)" : "var(--text-3)",
            borderBottom: tab === t ? "2px solid var(--steel)" : "2px solid transparent",
            marginBottom: -1, borderRadius: 0,
          }}>{t}</button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {(tab === "PO Summary" || tab === "Outstanding POs") && (
          <select value={statusFilter} onChange={(e) => setStatus(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 12 }}>
            <option value="">All Statuses</option>
            {Object.entries(STATUS_STYLE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        )}
        {tab !== "Monthly Spend" && tab !== "Supplier Performance" && (
          <input value={supplierFilter} onChange={(e) => setSupFil(e.target.value)} placeholder="Filter by supplier…"
            style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 12, width: 180 }} />
        )}
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 12 }} />
        <span style={{ fontSize: 12, color: "var(--text-3)" }}>to</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
          style={{ padding: "6px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 12 }} />
        {hasFilters && <button className="btn btn-sm" onClick={clearFilters}>Clear</button>}
      </div>

      {/* ── PO Summary ── */}
      {tab === "PO Summary" && (
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">Purchase Orders ({filteredOrders.length} · {fmtUsd(totalFilteredSpend)} net)</span>
            <ExportMenu title="PO Summary" filename="po-summary" data={poExportData} columns={[
              { key: "PO#", header: "PO#" }, { key: "Supplier", header: "Supplier" }, { key: "Date", header: "Date" },
              { key: "Expected", header: "Expected" }, { key: "Amount (USD)", header: "Amount (USD)" },
              { key: "Status", header: "Status" }, { key: "Items", header: "Items" }, { key: "Receipts", header: "Receipts" },
              { key: "Created By", header: "Created By" }, { key: "Approved By", header: "Approved By" },
            ]} />
          </div>
          {filteredOrders.length === 0
            ? <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>No orders match filters</div>
            : (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead><tr><th>PO Number</th><th>Supplier</th><th>Order Date</th><th>Amount</th><th>Items</th><th>Receipts</th><th>Status</th></tr></thead>
                  <tbody>
                    {filteredOrders.map((o) => {
                      const s = STATUS_STYLE[o.status] ?? STATUS_STYLE.DRAFT;
                      return (
                        <tr key={o.id}>
                          <td><code style={{ fontSize: 12, fontWeight: 700, color: "var(--steel)" }}>{o.poNumber}</code></td>
                          <td style={{ fontWeight: 500 }}>{o.supplierName}</td>
                          <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{fmtDate(o.orderDate)}</td>
                          <td className="num" style={{ fontWeight: 700 }}>{fmtUsd(o.totalAmountUsd)}</td>
                          <td className="num">{o.itemCount}</td>
                          <td className="num">{o.receiptCount}</td>
                          <td><span className="tag" style={{ background: s.bg, color: s.color }}>{s.label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      )}

      {/* ── Supplier Performance ── */}
      {tab === "Supplier Performance" && (
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">Supplier Performance ({suppliers.length})</span>
            <ExportMenu title="Supplier Performance" filename="supplier-performance" data={suppExportData} columns={[
              { key: "Code", header: "Code" }, { key: "Supplier", header: "Supplier" },
              { key: "Orders", header: "Orders" }, { key: "Total Spend (USD)", header: "Spend (USD)" },
              { key: "Fully Received", header: "Fully Received" },
            ]} />
          </div>
          {supplierPerformance.length === 0
            ? <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>No supplier data</div>
            : (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead><tr><th>Code</th><th>Supplier</th><th className="num">Orders</th><th className="num">Total Spend</th><th className="num">Fully Received</th></tr></thead>
                  <tbody>
                    {[...supplierPerformance].sort((a, b) => b.totalSpendUsd - a.totalSpendUsd).map((s) => (
                      <tr key={s.id}>
                        <td><code style={{ fontSize: 11, color: "var(--steel)" }}>{s.supplierCode}</code></td>
                        <td style={{ fontWeight: 600 }}>{s.name}</td>
                        <td className="num">{s.orderCount}</td>
                        <td className="num" style={{ fontWeight: 700 }}>{fmtUsd(s.totalSpendUsd)}</td>
                        <td className="num">{s.fullyReceived} ({s.orderCount > 0 ? Math.round((s.fullyReceived / s.orderCount) * 100) : 0}%)</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      )}

      {/* ── Outstanding POs ── */}
      {tab === "Outstanding POs" && (
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">Outstanding Orders ({outstandingPOs.length})</span>
            <ExportMenu title="Outstanding POs" filename="outstanding-pos" data={outstandingPOs.map((o) => ({
              "PO#": o.poNumber, "Supplier": o.supplierName, "Order Date": fmtDate(o.orderDate),
              "Expected": o.expectedDelivery ? fmtDate(o.expectedDelivery) : "",
              "Amount (USD)": o.totalAmountUsd.toFixed(2), "Status": o.status,
            }))} columns={[
              { key: "PO#", header: "PO#" }, { key: "Supplier", header: "Supplier" },
              { key: "Order Date", header: "Order Date" }, { key: "Expected", header: "Expected" },
              { key: "Amount (USD)", header: "Amount (USD)" }, { key: "Status", header: "Status" },
            ]} />
          </div>
          {outstandingPOs.length === 0
            ? <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--green)", fontSize: 13, fontWeight: 600 }}>No outstanding purchase orders</div>
            : (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead><tr><th>PO Number</th><th>Supplier</th><th>Order Date</th><th>Expected Delivery</th><th>Amount</th><th>Status</th></tr></thead>
                  <tbody>
                    {outstandingPOs.map((o) => {
                      const s = STATUS_STYLE[o.status] ?? STATUS_STYLE.DRAFT;
                      const overdue = o.expectedDelivery && new Date(o.expectedDelivery) < new Date() && o.status !== "RECEIVED";
                      return (
                        <tr key={o.id} style={{ background: overdue ? "var(--red-bg)" : undefined }}>
                          <td><code style={{ fontSize: 12, fontWeight: 700, color: "var(--steel)" }}>{o.poNumber}</code></td>
                          <td style={{ fontWeight: 500 }}>{o.supplierName}</td>
                          <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{fmtDate(o.orderDate)}</td>
                          <td style={{ fontSize: 12.5, color: overdue ? "var(--red)" : "var(--text-2)", fontWeight: overdue ? 700 : undefined }}>
                            {o.expectedDelivery ? fmtDate(o.expectedDelivery) : "—"}
                            {overdue && " ⚠ OVERDUE"}
                          </td>
                          <td className="num" style={{ fontWeight: 700 }}>{fmtUsd(o.totalAmountUsd)}</td>
                          <td><span className="tag" style={{ background: s.bg, color: s.color }}>{s.label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      )}

      {/* ── GR Report ── */}
      {tab === "GR Report" && (
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">Goods Receipts ({filteredGRs.length})</span>
            <ExportMenu title="GR Report" filename="gr-report" data={grExportData} columns={[
              { key: "Receipt#", header: "Receipt#" }, { key: "PO#", header: "PO#" },
              { key: "Supplier", header: "Supplier" }, { key: "Warehouse", header: "Warehouse" },
              { key: "Date", header: "Date" }, { key: "Items", header: "Items" },
              { key: "Received", header: "Received" }, { key: "Rejected", header: "Rejected" }, { key: "By", header: "By" },
            ]} />
          </div>
          {filteredGRs.length === 0
            ? <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>No receipts found</div>
            : (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead><tr><th>Receipt</th><th>PO</th><th>Supplier</th><th>Warehouse</th><th>Date</th><th className="num">Received</th><th className="num">Rejected</th><th>By</th></tr></thead>
                  <tbody>
                    {filteredGRs.map((g) => (
                      <tr key={g.id}>
                        <td><code style={{ fontSize: 12, fontWeight: 700, color: "var(--steel)" }}>{g.receiptNumber}</code></td>
                        <td style={{ fontSize: 12, color: "var(--text-2)" }}>{g.poNumber}</td>
                        <td style={{ fontWeight: 500 }}>{g.supplierName}</td>
                        <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{g.warehouseCode}</td>
                        <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{fmtDate(g.receivedDate)}</td>
                        <td className="num" style={{ color: "var(--green)", fontWeight: 700 }}>{g.totalReceived}</td>
                        <td className="num" style={{ color: g.totalRejected > 0 ? "var(--red)" : "var(--text-3)" }}>{g.totalRejected}</td>
                        <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{g.receivedBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>
      )}

      {/* ── Monthly Spend ── */}
      {tab === "Monthly Spend" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">Monthly Spend Trend</span>
              <ExportMenu title="Monthly Spend" filename="monthly-spend" data={monthlySpend.map((m) => ({ Month: m.month, "Spend (USD)": m.amount.toFixed(2) }))} columns={[
                { key: "Month", header: "Month" }, { key: "Spend (USD)", header: "Spend (USD)" },
              ]} />
            </div>
            <div style={{ padding: "8px 8px 0" }}>
              {monthlySpend.length === 0
                ? <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>No spend data</div>
                : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={monthlySpend.map((m) => ({ name: m.month.slice(5), amount: m.amount }))} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--text-3)" }} />
                      <YAxis tick={{ fontSize: 10, fill: "var(--text-3)" }} width={72} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => fmtUsd(v)} contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                      <Bar dataKey="amount" fill="var(--steel)" radius={[4, 4, 0, 0]} name="Spend (USD)" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
            </div>
          </div>

          {monthlySpend.length > 0 && (
            <div className="panel">
              <div className="panel-head"><span className="panel-title">Monthly Breakdown</span></div>
              <div style={{ overflowX: "auto" }}>
                <table className="data-table">
                  <thead><tr><th>Month</th><th className="num">Spend (USD)</th></tr></thead>
                  <tbody>
                    {[...monthlySpend].reverse().map(({ month, amount }) => (
                      <tr key={month}>
                        <td style={{ fontWeight: 500 }}>{month}</td>
                        <td className="num" style={{ fontWeight: 700 }}>{fmtUsd(amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td style={{ fontWeight: 700, padding: "8px 12px", color: "var(--text-2)" }}>Total</td>
                      <td className="num" style={{ fontWeight: 800, color: "var(--steel)" }}>
                        {fmtUsd(monthlySpend.reduce((s, m) => s + m.amount, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
