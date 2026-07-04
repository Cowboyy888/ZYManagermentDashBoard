"use client";
import Link from "next/link";
import { IOT_INTEGRATION_NOTE } from "@/lib/iot";

type Device = {
  id: number; deviceCode: string; deviceType: string; protocol: string;
  ipAddress: string | null; port: number | null;
  isActive: boolean; lastSeenAt: Date | null;
  machine: { code: string; name: string } | null;
  factoryArea: { code: string; name: string } | null;
  latestReading: { metricKey: string; value: number; unit: string | null; recordedAt: Date } | null;
  configuredAt: Date;
};

type Summary = { total: number; active: number; offline: number; online: number; byType: { deviceType: string; count: number }[] };

interface Props { devices: Device[]; summary: Summary }

function statusDot(active: boolean, lastSeen: Date | null) {
  const isOnline = active && lastSeen && (Date.now() - new Date(lastSeen).getTime()) < 5 * 60 * 1000;
  const color = !active ? "var(--border)" : isOnline ? "var(--green)" : "var(--red)";
  return <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: color, marginRight: 6 }} />;
}

export default function IoTRegistry({ devices, summary }: Props) {
  return (
    <div style={{ padding: "28px 32px", maxWidth: 1300, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", margin: 0 }}>IoT Device Registry</h1>
          <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Phase 1 — Interface stubs. Hardware connections active in Phase 2.</div>
        </div>
        <Link href="/factory" style={{ fontSize: 13, padding: "8px 14px", borderRadius: 8, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-2)", textDecoration: "none" }}>← Factory</Link>
      </div>

      {/* Phase 1 notice */}
      <div style={{ background: "var(--blue-bg)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 16px", fontSize: 13, color: "var(--blue)" }}>
        ℹ️ {IOT_INTEGRATION_NOTE}
      </div>

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12 }}>
        {[
          { label: "Total Devices", value: summary.total, color: "var(--text)" },
          { label: "Active", value: summary.active, color: "var(--blue)" },
          { label: "Online", value: summary.online, color: "var(--green)" },
          { label: "Offline", value: summary.offline, color: summary.offline > 0 ? "var(--red)" : "var(--text-3)" },
        ].map(c => (
          <div key={c.label} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 16px" }}>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: c.color }}>{c.value}</div>
          </div>
        ))}
        {summary.byType.map(t => (
          <div key={t.deviceType} style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 16px" }}>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4 }}>{t.deviceType}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text)" }}>{t.count}</div>
          </div>
        ))}
      </div>

      {/* Device table */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
              {["Status", "Code", "Type", "Protocol", "IP:Port", "Machine / Area", "Latest Reading", "Configured"].map(h => (
                <th key={h} style={{ padding: "10px 10px", fontSize: 11, color: "var(--text-3)", fontWeight: 600, textAlign: "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {devices.map(d => (
              <tr key={d.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td style={{ padding: "11px 10px" }}>{statusDot(d.isActive, d.lastSeenAt)}</td>
                <td style={{ padding: "11px 10px", fontWeight: 700, fontSize: 13, color: "var(--text)" }}>{d.deviceCode}</td>
                <td style={{ padding: "11px 10px", fontSize: 12, color: "var(--text-2)" }}>{d.deviceType}</td>
                <td style={{ padding: "11px 10px", fontSize: 12, color: "var(--text-2)" }}>{d.protocol}</td>
                <td style={{ padding: "11px 10px", fontSize: 12, color: "var(--text-3)", fontFamily: "monospace" }}>
                  {d.ipAddress ? `${d.ipAddress}${d.port ? `:${d.port}` : ""}` : "—"}
                </td>
                <td style={{ padding: "11px 10px", fontSize: 12, color: "var(--text-2)" }}>
                  {d.machine ? (
                    <Link href={`/factory/machines/${d.machine.code}`} style={{ color: "var(--steel)", textDecoration: "none" }}>{d.machine.code}</Link>
                  ) : d.factoryArea?.name ?? "—"}
                </td>
                <td style={{ padding: "11px 10px", fontSize: 12, color: "var(--text-2)" }}>
                  {d.latestReading
                    ? `${d.latestReading.metricKey}: ${d.latestReading.value}${d.latestReading.unit ? ` ${d.latestReading.unit}` : ""}`
                    : <span style={{ color: "var(--text-3)" }}>No readings</span>}
                </td>
                <td style={{ padding: "11px 10px", fontSize: 11, color: "var(--text-3)" }}>
                  {new Date(d.configuredAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {devices.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: 40, textAlign: "center", color: "var(--text-3)", fontSize: 14 }}>
                  No IoT devices registered yet. Devices will be added in Phase 2 during hardware installation.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
