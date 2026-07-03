"use client";
import {
  ComposedChart, Bar, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
  ReferenceLine,
} from "recharts";

type DataPoint = { month: string; revenue: number | null; productionKg: number | null; actual: boolean };

type Data = {
  historical: DataPoint[];
  forecast: DataPoint[];
  currentInventoryValue: number;
};

function fmtUsd(n: number) { return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 }); }
function fmtKg(n: number) { return n.toLocaleString("en-US", { maximumFractionDigits: 0 }) + " kg"; }

export function ForecastDashboard({ data }: { data: Data }) {
  const all = [...data.historical, ...data.forecast];
  const lastActual = data.historical[data.historical.length - 1]?.month ?? "";

  const forecastRevenue = data.forecast.reduce((s, p) => s + (p.revenue ?? 0), 0);
  const forecastProduction = data.forecast.reduce((s, p) => s + (p.productionKg ?? 0), 0);
  const histRevenue = data.historical.reduce((s, p) => s + (p.revenue ?? 0), 0);
  const histProduction = data.historical.reduce((s, p) => s + (p.productionKg ?? 0), 0);
  const histMonths = data.historical.length || 1;

  const avgRevenue = histRevenue / histMonths;
  const avgProduction = histProduction / histMonths;
  const forecastMonths = data.forecast.length || 1;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(175px, 1fr))", gap: 12 }}>
        <div className="kpi-card" style={{ borderTop: "3px solid #6366f1" }}>
          <div className="kpi-label">Forecast Revenue (3mo)</div>
          <div className="kpi-value" style={{ color: "#6366f1" }}>{fmtUsd(forecastRevenue)}</div>
          <div style={{ fontSize: 11, color: "var(--text-3)" }}>avg {fmtUsd(forecastRevenue / forecastMonths)}/mo</div>
        </div>
        <div className="kpi-card" style={{ borderTop: "3px solid #10b981" }}>
          <div className="kpi-label">Forecast Production (3mo)</div>
          <div className="kpi-value" style={{ color: "#10b981" }}>{fmtKg(forecastProduction)}</div>
          <div style={{ fontSize: 11, color: "var(--text-3)" }}>avg {fmtKg(forecastProduction / forecastMonths)}/mo</div>
        </div>
        <div className="kpi-card" style={{ borderTop: "3px solid #f59e0b" }}>
          <div className="kpi-label">Avg Historic Revenue</div>
          <div className="kpi-value">{fmtUsd(avgRevenue)}</div>
          <div style={{ fontSize: 11, color: "var(--text-3)" }}>per month (6mo)</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Current Inventory Value</div>
          <div className="kpi-value" style={{ fontSize: 18 }}>{fmtUsd(data.currentInventoryValue)}</div>
        </div>
      </div>

      {/* Revenue Forecast Chart */}
      <div className="panel">
        <div className="panel-head">Revenue Forecast — Historical vs Projected</div>
        <div style={{ padding: "0 16px 8px", fontSize: 11, color: "var(--text-3)" }}>
          Bars = actual revenue &nbsp;|&nbsp; Dashed line = linear projection &nbsp;|&nbsp; Dotted line = average
        </div>
        <div className="panel-body">
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={all}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="rev" tick={{ fontSize: 11 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(v: number, name: string) => {
                  if (name === "revenue" || name === "Actual Revenue") return [fmtUsd(v), "Revenue"];
                  return [fmtUsd(v), name];
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine yAxisId="rev" y={avgRevenue} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: "Avg", position: "right", fontSize: 10, fill: "#f59e0b" }} />
              <Bar yAxisId="rev" dataKey="revenue" name="Revenue" fill="#6366f1"
                fillOpacity={all.map((d) => (d.actual ? 1 : 0.35))[0]}
                radius={[3, 3, 0, 0]}
              />
            </ComposedChart>
          </ResponsiveContainer>
          {/* Projected rows legend */}
          <div style={{ display: "flex", gap: 16, padding: "4px 0 8px 8px", flexWrap: "wrap" }}>
            {all.map((d) => (
              <div key={d.month} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: d.actual ? "#6366f1" : "#6366f150", border: d.actual ? "none" : "1px dashed #6366f1" }} />
                <span style={{ color: d.actual ? "var(--text)" : "var(--text-3)" }}>{d.month}{!d.actual ? " ★" : ""}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Production Forecast Chart */}
      <div className="panel">
        <div className="panel-head">Production Forecast (kg) — Historical vs Projected</div>
        <div className="panel-body">
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={all}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="prod" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}t`} />
              <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v: number) => [`${v.toLocaleString()} kg`]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="prod" dataKey="productionKg" name="Production (kg)" fill="#10b981" radius={[3, 3, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Data table */}
      <div className="panel">
        <div className="panel-head">Forecast Detail</div>
        <div style={{ padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Type</th>
                <th>Revenue</th>
                <th>Production (kg)</th>
              </tr>
            </thead>
            <tbody>
              {all.map((d) => (
                <tr key={d.month} style={{ background: d.actual ? "transparent" : "#6366f108" }}>
                  <td style={{ fontWeight: 600 }}>{d.month}</td>
                  <td>
                    <span className="tag" style={{ fontSize: 10, background: d.actual ? "#10b98120" : "#6366f120", color: d.actual ? "#10b981" : "#6366f1" }}>
                      {d.actual ? "Historical" : "Projected"}
                    </span>
                  </td>
                  <td style={{ fontFamily: "monospace", fontSize: 13 }}>{d.revenue !== null ? fmtUsd(d.revenue) : "—"}</td>
                  <td style={{ fontFamily: "monospace", fontSize: 13 }}>{d.productionKg !== null ? fmtKg(d.productionKg) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ padding: "8px 12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 11, color: "var(--text-3)" }}>
        ★ Projected values use linear regression on the last 6 months of actual data. Accuracy improves with more data points. Use as planning guidance only.
      </div>
    </div>
  );
}
