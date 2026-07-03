"use client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

// ─── Types ──────────────────────────────────────────────────────────────────────

interface TopCustomer { id: number; name: string; customerCode: string; totalUsd: number; orderCount: number; }
interface RecentOrder { id: number; orderNumber: string; customerName: string; status: string; totalUsd: number; orderDate: string; createdBy: string; paymentStatus: string; }
interface RecentLead { id: number; contactName: string; companyName: string | null; source: string; stage: string; estimatedValueUsd: number | null; assignedToName: string | null; createdAt: string; }

interface Summary {
  totalCustomers: number;
  activeLeads: number;
  pendingQuotations: number;
  activeOrders: number;
  revenueThisMonth: number;
  outstandingDeliveries: number;
  revenueTrend: { month: string; amount: number }[];
  topCustomers: TopCustomer[];
  quotationsByStatus: { status: string; count: number; totalUsd: number }[];
  ordersByStatus: { status: string; count: number; totalUsd: number }[];
  recentOrders: RecentOrder[];
  recentLeads: RecentLead[];
}

interface Props {
  summary: Summary;
  canManage: boolean;
  canApprove: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────────

const fmtUsd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "#64748b", SENT: "#2563eb", APPROVED: "#16a34a", REJECTED: "#dc2626",
  EXPIRED: "#9ca3af", CONVERTED: "#7c3aed",
  CONFIRMED: "#0891b2", IN_PRODUCTION: "#d97706", READY: "#16a34a",
  DELIVERED: "#64748b", CANCELLED: "#dc2626",
};
const STAGE_COLORS: Record<string, string> = {
  NEW: "#64748b", CONTACTED: "#2563eb", QUALIFIED: "#7c3aed",
  QUOTATION: "#d97706", WON: "#16a34a", LOST: "#dc2626",
};

function Tag({ label, color }: { label: string; color?: string }) {
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 100,
      fontSize: 11, fontWeight: 600, letterSpacing: "0.04em",
      background: `${color ?? "#64748b"}22`,
      color: color ?? "#64748b",
    }}>{label}</span>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: "green" | "amber" | "red" | "blue" | "steel" }) {
  const colors: Record<string, string> = { green: "var(--green)", amber: "var(--amber)", red: "var(--red)", blue: "var(--blue)", steel: "var(--steel)" };
  const bgs: Record<string, string> = { green: "var(--green-bg)", amber: "var(--amber-bg)", red: "var(--red-bg)", blue: "var(--blue-bg)", steel: "var(--steel-light)" };
  const c = colors[accent ?? "steel"]; const bg = bgs[accent ?? "steel"];
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 18px" }}>
      <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 700, color: c ?? "var(--text)" }}>{value}</p>
      {sub && <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{sub}</p>}
    </div>
  );
}

export function SalesDashboard({ summary }: Props) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* KPI Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 12 }}>
        <Kpi label="Revenue This Month" value={fmtUsd(summary.revenueThisMonth)} accent="green" />
        <Kpi label="Active Customers" value={summary.totalCustomers} accent="blue" />
        <Kpi label="Active Orders" value={summary.activeOrders} sub="Confirmed / In Production / Ready" accent="steel" />
        <Kpi label="Pending Quotations" value={summary.pendingQuotations} sub="Draft + Sent" accent="amber" />
        <Kpi label="Active Leads" value={summary.activeLeads} sub="Not won/lost" accent="blue" />
        <Kpi label="Outstanding Deliveries" value={summary.outstandingDeliveries} accent={summary.outstandingDeliveries > 0 ? "amber" : "green"} />
      </div>

      {/* Charts row */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        {/* Revenue trend */}
        <div className="panel">
          <div className="panel-head"><h2>Monthly Revenue (USD)</h2></div>
          <div className="panel-body" style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary.revenueTrend} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => fmtUsd(v)} />
                <Bar dataKey="amount" name="Revenue" fill="var(--steel)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Orders by status */}
        <div className="panel">
          <div className="panel-head"><h2>Orders by Status</h2></div>
          <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {summary.ordersByStatus.length === 0 && (
              <p style={{ color: "var(--text-3)", fontSize: 13 }}>No orders yet</p>
            )}
            {summary.ordersByStatus.map((r) => (
              <div key={r.status} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Tag label={r.status.replace(/_/g, " ")} color={STATUS_COLORS[r.status]} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{r.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Customers + Recent Leads */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div className="panel">
          <div className="panel-head"><h2>Top Customers by Revenue</h2></div>
          <div className="panel-body" style={{ padding: 0 }}>
            {summary.topCustomers.length === 0 ? (
              <p style={{ padding: 16, color: "var(--text-3)", fontSize: 13 }}>No orders yet</p>
            ) : (
              <table className="data-table" style={{ width: "100%" }}>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th style={{ textAlign: "center" }}>Orders</th>
                    <th style={{ textAlign: "right" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.topCustomers.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text-3)" }}>{c.customerCode}</div>
                      </td>
                      <td style={{ textAlign: "center", fontSize: 13 }}>{c.orderCount}</td>
                      <td style={{ textAlign: "right", fontSize: 13, fontWeight: 600, color: "var(--green)" }}>{fmtUsd(c.totalUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head"><h2>Recent Leads</h2></div>
          <div className="panel-body" style={{ padding: 0 }}>
            {summary.recentLeads.length === 0 ? (
              <p style={{ padding: 16, color: "var(--text-3)", fontSize: 13 }}>No leads yet</p>
            ) : (
              <table className="data-table" style={{ width: "100%" }}>
                <thead>
                  <tr><th>Contact</th><th>Source</th><th>Stage</th></tr>
                </thead>
                <tbody>
                  {summary.recentLeads.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{l.contactName}</div>
                        {l.companyName && <div style={{ fontSize: 11, color: "var(--text-3)" }}>{l.companyName}</div>}
                      </td>
                      <td style={{ fontSize: 12 }}>{l.source.replace(/_/g, " ")}</td>
                      <td><Tag label={l.stage} color={STAGE_COLORS[l.stage]} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="panel">
        <div className="panel-head"><h2>Recent Orders</h2></div>
        <div className="panel-body" style={{ padding: 0 }}>
          {summary.recentOrders.length === 0 ? (
            <p style={{ padding: 16, color: "var(--text-3)", fontSize: 13 }}>No orders yet</p>
          ) : (
            <table className="data-table" style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Order #</th><th>Customer</th><th>Date</th>
                  <th>Status</th><th>Payment</th><th style={{ textAlign: "right" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {summary.recentOrders.map((o) => (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 600, fontSize: 13 }}>{o.orderNumber}</td>
                    <td style={{ fontSize: 13 }}>{o.customerName}</td>
                    <td style={{ fontSize: 12, color: "var(--text-3)" }}>{fmtDate(o.orderDate)}</td>
                    <td><Tag label={o.status.replace(/_/g, " ")} color={STATUS_COLORS[o.status]} /></td>
                    <td style={{ fontSize: 12 }}>{o.paymentStatus}</td>
                    <td style={{ textAlign: "right", fontWeight: 600, color: "var(--green)", fontSize: 13 }}>{fmtUsd(o.totalUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
