"use client";
import { useCallback, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { acknowledgeAlarm, resolveAlarm } from "@/actions/factory/alarms";

type MachineDetailData = Awaited<ReturnType<typeof import("@/actions/factory/machines").getMachineDetail>>;
type Data = Extract<MachineDetailData, { ok: true }>["data"];

interface Props { data: Data }

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
      <h2 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: "0 0 14px 0" }}>{title}</h2>
      {children}
    </div>
  );
}

function MetricPill({ label, value, danger }: { label: string; value: string | number; danger?: boolean }) {
  return (
    <div style={{ background: danger ? "var(--red-bg)" : "var(--surface-2)", borderRadius: 8, padding: "10px 14px", minWidth: 100 }}>
      <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: danger ? "var(--red)" : "var(--text)" }}>{value}</div>
    </div>
  );
}

function AlarmRow({ alarm, onAck, onResolve }: {
  alarm: { id: number; alarmType: string; severity: string; status: string; title: string; triggeredAt: Date; acknowledgedBy: { name: string } | null };
  onAck: (id: number) => void;
  onResolve: (id: number) => void;
}) {
  const [pending, startT] = useTransition();
  const severityColor = alarm.severity === "CRITICAL" ? "var(--red)" : alarm.severity === "WARNING" ? "var(--amber)" : "var(--blue)";
  const severityBg = alarm.severity === "CRITICAL" ? "var(--red-bg)" : alarm.severity === "WARNING" ? "var(--amber-bg)" : "var(--blue-bg)";
  const statusLabel = alarm.status === "ACTIVE" ? "Active" : alarm.status === "ACKNOWLEDGED" ? "Ack" : "Resolved";

  return (
    <tr style={{ borderBottom: "1px solid var(--border)" }}>
      <td style={{ padding: "10px 8px" }}>
        <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: severityBg, color: severityColor, fontWeight: 700 }}>{alarm.severity}</span>
      </td>
      <td style={{ padding: "10px 8px", fontSize: 12, color: "var(--text)" }}>{alarm.title}</td>
      <td style={{ padding: "10px 8px", fontSize: 11, color: "var(--text-3)" }}>
        {new Date(alarm.triggeredAt).toLocaleString()}
      </td>
      <td style={{ padding: "10px 8px", fontSize: 11, color: "var(--text-2)" }}>{statusLabel}</td>
      <td style={{ padding: "10px 8px" }}>
        {alarm.status === "ACTIVE" && (
          <button
            disabled={pending}
            onClick={() => startT(async () => { await acknowledgeAlarm(alarm.id); onAck(alarm.id); })}
            style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, border: "1px solid var(--border)", cursor: "pointer", background: "var(--amber-bg)", color: "var(--amber)", fontWeight: 600 }}
          >
            Ack
          </button>
        )}
        {alarm.status === "ACKNOWLEDGED" && (
          <button
            disabled={pending}
            onClick={() => startT(async () => { await resolveAlarm(alarm.id); onResolve(alarm.id); })}
            style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, border: "1px solid var(--border)", cursor: "pointer", background: "var(--green-bg)", color: "var(--green)", fontWeight: 600 }}
          >
            Resolve
          </button>
        )}
      </td>
    </tr>
  );
}

export default function MachineDetail({ data }: Props) {
  const { machine, runtimeLogs, alarmHistory, maintenanceHistory, oeeRecords } = data;
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);
  useEffect(() => { const t = setInterval(refresh, 5000); return () => clearInterval(t); }, [refresh]);

  const m = machine;
  const metric = m.metric;
  const isRunning = metric?.isRunning ?? false;
  const statusColor = m.status === "OFFLINE" ? "var(--red)" : m.status === "UNDER_MAINTENANCE" ? "var(--amber)" : isRunning ? "var(--green)" : "var(--text-2)";
  const statusLabel = m.status === "OFFLINE" ? "Offline" : m.status === "UNDER_MAINTENANCE" ? "Under Maintenance" : isRunning ? "Running" : "Stopped";

  const activeAlarms = alarmHistory.filter(a => a.status === "ACTIVE" || a.status === "ACKNOWLEDGED");

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1200, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 4 }}>
            <Link href="/factory" style={{ color: "var(--steel)", textDecoration: "none" }}>Factory</Link>
            {" / "}
            <Link href="/factory/machines" style={{ color: "var(--steel)", textDecoration: "none" }}>Machines</Link>
            {" / "}
            {m.code}
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", margin: 0 }}>{m.code} — {m.name}</h1>
          <div style={{ display: "flex", gap: 10, marginTop: 6, alignItems: "center" }}>
            <span style={{ fontSize: 13, color: statusColor, fontWeight: 700 }}>● {statusLabel}</span>
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>·</span>
            <span style={{ fontSize: 12, color: "var(--text-2)" }}>{m.factoryArea?.name ?? "—"}</span>
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>·</span>
            <span style={{ fontSize: 12, color: "var(--text-2)" }}>{m.type}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {metric?.updatedAt && (
            <span style={{ fontSize: 12, color: "var(--text-3)", alignSelf: "flex-end" }}>
              Updated {new Date(metric.updatedAt).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>

      {/* Live metrics */}
      <Section title="Live Metrics">
        {metric ? (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <MetricPill label="Speed" value={metric.speedRpm !== null ? `${metric.speedRpm} rpm` : "—"} />
            <MetricPill label="Output Count" value={metric.outputCount} />
            <MetricPill label="Today Output" value={metric.todayOutput} />
            <MetricPill label="Temperature" value={metric.temperature !== null ? `${metric.temperature}°C` : "—"} danger={(metric.temperature ?? 0) > 80} />
            <MetricPill label="Power" value={metric.powerKw !== null ? `${metric.powerKw} kW` : "—"} />
            <MetricPill label="Runtime" value={`${metric.runtimeMin} min`} />
            <MetricPill label="Downtime" value={`${metric.downtimeMin} min`} danger={metric.downtimeMin > 60} />
            {(metric as { operator?: { nameEn: string } }).operator?.nameEn && <MetricPill label="Operator" value={(metric as { operator: { nameEn: string } }).operator.nameEn} />}
            {metric.currentOrder && <MetricPill label="Work Order" value={(metric.currentOrder as { orderCode: string }).orderCode} />}
          </div>
        ) : (
          <div style={{ color: "var(--text-3)", fontSize: 13, padding: 20, textAlign: "center" }}>No live metric data. Connect sensors or enter manually to start tracking.</div>
        )}
      </Section>

      {/* Active alarms */}
      {activeAlarms.length > 0 && (
        <Section title={`Active Alarms (${activeAlarms.length})`}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {["Severity", "Title", "Triggered", "Status", "Action"].map(h => (
                  <th key={h} style={{ padding: "6px 8px", fontSize: 11, color: "var(--text-3)", fontWeight: 600, textAlign: "left" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeAlarms.map(a => (
                <AlarmRow key={a.id} alarm={a as Parameters<typeof AlarmRow>[0]["alarm"]} onAck={refresh} onResolve={refresh} />
              ))}
            </tbody>
          </table>
        </Section>
      )}

      {/* OEE trend */}
      {oeeRecords.length > 0 && (
        <Section title="OEE (Last 30 Days)">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 500 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Date", "Availability", "Performance", "Quality", "OEE", "Output", "Downtime"].map(h => (
                    <th key={h} style={{ padding: "6px 8px", fontSize: 11, color: "var(--text-3)", fontWeight: 600, textAlign: "right", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {oeeRecords.map(r => (
                  <tr key={`${r.machineId}-${r.periodDate}`} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px", fontSize: 12, color: "var(--text-2)" }}>{new Date(r.periodDate).toLocaleDateString()}</td>
                    <td style={{ padding: "8px", fontSize: 12, textAlign: "right", color: "var(--text)" }}>{r.availability}%</td>
                    <td style={{ padding: "8px", fontSize: 12, textAlign: "right", color: "var(--text)" }}>{r.performance}%</td>
                    <td style={{ padding: "8px", fontSize: 12, textAlign: "right", color: "var(--text)" }}>{r.quality}%</td>
                    <td style={{ padding: "8px", fontSize: 12, textAlign: "right", fontWeight: 700, color: r.oee >= 85 ? "var(--green)" : r.oee >= 65 ? "var(--amber)" : "var(--red)" }}>{r.oee}%</td>
                    <td style={{ padding: "8px", fontSize: 12, textAlign: "right", color: "var(--text-2)" }}>{r.actualOutput}</td>
                    <td style={{ padding: "8px", fontSize: 12, textAlign: "right", color: r.downtimeMin > 60 ? "var(--red)" : "var(--text-2)" }}>{r.downtimeMin}m</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Runtime logs */}
      {runtimeLogs.length > 0 && (
        <Section title="Runtime Logs (Last 30 Days)">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Date", "Shift", "Runtime", "Downtime", "Output", "Output kg"].map(h => (
                    <th key={h} style={{ padding: "6px 8px", fontSize: 11, color: "var(--text-3)", fontWeight: 600, textAlign: "right" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {runtimeLogs.map(r => (
                  <tr key={r.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px", fontSize: 12, color: "var(--text-2)" }}>{new Date(r.logDate).toLocaleDateString()}</td>
                    <td style={{ padding: "8px", fontSize: 12, color: "var(--text-2)", textAlign: "right" }}>{r.shiftType ?? "—"}</td>
                    <td style={{ padding: "8px", fontSize: 12, color: "var(--text)", textAlign: "right" }}>{r.runtimeMin}m</td>
                    <td style={{ padding: "8px", fontSize: 12, color: r.downtimeMin > 60 ? "var(--red)" : "var(--text-2)", textAlign: "right" }}>{r.downtimeMin}m</td>
                    <td style={{ padding: "8px", fontSize: 12, color: "var(--text)", textAlign: "right" }}>{r.outputCount}</td>
                    <td style={{ padding: "8px", fontSize: 12, color: "var(--text)", textAlign: "right" }}>{r.outputKg} kg</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* Maintenance history */}
      {maintenanceHistory.length > 0 && (
        <Section title="Recent Maintenance">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {maintenanceHistory.map(l => (
              <div key={l.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                <div style={{ minWidth: 80, fontSize: 12, color: "var(--text-3)" }}>{new Date(l.startedAt).toLocaleDateString()}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 600 }}>{l.type}</div>
                  {l.description && <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 2 }}>{l.description}</div>}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-2)" }}>{l.downtimeMinutes}m downtime</div>
                <div style={{ fontSize: 12, color: "var(--text-3)" }}>{(l.performedBy as { nameEn: string } | null)?.nameEn ?? "—"}</div>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
