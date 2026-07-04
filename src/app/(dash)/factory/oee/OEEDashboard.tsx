"use client";
import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type MachineOEE = {
  machineId: number; code: string; name: string; factoryArea: string | null;
  availability: number; performance: number; quality: number; oee: number; recordCount: number;
};

type TrendRecord = {
  machineId: number; machineCode: string; machineName: string; periodDate: Date;
  availability: number; performance: number; quality: number; oee: number;
  downtimeMin: number; actualOutput: number; defectCount: number;
};

interface Props { byMachine: MachineOEE[]; trend: TrendRecord[] }

function oeeColor(v: number) {
  return v >= 85 ? "var(--green)" : v >= 65 ? "var(--amber)" : "var(--red)";
}

function GaugeBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-2)", marginBottom: 4 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 700, color }}>{value}%</span>
      </div>
      <div style={{ background: "var(--border)", borderRadius: 4, height: 8, overflow: "hidden" }}>
        <div style={{ width: `${value}%`, height: "100%", background: color, borderRadius: 4 }} />
      </div>
    </div>
  );
}

function MachineOEECard({ m }: { m: MachineOEE }) {
  return (
    <Link
      href={`/factory/machines/${m.machineId}`}
      style={{ display: "block", textDecoration: "none", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>{m.code}</div>
          <div style={{ fontSize: 11, color: "var(--text-3)" }}>{m.factoryArea ?? m.name}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: oeeColor(m.oee), lineHeight: 1 }}>{m.oee}%</div>
          <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>OEE</div>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <GaugeBar label="Availability" value={m.availability} color="var(--blue)" />
        <GaugeBar label="Performance" value={m.performance} color="var(--purple)" />
        <GaugeBar label="Quality" value={m.quality} color="var(--green)" />
      </div>
      {m.recordCount === 0 && (
        <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 8, textAlign: "center" }}>Estimated — no OEE records yet</div>
      )}
    </Link>
  );
}

export default function OEEDashboard({ byMachine, trend }: Props) {
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);
  useEffect(() => { const t = setInterval(refresh, 30000); return () => clearInterval(t); }, [refresh]);

  // Compute fleet averages
  const withRecords = byMachine.filter(m => m.recordCount > 0);
  const avgOEE = withRecords.length > 0 ? withRecords.reduce((s, m) => s + m.oee, 0) / withRecords.length : 0;
  const avgAvail = withRecords.length > 0 ? withRecords.reduce((s, m) => s + m.availability, 0) / withRecords.length : 0;
  const avgPerf = withRecords.length > 0 ? withRecords.reduce((s, m) => s + m.performance, 0) / withRecords.length : 0;
  const avgQuality = withRecords.length > 0 ? withRecords.reduce((s, m) => s + m.quality, 0) / withRecords.length : 0;

  // Group trend by date for fleet average line
  const dailyMap = new Map<string, { date: string; sum: number; count: number }>();
  for (const r of trend) {
    const key = new Date(r.periodDate).toLocaleDateString();
    const existing = dailyMap.get(key) ?? { date: key, sum: 0, count: 0 };
    dailyMap.set(key, { date: key, sum: existing.sum + r.oee, count: existing.count + 1 });
  }
  const dailyTrend = Array.from(dailyMap.values()).map(d => ({ date: d.date, oee: Math.round((d.sum / d.count) * 10) / 10 }));

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1300, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", margin: 0 }}>OEE Dashboard</h1>
          <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Overall Equipment Effectiveness · 30-day window</div>
        </div>
        <Link href="/factory" style={{ fontSize: 13, padding: "8px 14px", borderRadius: 8, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-2)", textDecoration: "none" }}>← Factory</Link>
      </div>

      {/* Fleet summary */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
        <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: "0 0 16px 0" }}>Fleet Average (30 days)</h2>
        {withRecords.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 48, fontWeight: 900, color: oeeColor(Math.round(avgOEE)), lineHeight: 1 }}>{Math.round(avgOEE * 10) / 10}%</div>
              <div style={{ fontSize: 13, color: "var(--text-2)", marginTop: 4 }}>Overall OEE</div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
                {Math.round(avgOEE) >= 85 ? "World-class" : Math.round(avgOEE) >= 65 ? "Acceptable" : "Needs improvement"}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, justifyContent: "center" }}>
              <GaugeBar label="Availability" value={Math.round(avgAvail * 10) / 10} color="var(--blue)" />
              <GaugeBar label="Performance" value={Math.round(avgPerf * 10) / 10} color="var(--purple)" />
              <GaugeBar label="Quality" value={Math.round(avgQuality * 10) / 10} color="var(--green)" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, justifyContent: "center" }}>
              <div style={{ fontSize: 12, color: "var(--text-2)" }}>Machines tracked: <strong>{withRecords.length}</strong></div>
              <div style={{ fontSize: 12, color: "var(--text-2)" }}>OEE world-class target: <strong style={{ color: "var(--green)" }}>≥ 85%</strong></div>
              <div style={{ fontSize: 12, color: "var(--text-2)" }}>OEE acceptable range: <strong style={{ color: "var(--amber)" }}>65–85%</strong></div>
            </div>
          </div>
        ) : (
          <div style={{ padding: 20, textAlign: "center", color: "var(--text-3)", fontSize: 14 }}>
            No OEE records yet. Records are computed from production and maintenance data daily.
          </div>
        )}
      </div>

      {/* Daily trend table */}
      {dailyTrend.length > 0 && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
          <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: "0 0 14px 0" }}>Daily Fleet OEE Trend</h2>
          <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 80, overflow: "hidden" }}>
            {dailyTrend.map((d, i) => (
              <div key={i} title={`${d.date}: ${d.oee}%`} style={{ flex: 1, minWidth: 4, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 2 }}>
                <div style={{ height: `${Math.max(d.oee, 2)}%`, background: oeeColor(d.oee), borderRadius: "2px 2px 0 0" }} />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10, color: "var(--text-3)" }}>
            {dailyTrend.length > 0 && <span>{dailyTrend[0]?.date}</span>}
            {dailyTrend.length > 1 && <span>{dailyTrend[dailyTrend.length - 1]?.date}</span>}
          </div>
        </div>
      )}

      {/* Per-machine grid */}
      <div>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: "0 0 14px 0" }}>Per-Machine OEE (30-day avg)</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
          {byMachine.map(m => <MachineOEECard key={m.machineId} m={m} />)}
          {byMachine.length === 0 && (
            <div style={{ gridColumn: "1/-1", padding: 40, textAlign: "center", color: "var(--text-3)", fontSize: 14 }}>No machines found.</div>
          )}
        </div>
      </div>

      {/* Formula reference */}
      <div style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: 16 }}>
        <div style={{ fontSize: 12, color: "var(--text-2)", fontWeight: 700, marginBottom: 6 }}>OEE Formula Reference</div>
        <div style={{ fontSize: 11, color: "var(--text-3)", display: "flex", gap: 24, flexWrap: "wrap" }}>
          <span>Availability = (Planned − Downtime) / Planned × 100</span>
          <span>Performance = Actual / Target × 100</span>
          <span>Quality = Good / Total × 100</span>
          <span style={{ fontWeight: 700, color: "var(--text-2)" }}>OEE = A × P × Q / 10,000</span>
        </div>
      </div>
    </div>
  );
}
