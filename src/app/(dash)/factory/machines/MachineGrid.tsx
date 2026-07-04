"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Metric = {
  isRunning: boolean; speedRpm: number | null; outputCount: number; todayOutput: number;
  temperature: number | null; powerKw: number | null; runtimeMin: number; downtimeMin: number;
  source: string; updatedAt: Date; operatorName: string | null;
};

type Machine = {
  id: number; code: string; name: string; type: string; status: string;
  capacityKgPerShift: number | null;
  factoryArea: { name: string; code: string } | null;
  metric: Metric | null;
  alarms: { id: number; alarmType: string; severity: string; title: string }[];
  openWorkOrders: { id: number; priority: string; title: string }[];
};

interface Props { machines: Machine[] }

type Filter = "ALL" | "RUNNING" | "STOPPED" | "ALARM" | "OFFLINE" | "MAINTENANCE";

function elapsed(d: Date) {
  const sec = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}

function MachineRow({ m }: { m: Machine }) {
  const isRunning = m.metric?.isRunning ?? false;
  const criticalAlarms = m.alarms.filter(a => a.severity === "CRITICAL");
  const statusLabel = m.status === "OFFLINE" ? "Offline" : m.status === "UNDER_MAINTENANCE" ? "Maintenance" : isRunning ? "Running" : "Stopped";
  const statusColor = m.status === "OFFLINE" ? "var(--red)" : m.status === "UNDER_MAINTENANCE" ? "var(--amber)" : isRunning ? "var(--green)" : "var(--text-3)";
  const statusBg = m.status === "OFFLINE" ? "var(--red-bg)" : m.status === "UNDER_MAINTENANCE" ? "var(--amber-bg)" : isRunning ? "var(--green-bg)" : "var(--surface-2)";

  return (
    <Link href={`/factory/machines/${m.id}`} style={{ display: "contents", textDecoration: "none", color: "inherit" }}>
      <tr style={{ borderBottom: "1px solid var(--border)", cursor: "pointer" }}>
        <td style={{ padding: "12px 14px", fontWeight: 700, fontSize: 13, color: "var(--text)" }}>{m.code}</td>
        <td style={{ padding: "12px 8px", fontSize: 12, color: "var(--text-2)" }}>{m.name}</td>
        <td style={{ padding: "12px 8px", fontSize: 12, color: "var(--text-2)" }}>{m.factoryArea?.name ?? "—"}</td>
        <td style={{ padding: "12px 8px" }}>
          <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 5, background: statusBg, color: statusColor }}>{statusLabel}</span>
        </td>
        <td style={{ padding: "12px 8px", fontSize: 12, color: "var(--text)", fontWeight: 600, textAlign: "right" }}>
          {m.metric?.todayOutput ?? 0}
          {m.capacityKgPerShift && <span style={{ fontWeight: 400, color: "var(--text-3)" }}> / {m.capacityKgPerShift}</span>}
        </td>
        <td style={{ padding: "12px 8px", fontSize: 12, color: "var(--text-2)", textAlign: "right" }}>
          {m.metric?.speedRpm !== null && m.metric?.speedRpm !== undefined ? `${m.metric.speedRpm} rpm` : "—"}
        </td>
        <td style={{ padding: "12px 8px", fontSize: 12, textAlign: "right", color: (m.metric?.temperature ?? 0) > 80 ? "var(--red)" : "var(--text-2)" }}>
          {m.metric?.temperature !== null && m.metric?.temperature !== undefined ? `${m.metric.temperature}°C` : "—"}
        </td>
        <td style={{ padding: "12px 8px", fontSize: 12, color: "var(--text-2)", textAlign: "right" }}>
          {m.metric?.powerKw !== null && m.metric?.powerKw !== undefined ? `${m.metric.powerKw} kW` : "—"}
        </td>
        <td style={{ padding: "12px 8px", fontSize: 12, color: "var(--text-2)", textAlign: "right" }}>
          {m.metric?.runtimeMin ?? 0}m / {m.metric?.downtimeMin ?? 0}m
        </td>
        <td style={{ padding: "12px 8px", textAlign: "right" }}>
          {criticalAlarms.length > 0 && (
            <span style={{ fontSize: 11, background: "var(--red-bg)", color: "var(--red)", borderRadius: 4, padding: "2px 6px", fontWeight: 600 }}>
              {criticalAlarms.length} crit.
            </span>
          )}
          {criticalAlarms.length === 0 && m.alarms.length > 0 && (
            <span style={{ fontSize: 11, background: "var(--amber-bg)", color: "var(--amber)", borderRadius: 4, padding: "2px 6px", fontWeight: 600 }}>
              {m.alarms.length} warn
            </span>
          )}
        </td>
        <td style={{ padding: "12px 8px", fontSize: 11, color: "var(--text-3)", textAlign: "right" }}>
          {m.metric?.updatedAt ? elapsed(m.metric.updatedAt) : "No data"}
        </td>
      </tr>
    </Link>
  );
}

export default function MachineGrid({ machines }: Props) {
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);
  useEffect(() => { const t = setInterval(refresh, 5000); return () => clearInterval(t); }, [refresh]);

  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");

  const filtered = machines.filter(m => {
    const q = search.toLowerCase();
    const matchSearch = !q || m.code.toLowerCase().includes(q) || m.name.toLowerCase().includes(q) || (m.factoryArea?.name.toLowerCase().includes(q) ?? false);
    const matchFilter =
      filter === "ALL" ? true :
      filter === "RUNNING" ? (m.metric?.isRunning ?? false) :
      filter === "STOPPED" ? (!m.metric?.isRunning && m.status === "OPERATIONAL") :
      filter === "ALARM" ? m.alarms.length > 0 :
      filter === "OFFLINE" ? m.status === "OFFLINE" :
      filter === "MAINTENANCE" ? m.status === "UNDER_MAINTENANCE" : true;
    return matchSearch && matchFilter;
  });

  const runCount = machines.filter(m => m.metric?.isRunning).length;
  const alarmCount = machines.filter(m => m.alarms.length > 0).length;

  const filterBtn = (f: Filter, label: string, count?: number) => (
    <button
      key={f}
      onClick={() => setFilter(f)}
      style={{
        padding: "6px 14px", borderRadius: 7, border: "1px solid var(--border)", cursor: "pointer", fontSize: 12, fontWeight: 600,
        background: filter === f ? "var(--steel)" : "var(--surface)",
        color: filter === f ? "#fff" : "var(--text-2)",
      }}
    >
      {label}{count !== undefined ? ` (${count})` : ""}
    </button>
  );

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", margin: 0 }}>Machine Monitoring</h1>
          <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>{runCount} running · {machines.length} total · auto-refresh 5s</div>
        </div>
        <Link href="/factory" style={{ fontSize: 13, color: "var(--text-2)", textDecoration: "none" }}>← Factory Overview</Link>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16, alignItems: "center" }}>
        {filterBtn("ALL", "All", machines.length)}
        {filterBtn("RUNNING", "Running", runCount)}
        {filterBtn("STOPPED", "Stopped")}
        {filterBtn("ALARM", "With Alarms", alarmCount)}
        {filterBtn("OFFLINE", "Offline", machines.filter(m => m.status === "OFFLINE").length)}
        {filterBtn("MAINTENANCE", "Maintenance", machines.filter(m => m.status === "UNDER_MAINTENANCE").length)}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search code, name, area…"
          style={{ marginLeft: "auto", padding: "6px 12px", borderRadius: 7, border: "1px solid var(--border)", fontSize: 13, color: "var(--text)", background: "var(--surface)", width: 220 }}
        />
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
              {["Code", "Name", "Area", "Status", "Output", "Speed", "Temp", "Power", "Runtime/Down", "Alarms", "Updated"].map(h => (
                <th key={h} style={{ padding: "10px 8px", fontSize: 11, color: "var(--text-3)", fontWeight: 600, textAlign: h === "Code" ? "left" : "right", whiteSpace: "nowrap" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(m => <MachineRow key={m.id} m={m} />)}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} style={{ padding: 40, textAlign: "center", color: "var(--text-3)", fontSize: 14 }}>
                  {machines.length === 0 ? "No machines configured." : "No machines match the current filter."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
