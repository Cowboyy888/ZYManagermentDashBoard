"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type Overview = {
  totalMachines: number;
  runningMachines: number;
  operationalMachines: number;
  underMaintenanceMachines: number;
  offlineMachines: number;
  machineUtilPct: number;
  activeAlarms: number;
  overdueSchedules: number;
  todayOutputKg: number;
  todayDowntimeMin: number;
  monthOutputKg: number;
  openOrders: number;
  efficiencyPct: number;
  machines: {
    id: number; code: string; name: string; type: string; status: string;
    factoryArea: { name: string; code: string } | null;
    isRunning: boolean; todayOutput: number;
    temperature: number | null; powerKw: number | null;
    runtimeMin: number; activeAlarmCount: number; criticalAlarmCount: number;
    openWorkOrders: number; metricUpdatedAt: Date | null;
  }[];
};

type AlarmCounts = { critical: number; warning: number; info: number; total: number };

type ShiftProgress = {
  currentShift: string; elapsedMin: number; remainingMin: number; progressPct: number;
  runningMachines: number; totalTrackedMachines: number;
  outputKg: number; targetKg: number | null; achievementPct: number | null;
};

interface Props {
  overview: Overview | null;
  alarms: AlarmCounts | null;
  shift: ShiftProgress | null;
}

function pad2(n: number) { return String(n).padStart(2, "0"); }

function Clock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span style={{ fontVariantNumeric: "tabular-nums" }}>
      {pad2(time.getHours())}:{pad2(time.getMinutes())}:{pad2(time.getSeconds())}
    </span>
  );
}

function KpiCard({ label, value, sub, accent = "#60a5fa" }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div style={{ background: "#111827", border: `1px solid ${accent}33`, borderRadius: 12, padding: "20px 24px", minWidth: 160 }}>
      <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ fontSize: 36, fontWeight: 800, color: accent, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function MachineStatusDot({ isRunning, status }: { isRunning: boolean; status: string }) {
  const color = status === "OFFLINE" ? "#ef4444" : status === "UNDER_MAINTENANCE" ? "#f59e0b" : isRunning ? "#22c55e" : "#64748b";
  return <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}88`, marginRight: 6, flexShrink: 0 }} />;
}

function ProgressBar({ pct, color = "#3b82f6" }: { pct: number; color?: string }) {
  return (
    <div style={{ background: "#1e293b", borderRadius: 4, height: 8, overflow: "hidden" }}>
      <div style={{ width: `${Math.min(100, pct)}%`, height: "100%", background: color, borderRadius: 4, transition: "width 1s ease" }} />
    </div>
  );
}

export default function TVDashboard({ overview, alarms, shift }: Props) {
  const router = useRouter();
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const refresh = useCallback(() => {
    router.refresh();
    setLastRefresh(new Date());
  }, [router]);

  useEffect(() => {
    const interval = setInterval(refresh, 10000);
    return () => clearInterval(interval);
  }, [refresh]);

  const shiftColor = shift?.currentShift === "DAY" ? "#fbbf24" : shift?.currentShift === "EVENING" ? "#fb923c" : "#818cf8";
  const achievePct = shift?.achievementPct ?? 0;
  const achieveColor = achievePct >= 90 ? "#22c55e" : achievePct >= 70 ? "#fbbf24" : "#ef4444";

  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column", background: "#0a0e1a", padding: 24, boxSizing: "border-box", gap: 20, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1e293b", paddingBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e" }} />
          <span style={{ fontSize: 22, fontWeight: 800, color: "#e2e8f0", letterSpacing: "-0.02em" }}>ZY STEEL — FACTORY LIVE</span>
        </div>
        <div style={{ display: "flex", gap: 32, alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "#64748b" }}>Last update: {pad2(lastRefresh.getHours())}:{pad2(lastRefresh.getMinutes())}:{pad2(lastRefresh.getSeconds())}</span>
          <span style={{ fontSize: 28, fontWeight: 700, color: "#e2e8f0", fontVariantNumeric: "tabular-nums" }}><Clock /></span>
        </div>
      </div>

      {/* KPI Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
        <KpiCard label="Today Output" value={`${overview?.todayOutputKg ?? 0} kg`} accent="#22c55e" />
        <KpiCard label="Month Output" value={`${overview?.monthOutputKg ?? 0} kg`} accent="#60a5fa" />
        <KpiCard label="Efficiency" value={`${overview?.efficiencyPct ?? 0}%`} accent={
          (overview?.efficiencyPct ?? 0) >= 85 ? "#22c55e" : (overview?.efficiencyPct ?? 0) >= 70 ? "#fbbf24" : "#ef4444"
        } />
        <KpiCard label="Running Machines" value={`${overview?.runningMachines ?? 0} / ${overview?.totalMachines ?? 0}`} accent="#a78bfa" />
        <KpiCard label="Active Alarms" value={alarms?.total ?? 0} sub={alarms && alarms.critical > 0 ? `${alarms.critical} critical` : undefined} accent={alarms && alarms.critical > 0 ? "#ef4444" : alarms && alarms.warning > 0 ? "#f59e0b" : "#22c55e"} />
        <KpiCard label="Open Orders" value={overview?.openOrders ?? 0} accent="#fb923c" />
        <KpiCard label="Downtime Today" value={`${overview?.todayDowntimeMin ?? 0} min`} accent={(overview?.todayDowntimeMin ?? 0) > 60 ? "#ef4444" : "#64748b"} />
        {shift && <KpiCard label={`${shift.currentShift} Shift`} value={`${shift.progressPct}%`} sub={`${shift.remainingMin} min left`} accent={shiftColor} />}
      </div>

      {/* Shift Progress Bar */}
      {shift && (
        <div style={{ background: "#111827", border: "1px solid #1e293b", borderRadius: 12, padding: "16px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ color: shiftColor, fontWeight: 700, fontSize: 14 }}>{shift.currentShift} SHIFT PROGRESS</span>
            <span style={{ color: "#94a3b8", fontSize: 13 }}>
              {shift.elapsedMin} min elapsed · {shift.remainingMin} min remaining
              {shift.targetKg && <> · Target: {shift.targetKg} kg · Actual: {shift.outputKg} kg · <span style={{ color: achieveColor, fontWeight: 700 }}>{shift.achievementPct}%</span></>}
            </span>
          </div>
          <ProgressBar pct={shift.progressPct} color={shiftColor} />
        </div>
      )}

      {/* Machine Status Grid */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 13, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Machine Status</div>
        <div style={{ flex: 1, overflow: "hidden", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10, alignContent: "start" }}>
          {(overview?.machines ?? []).map(m => (
            <div
              key={m.id}
              style={{
                background: "#111827",
                border: `1px solid ${m.criticalAlarmCount > 0 ? "#ef444444" : m.status === "OFFLINE" ? "#ef444422" : m.isRunning ? "#22c55e22" : "#1e293b"}`,
                borderRadius: 10,
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <MachineStatusDot isRunning={m.isRunning} status={m.status} />
                  <span style={{ fontWeight: 700, fontSize: 14, color: "#e2e8f0" }}>{m.code}</span>
                </div>
                {m.activeAlarmCount > 0 && (
                  <span style={{ fontSize: 11, background: m.criticalAlarmCount > 0 ? "#ef4444" : "#f59e0b", color: "#fff", borderRadius: 4, padding: "1px 6px", fontWeight: 700 }}>
                    {m.activeAlarmCount} alarm{m.activeAlarmCount > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</div>
              <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                <span style={{ fontSize: 12, color: "#94a3b8" }}>Output: <span style={{ color: "#e2e8f0", fontWeight: 600 }}>{m.todayOutput}</span></span>
                {m.temperature !== null && <span style={{ fontSize: 12, color: m.temperature > 80 ? "#ef4444" : "#94a3b8" }}>Temp: <span style={{ fontWeight: 600 }}>{m.temperature}°C</span></span>}
              </div>
            </div>
          ))}
          {!overview?.machines.length && (
            <div style={{ color: "#475569", gridColumn: "1/-1", textAlign: "center", padding: 40, fontSize: 14 }}>No machine data available</div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #1e293b", paddingTop: 10 }}>
        <div style={{ display: "flex", gap: 20, fontSize: 12, color: "#475569" }}>
          <span>■ <span style={{ color: "#22c55e" }}>Running</span></span>
          <span>■ <span style={{ color: "#64748b" }}>Stopped</span></span>
          <span>■ <span style={{ color: "#f59e0b" }}>Maintenance</span></span>
          <span>■ <span style={{ color: "#ef4444" }}>Offline</span></span>
        </div>
        <span style={{ fontSize: 12, color: "#334155" }}>Auto-refresh every 10s · ZY Steel HR Dashboard</span>
      </div>
    </div>
  );
}
