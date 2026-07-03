"use client";
import { useState, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface OrderItem { description: string; quantity: number; totalUsd: number; }
interface OrderRow { id: number; orderNumber: string; customerName: string; customerCode: string; status: string; orderDate: string; totalUsd: number; paymentStatus: string; items: OrderItem[]; }
interface CustomerRow { id: number; name: string; customerCode: string; country: string; status: string; orderCount: number; quotationCount: number; }
interface QuotationRow { id: number; quotationNumber: string; customerName: string; status: string; totalUsd: number; createdAt: string; validUntil: string; hasOrder: boolean; }
interface DeliveryRow { id: number; deliveryNumber: string; orderNumber: string; customerName: string; status: string; scheduledDate: string; deliveredDate: string | null; }

interface Props {
  orders: OrderRow[];
  customers: CustomerRow[];
  quotations: QuotationRow[];
  deliveries: DeliveryRow[];
  canExport?: boolean;
}

const TABS = ["Revenue", "By Customer", "By Product", "Quotation Conversion", "Outstanding Orders", "Delivery Tracker"] as const;
type Tab = typeof TABS[number];

const fmtUsd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "#64748b", CONFIRMED: "#2563eb", IN_PRODUCTION: "#d97706",
  READY: "#16a34a", DELIVERED: "#64748b", CANCELLED: "#dc2626",
};

function Tag({ s, c }: { s: string; c?: string }) {
  const col = c ?? STATUS_COLORS[s] ?? "#64748b";
  return <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 100, fontSize: 11, fontWeight: 600, background: `${col}22`, color: col }}>{s.replace(/_/g, " ")}</span>;
}

export function SalesReports({ orders, customers, quotations, deliveries, canExport }: Props) {
  const [tab, setTab] = useState<Tab>("Revenue");

  // ── Revenue by month ────────────────────────────────────────────────────────
  const revenueByMonth = useMemo(() => {
    const map: Record<string, number> = {};
    for (const o of orders) {
      if (["CANCELLED"].includes(o.status)) continue;
      const k = o.orderDate.slice(0, 7);
      map[k] = (map[k] ?? 0) + o.totalUsd;
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b)).map(([month, amount]) => ({ month, amount: Math.round(amount * 100) / 100 }));
  }, [orders]);

  const totalRevenue = orders.filter((o) => o.status !== "CANCELLED").reduce((s, o) => s + o.totalUsd, 0);
  const totalOrders  = orders.filter((o) => o.status !== "CANCELLED").length;

  // ── By customer ─────────────────────────────────────────────────────────────
  const byCustomer = useMemo(() => {
    const map: Record<string, { name: string; code: string; orders: number; revenue: number }> = {};
    for (const o of orders) {
      if (o.status === "CANCELLED") continue;
      if (!map[o.customerName]) map[o.customerName] = { name: o.customerName, code: o.customerCode, orders: 0, revenue: 0 };
      map[o.customerName].orders++;
      map[o.customerName].revenue += o.totalUsd;
    }
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [orders]);

  // ── By product ───────────────────────────────────────────────────────────────
  const byProduct = useMemo(() => {
    const map: Record<string, { desc: string; qty: number; revenue: number }> = {};
    for (const o of orders) {
      if (o.status === "CANCELLED") continue;
      for (const i of o.items) {
        if (!map[i.description]) map[i.description] = { desc: i.description, qty: 0, revenue: 0 };
        map[i.description].qty += i.quantity;
        map[i.description].revenue += i.totalUsd;
      }
    }
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 30);
  }, [orders]);

  // ── Quotation conversion ─────────────────────────────────────────────────────
  const conversionStats = useMemo(() => {
    const total = quotations.length;
    const converted = quotations.filter((q) => q.hasOrder || q.status === "CONVERTED").length;
    const approved  = quotations.filter((q) => q.status === "APPROVED").length;
    const sent      = quotations.filter((q) => q.status === "SENT").length;
    const rejected  = quotations.filter((q) => q.status === "REJECTED").length;
    const expired   = quotations.filter((q) => q.status === "EXPIRED").length;
    return {
      total, converted, approved, sent, rejected, expired,
      rate: total > 0 ? Math.round((converted / total) * 100) : 0,
      valueTotal: quotations.reduce((s, q) => s + q.totalUsd, 0),
      valueConverted: quotations.filter((q) => q.hasOrder || q.status === "CONVERTED").reduce((s, q) => s + q.totalUsd, 0),
    };
  }, [quotations]);

  // ── Outstanding orders ───────────────────────────────────────────────────────
  const outstanding = useMemo(() => orders.filter((o) => !["DELIVERED","CANCELLED"].includes(o.status)), [orders]);

  // ── Delivery tracker ─────────────────────────────────────────────────────────
  const deliveryStats = useMemo(() => {
    const onTime = deliveries.filter((d) => {
      if (d.status !== "DELIVERED" || !d.deliveredDate) return false;
      return new Date(d.deliveredDate) <= new Date(d.scheduledDate);
    }).length;
    const delivered = deliveries.filter((d) => d.status === "DELIVERED").length;
    return { total: deliveries.length, delivered, onTime, rate: delivered > 0 ? Math.round((onTime / delivered) * 100) : 0 };
  }, [deliveries]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: 2, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 4, width: "fit-content" }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: "6px 14px", borderRadius: 7, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500,
            background: tab === t ? "var(--steel)" : "transparent", color: tab === t ? "#fff" : "var(--text-2)",
          }}>{t}</button>
        ))}
      </div>

      {/* Revenue tab */}
      {tab === "Revenue" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
            {[
              { label: "Total Revenue", value: fmtUsd(totalRevenue), accent: "var(--green)" },
              { label: "Total Orders", value: totalOrders, accent: "var(--steel)" },
              { label: "Avg Order Value", value: totalOrders > 0 ? fmtUsd(totalRevenue / totalOrders) : "$0", accent: "var(--blue)" },
            ].map((k) => (
              <div key={k.label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px" }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{k.label}</p>
                <p style={{ fontSize: 24, fontWeight: 700, color: k.accent }}>{k.value}</p>
              </div>
            ))}
          </div>
          <div className="panel">
            <div className="panel-head"><h2>Monthly Revenue Trend</h2></div>
            <div className="panel-body" style={{ height: 250 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByMonth} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => fmtUsd(v)} />
                  <Bar dataKey="amount" name="Revenue" fill="var(--steel)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* By Customer tab */}
      {tab === "By Customer" && (
        <div className="panel">
          <div className="panel-head">
            <h2>Revenue by Customer</h2>
            
          </div>
          <div className="panel-body" style={{ padding: 0 }}>
            <table className="data-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>#</th><th>Customer</th><th style={{ textAlign: "center" }}>Orders</th>
                  <th style={{ textAlign: "right" }}>Revenue</th><th style={{ textAlign: "right" }}>Share</th>
                </tr>
              </thead>
              <tbody>
                {byCustomer.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", color: "var(--text-3)", padding: 24 }}>No data</td></tr>}
                {byCustomer.map((c, i) => (
                  <tr key={c.code}>
                    <td style={{ fontSize: 12, color: "var(--text-3)" }}>{i + 1}</td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: "var(--text-3)" }}>{c.code}</div>
                    </td>
                    <td style={{ textAlign: "center", fontSize: 13 }}>{c.orders}</td>
                    <td style={{ textAlign: "right", fontWeight: 600, color: "var(--green)", fontSize: 13 }}>{fmtUsd(c.revenue)}</td>
                    <td style={{ textAlign: "right", fontSize: 12, color: "var(--text-3)" }}>{totalRevenue > 0 ? Math.round((c.revenue / totalRevenue) * 100) : 0}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* By Product tab */}
      {tab === "By Product" && (
        <div className="panel">
          <div className="panel-head">
            <h2>Revenue by Product</h2>
            
          </div>
          <div className="panel-body" style={{ padding: 0 }}>
            <table className="data-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>#</th><th>Product / Description</th>
                  <th style={{ textAlign: "right" }}>Qty Sold</th>
                  <th style={{ textAlign: "right" }}>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {byProduct.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--text-3)", padding: 24 }}>No data</td></tr>}
                {byProduct.map((p, i) => (
                  <tr key={p.desc}>
                    <td style={{ fontSize: 12, color: "var(--text-3)" }}>{i + 1}</td>
                    <td style={{ fontSize: 13, fontWeight: 500 }}>{p.desc}</td>
                    <td style={{ textAlign: "right", fontSize: 13 }}>{Math.round(p.qty * 100) / 100}</td>
                    <td style={{ textAlign: "right", fontWeight: 600, color: "var(--green)", fontSize: 13 }}>{fmtUsd(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Quotation Conversion tab */}
      {tab === "Quotation Conversion" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
            {[
              { label: "Total Quotations", value: conversionStats.total, c: "var(--steel)" },
              { label: "Conversion Rate", value: `${conversionStats.rate}%`, c: conversionStats.rate >= 50 ? "var(--green)" : "var(--amber)" },
              { label: "Converted Value", value: fmtUsd(conversionStats.valueConverted), c: "var(--green)" },
              { label: "Rejected", value: conversionStats.rejected, c: "var(--red)" },
              { label: "Expired", value: conversionStats.expired, c: "var(--amber)" },
            ].map((k) => (
              <div key={k.label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px" }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{k.label}</p>
                <p style={{ fontSize: 24, fontWeight: 700, color: k.c }}>{k.value}</p>
              </div>
            ))}
          </div>
          <div className="panel">
            <div className="panel-head">
              <h2>Quotation List</h2>
              
            </div>
            <div className="panel-body" style={{ padding: 0 }}>
              <table className="data-table" style={{ width: "100%" }}>
                <thead>
                  <tr><th>Number</th><th>Customer</th><th>Status</th><th>Valid Until</th><th style={{ textAlign: "right" }}>Value</th><th>Order?</th></tr>
                </thead>
                <tbody>
                  {quotations.map((q) => (
                    <tr key={q.id}>
                      <td style={{ fontFamily: "monospace", fontSize: 12 }}>{q.quotationNumber}</td>
                      <td style={{ fontSize: 13 }}>{q.customerName}</td>
                      <td><Tag s={q.status} /></td>
                      <td style={{ fontSize: 12, color: "var(--text-3)" }}>{fmtDate(q.validUntil)}</td>
                      <td style={{ textAlign: "right", fontWeight: 600, fontSize: 13 }}>{fmtUsd(q.totalUsd)}</td>
                      <td style={{ fontSize: 12 }}>{q.hasOrder ? <Tag s="Yes" c="var(--green)" /> : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Outstanding Orders tab */}
      {tab === "Outstanding Orders" && (
        <div className="panel">
          <div className="panel-head">
            <h2>Outstanding Orders</h2>
            
          </div>
          <div className="panel-body" style={{ padding: 0 }}>
            <table className="data-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Order #</th><th>Customer</th><th>Order Date</th>
                  <th>Status</th><th>Payment</th><th style={{ textAlign: "right" }}>Value</th>
                </tr>
              </thead>
              <tbody>
                {outstanding.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text-3)", padding: 24 }}>No outstanding orders</td></tr>}
                {outstanding.map((o) => (
                  <tr key={o.id}>
                    <td style={{ fontFamily: "monospace", fontSize: 12 }}>{o.orderNumber}</td>
                    <td style={{ fontSize: 13 }}>{o.customerName}</td>
                    <td style={{ fontSize: 12 }}>{fmtDate(o.orderDate)}</td>
                    <td><Tag s={o.status} /></td>
                    <td style={{ fontSize: 12 }}>{o.paymentStatus}</td>
                    <td style={{ textAlign: "right", fontWeight: 600, color: "var(--green)", fontSize: 13 }}>{fmtUsd(o.totalUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delivery Tracker tab */}
      {tab === "Delivery Tracker" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
            {[
              { label: "Total Deliveries", value: deliveryStats.total, c: "var(--steel)" },
              { label: "Completed", value: deliveryStats.delivered, c: "var(--green)" },
              { label: "On-Time Rate", value: `${deliveryStats.rate}%`, c: deliveryStats.rate >= 80 ? "var(--green)" : "var(--amber)" },
            ].map((k) => (
              <div key={k.label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px" }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{k.label}</p>
                <p style={{ fontSize: 24, fontWeight: 700, color: k.c }}>{k.value}</p>
              </div>
            ))}
          </div>
          <div className="panel">
            <div className="panel-head">
              <h2>All Deliveries</h2>
              
            </div>
            <div className="panel-body" style={{ padding: 0 }}>
              <table className="data-table" style={{ width: "100%" }}>
                <thead>
                  <tr><th>DN#</th><th>Order</th><th>Customer</th><th>Scheduled</th><th>Delivered</th><th>Status</th><th>On Time?</th></tr>
                </thead>
                <tbody>
                  {deliveries.map((d) => {
                    const onTime = d.deliveredDate ? new Date(d.deliveredDate) <= new Date(d.scheduledDate) : null;
                    return (
                      <tr key={d.id}>
                        <td style={{ fontFamily: "monospace", fontSize: 12 }}>{d.deliveryNumber}</td>
                        <td style={{ fontFamily: "monospace", fontSize: 12 }}>{d.orderNumber}</td>
                        <td style={{ fontSize: 13 }}>{d.customerName}</td>
                        <td style={{ fontSize: 12 }}>{fmtDate(d.scheduledDate)}</td>
                        <td style={{ fontSize: 12 }}>{d.deliveredDate ? fmtDate(d.deliveredDate) : "—"}</td>
                        <td><Tag s={d.status} /></td>
                        <td>
                          {onTime === null ? "—" : onTime ? <Tag s="On Time" c="var(--green)" /> : <Tag s="Late" c="var(--red)" />}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
