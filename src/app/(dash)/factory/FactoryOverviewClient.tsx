"use client";
import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Machine = {
  id: number; code: string; name: string; type: string; status: string;
  factoryArea: { name: string; code: string } | null;
  isRunning: boolean; todayOutput: number;
  temperature: number | null; powerKw: number | null;
  runtimeMin: number; activeAlarmCount: number; criticalAlarmCount: number;
  openWorkOrders: number; metricUpdatedAt: Date | null;
};

type Overview = {
  totalMachines: number; runningMachines: number; operationalMachines: number;
  underMaintenanceMachines: number; offlineMachines: number; machineUtilPct: number;
  activeAlarms: number; overdueSchedules: number;
  todayOutputKg: number; todayDowntimeMin: number; monthOutputKg: number;
  openOrders: number; efficiencyPct: number; machines: Machine[];
};

type Area = {
  id: number; name: string; code: string; description: string | null;
  machineCount: number; runningCount: number; operationalCount: number;
  machines: { id: number; code: string; name: string; status: string; isRunning: boolean; todayOutput: number }[];
};

type AlarmCounts = { critical: number; warning: number; info: number; total: number };

type ShiftProgress = {
  currentShift: string; elapsedMin: number; remainingMin: number; progressPct: number;
  runningMachines: number; totalTrackedMachines: number;
  outputKg: number; targetKg: number | null; achievementPct: number | null;
};

interface Props {
  overview: Overview | null;
  areas: Area[];
  alarms: AlarmCounts;
  shift: ShiftProgress | null;
}

function Kpi({ label, value, sub, accent = "steel" }: { label: string; value: string | number; sub?: string; accent?: string }) {
  const color = accent === "green" ? "var(--green)" : accent === "red" ? "var(--red)" : accent === "amber" ? "var(--amber)" : accent === "blue" ? "var(--blue)" : accent === "purple" ? "var(--purple)" : "var(--steel)";
  const bg = accent === "green" ? "var(--green-bg)" : accent === "red" ? "var(--red-bg)" : accent === "amber" ? "var(--amber-bg)" : accent === "blue" ? "var(--blue-bg)" : accent === "purple" ? "var(--purple-bg)" : "var(--steel-light)";
  return (
    <div style={{ background: bg, borderRadius: 10, padding: "14px 18px" }}>
      <div style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function StatusBadge({ status, isRunning }: { status: string; isRunning: boolean }) {
  if (status === "OFFLINE") return <span style={{ fontSize: 11, background: "var(--red-bg)", color: "var(--red)", borderRadius: 4, padding: "2px 6px", fontWeight: 600 }}>Offline</span>;
  if (status === "UNDER_MAINTENANCE") return <span style={{ fontSize: 11, background: "var(--amber-bg)", color: "var(--amber)", borderRadius: 4, padding: "2px 6px", fontWeight: 600 }}>Maintenance</span>;
  if (isRunning) return <span style={{ fontSize: 11, background: "var(--green-bg)", color: "var(--green)", borderRadius: 4, padding: "2px 6px", fontWeight: 600 }}>Running</span>;
  return <span style={{ fontSize: 11, background: "var(--surface-2)", color: "var(--text-2)", borderRadius: 4, padding: "2px 6px", fontWeight: 600 }}>Stopped</span>;
}

function MachineCard({ machine }: { machine: Machine }) {
  const borderColor = machine.criticalAlarmCount > 0 ? "var(--red)" : machine.status === "OFFLINE" ? "#fca5a5" : machine.isRunning ? "#86efac" : "var(--border)";
  return (
    <Link
      href={`/factory/machines/${machine.id}`}
      style={{ display: "block", textDecoration: "none", background: "var(--surface)", border: `1px solid ${borderColor}`, borderRadius: 10, padding: "12px 14px", transition: "box-shadow 0.15s" }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>{machine.code}</div>
          <div style={{ fontSize: 11, color: "var(--text-2)", marginTop: 1 }}>{machine.factoryArea?.name ?? "—"}</div>
        </div>
        <StatusBadge status={machine.status} isRunning={machine.isRunning} />
      </div>
      <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{machine.name}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <span style={{ fontSize: 11, color: "var(--text-2)" }}>Output: <strong style={{ color: "var(--text)" }}>{machine.todayOutput}</strong></span>
        {machine.temperature !== null && (
          <span style={{ fontSize: 11, color: machine.temperature > 80 ? "var(--red)" : "var(--text-2)" }}>
            {machine.temperature}°C
          </span>
        )}
        {machine.activeAlarmCount > 0 && (
          <span style={{ fontSize: 11, background: machine.criticalAlarmCount > 0 ? "var(--red-bg)" : "var(--amber-bg)", color: machine.criticalAlarmCount > 0 ? "var(--red)" : "var(--amber)", borderRadius: 4, padding: "1px 5px" }}>
            {machine.activeAlarmCount} alarm{machine.activeAlarmCount > 1 ? "s" : ""}
          </span>
        )}
      </div>
    </Link>
  );
}

function DigitalTwin({ areas }: { areas: Area[] }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: 0 }}>Factory Layout</h2>
        <span style={{ fontSize: 12, color: "var(--text-3)" }}>Digital Twin — Phase 1</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
        {areas.map(area => {
          const utilPct = area.machineCount > 0 ? Math.round((area.runningCount / area.machineCount) * 100) : 0;
          const utilColor = utilPct >= 80 ? "var(--green)" : utilPct >= 50 ? "var(--amber)" : "var(--text-2)";
          return (
            <div key={area.id} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 14, background: "var(--surface-2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text)" }}>{area.code}</div>
                  <div style={{ fontSize: 11, color: "var(--text-2)" }}>{area.name}</div>
                </div>
                <span style={{ fontSize: 14, fontWeight: 800, color: utilColor }}>{utilPct}%</span>
              </div>
              <div style={{ background: "var(--border)", borderRadius: 3, height: 4, overflow: "hidden", marginBottom: 8 }}>
                <div style={{ width: `${utilPct}%`, height: "100%", background: utilColor, borderRadius: 3 }} />
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {area.machines.map(m => (
                  <div
                    key={m.id}
                    title={`${m.code} — ${m.isRunning ? "Running" : m.status}`}
                    style={{
                      width: 18, height: 18, borderRadius: 3,
                      background: m.status === "OFFLINE" ? "#fca5a5" : m.status === "UNDER_MAINTENANCE" ? "#fde68a" : m.isRunning ? "#86efac" : "var(--border)",
                      border: "1px solid transparent",
                    }}
                  />
                ))}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 8 }}>{area.runningCount}/{area.machineCount} running</div>
            </div>
          );
        })}
        {/* Static fixed areas */}
        {["Warehouse", "Quality Control", "Packing Area", "Maintenance Bay"].map(name => (
          <div key={name} style={{ border: "1px dashed var(--border)", borderRadius: 8, padding: 14, opacity: 0.5 }}>
            <div style={{ fontSize: 13, color: "var(--text-2)", fontWeight: 600 }}>{name}</div>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>Integration Phase 2</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FactoryOverviewClient({ overview, areas, alarms, shift }: Props) {
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);

  useEffect(() => {
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  const shiftColor = shift?.currentShift === "DAY" ? "var(--amber)" : shift?.currentShift === "EVENING" ? "#ea580c" : "var(--purple)";

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1400, margin: "0 auto", display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Page header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", margin: 0 }}>Smart Factory Overview</h1>
          <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Live · auto-refresh every 5s</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link href="/factory/alarms" style={{ fontSize: 13, padding: "8px 14px", borderRadius: 8, background: alarms.critical > 0 ? "var(--red-bg)" : "var(--surface)", border: "1px solid var(--border)", color: alarms.critical > 0 ? "var(--red)" : "var(--text-2)", textDecoration: "none", fontWeight: 600 }}>
            {alarms.total > 0 ? `${alarms.total} Alarms` : "Alarm Center"}
          </Link>
          <Link href="/factory/oee" style={{ fontSize: 13, padding: "8px 14px", borderRadius: 8, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-2)", textDecoration: "none" }}>OEE</Link>
          <a href="/factory/tv" target="_blank" style={{ fontSize: 13, padding: "8px 14px", borderRadius: 8, background: "var(--steel)", color: "#fff", textDecoration: "none", fontWeight: 600 }}>TV View ↗</a>
        </div>
      </div>

      {/* Shift progress */}
      {shift && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "16px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontWeight: 700, color: shiftColor, fontSize: 14 }}>{shift.currentShift} SHIFT</span>
            <span style={{ fontSize: 13, color: "var(--text-2)" }}>
              {shift.elapsedMin} min elapsed · {shift.remainingMin} min remaining
              {shift.targetKg && <> · {shift.outputKg} / {shift.targetKg} kg <strong style={{ color: (shift.achievementPct ?? 0) >= 90 ? "var(--green)" : "var(--amber)" }}>({shift.achievementPct}%)</strong></>}
            </span>
          </div>
          <div style={{ background: "var(--border)", borderRadius: 4, height: 8, overflow: "hidden" }}>
            <div style={{ width: `${shift.progressPct}%`, height: "100%", background: shiftColor, borderRadius: 4, transition: "width 1s ease" }} />
          </div>
        </div>
      )}

      {/* KPI row */}
      {overview && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
          <Kpi label="Today Output" value={`${overview.todayOutputKg} kg`} accent="green" />
          <Kpi label="Month Output" value={`${overview.monthOutputKg} kg`} accent="blue" />
          <Kpi label="Efficiency" value={`${overview.efficiencyPct}%`} accent={overview.efficiencyPct >= 85 ? "green" : overview.efficiencyPct >= 70 ? "amber" : "red"} />
          <Kpi label="Running" value={`${overview.runningMachines}/${overview.totalMachines}`} accent="purple" sub="machines" />
          <Kpi label="Operational" value={overview.operationalMachines} accent="steel" />
          <Kpi label="Maintenance" value={overview.underMaintenanceMachines} accent={overview.underMaintenanceMachines > 0 ? "amber" : "steel"} />
          <Kpi label="Offline" value={overview.offlineMachines} accent={overview.offlineMachines > 0 ? "red" : "steel"} />
          <Kpi label="Active Alarms" value={alarms.total} accent={alarms.critical > 0 ? "red" : alarms.warning > 0 ? "amber" : "green"} sub={alarms.critical > 0 ? `${alarms.critical} critical` : undefined} />
          <Kpi label="Open Orders" value={overview.openOrders} accent="blue" />
          <Kpi label="Overdue Maint." value={overview.overdueSchedules} accent={overview.overdueSchedules > 0 ? "amber" : "green"} />
        </div>
      )}

      {/* Digital Twin */}
      <DigitalTwin areas={areas} />

      {/* Machine grid */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", margin: 0 }}>All Machines</h2>
          <Link href="/factory/machines" style={{ fontSize: 12, color: "var(--steel)", textDecoration: "none" }}>View All →</Link>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
          {(overview?.machines ?? []).map(m => <MachineCard key={m.id} machine={m} />)}
          {!overview?.machines.length && (
            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: 40, color: "var(--text-3)", fontSize: 14 }}>
              No machines configured yet.{" "}
              <Link href="/production" style={{ color: "var(--steel)" }}>Go to Production</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
