"use client";
import Link from "next/link";

type ShiftReport = {
  id: number; shift: string; area: { name: string; code: string } | null;
  outputKg: number; downtimeMin: number; headcount: number;
  submittedBy: string; notes: string | null;
};

type Today = {
  date: Date;
  shifts: ShiftReport[];
  totals: { outputKg: number; downtimeMin: number; headcount: number; efficiencyPct: number };
};

type TrendDay = { date: Date; outputKg: number; downtimeMin: number; efficiencyPct: number };

interface Props { today: Today | null; trend: TrendDay[] }

const SHIFT_COLOR: Record<string, string> = { DAY: "var(--amber)", AFTERNOON: "#ea580c", NIGHT: "var(--purple)" };

export default function ShiftManager({ today, trend }: Props) {
  return (
    <div style={{ padding: "28px 32px", maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", margin: 0 }}>Shift Summary</h1>
          <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>
            {today ? `Today — ${new Date(today.date).toLocaleDateString()}` : "No data for today"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/production" style={{ fontSize: 13, padding: "8px 14px", borderRadius: 8, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-2)", textDecoration: "none" }}>Add Report</Link>
          <Link href="/factory" style={{ fontSize: 13, padding: "8px 14px", borderRadius: 8, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-2)", textDecoration: "none" }}>← Factory</Link>
        </div>
      </div>

      {today && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: "0 0 14px 0" }}>Today&apos;s Totals</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
            {[
              { label: "Output", value: `${today.totals.outputKg} kg`, color: "var(--green-bg)", text: "var(--green)" },
              { label: "Efficiency", value: `${today.totals.efficiencyPct}%`, color: today.totals.efficiencyPct >= 85 ? "var(--green-bg)" : today.totals.efficiencyPct >= 70 ? "var(--amber-bg)" : "var(--red-bg)", text: today.totals.efficiencyPct >= 85 ? "var(--green)" : today.totals.efficiencyPct >= 70 ? "var(--amber)" : "var(--red)" },
              { label: "Downtime", value: `${today.totals.downtimeMin} min`, color: today.totals.downtimeMin > 60 ? "var(--red-bg)" : "var(--surface-2)", text: today.totals.downtimeMin > 60 ? "var(--red)" : "var(--text)" },
              { label: "Headcount", value: today.totals.headcount, color: "var(--surface-2)", text: "var(--text)" },
            ].map(k => (
              <div key={k.label} style={{ background: k.color, borderRadius: 8, padding: "12px 14px" }}>
                <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>{k.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: k.text }}>{k.value}</div>
              </div>
            ))}
          </div>

          {today.shifts.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 10 }}>By Shift</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {today.shifts.map(s => (
                  <div key={s.id} style={{ display: "flex", gap: 16, alignItems: "center", padding: "10px 14px", background: "var(--surface-2)", borderRadius: 8, borderLeft: `3px solid ${SHIFT_COLOR[s.shift] ?? "var(--border)"}` }}>
                    <div style={{ minWidth: 80 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: SHIFT_COLOR[s.shift] ?? "var(--text)" }}>{s.shift}</span>
                      {s.area && <div style={{ fontSize: 11, color: "var(--text-3)" }}>{s.area.name}</div>}
                    </div>
                    <div style={{ flex: 1, display: "flex", gap: 16, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12, color: "var(--text-2)" }}>Output: <strong style={{ color: "var(--text)" }}>{s.outputKg} kg</strong></span>
                      <span style={{ fontSize: 12, color: "var(--text-2)" }}>Downtime: <strong>{s.downtimeMin} min</strong></span>
                      <span style={{ fontSize: 12, color: "var(--text-2)" }}>HC: <strong>{s.headcount}</strong></span>
                    </div>
                    <span style={{ fontSize: 11, color: "var(--text-3)" }}>{s.submittedBy}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {today.shifts.length === 0 && (
            <div style={{ marginTop: 14, padding: 20, textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>
              No shift reports submitted today yet.{" "}
              <Link href="/production" style={{ color: "var(--steel)" }}>Submit a production report →</Link>
            </div>
          )}
        </div>
      )}

      {trend.length > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: "0 0 14px 0" }}>14-Day Output Trend</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 500 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Date", "Output (kg)", "Downtime (min)", "Efficiency"].map(h => (
                    <th key={h} style={{ padding: "8px", fontSize: 11, color: "var(--text-3)", fontWeight: 600, textAlign: "right" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {trend.map((d, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px", fontSize: 12, color: "var(--text-2)" }}>{new Date(d.date).toLocaleDateString()}</td>
                    <td style={{ padding: "8px", fontSize: 12, color: "var(--text)", textAlign: "right", fontWeight: 600 }}>{d.outputKg}</td>
                    <td style={{ padding: "8px", fontSize: 12, textAlign: "right", color: d.downtimeMin > 60 ? "var(--red)" : "var(--text-2)" }}>{d.downtimeMin}</td>
                    <td style={{ padding: "8px", fontSize: 12, textAlign: "right", fontWeight: 700, color: d.efficiencyPct >= 85 ? "var(--green)" : d.efficiencyPct >= 70 ? "var(--amber)" : "var(--red)" }}>{d.efficiencyPct}%</td>
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
