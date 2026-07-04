"use client";
import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { acknowledgeAlarm, resolveAlarm, evaluateAndCreateAlarms } from "@/actions/factory/alarms";

type Alarm = {
  id: number; alarmType: string; severity: "INFO" | "WARNING" | "CRITICAL"; status: "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED";
  title: string; description: string | null; notes: string | null;
  triggeredAt: Date; acknowledgedAt: Date | null; resolvedAt: Date | null;
  machineId: number | null;
  machine: { code: string; name: string } | null;
  acknowledgedBy: { name: string } | null;
  resolvedBy: { name: string } | null;
};

type Counts = { critical: number; warning: number; info: number; total: number };

interface Props { alarms: Alarm[]; counts: Counts }

type StatusFilter = "ACTIVE" | "ACKNOWLEDGED" | "RESOLVED" | "ALL";

const SEV_COLOR: Record<string, string> = { CRITICAL: "var(--red)", WARNING: "var(--amber)", INFO: "var(--blue)" };
const SEV_BG: Record<string, string> = { CRITICAL: "var(--red-bg)", WARNING: "var(--amber-bg)", INFO: "var(--blue-bg)" };

function AlarmRow({ alarm, onAction }: { alarm: Alarm; onAction: () => void }) {
  const [pending, start] = useTransition();
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);

  const doAck = () => start(async () => {
    await acknowledgeAlarm(alarm.id, notes || undefined);
    onAction();
    setShowNotes(false);
  });

  const doResolve = () => start(async () => {
    await resolveAlarm(alarm.id, notes || undefined);
    onAction();
    setShowNotes(false);
  });

  return (
    <>
      <tr style={{ borderBottom: "1px solid var(--border)", background: alarm.severity === "CRITICAL" && alarm.status === "ACTIVE" ? "#fff5f5" : "transparent" }}>
        <td style={{ padding: "11px 8px" }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 7px", borderRadius: 5, background: SEV_BG[alarm.severity], color: SEV_COLOR[alarm.severity] }}>
            {alarm.severity}
          </span>
        </td>
        <td style={{ padding: "11px 8px", fontSize: 12, color: "var(--text)", fontWeight: 600 }}>
          {alarm.title}
          {alarm.description && <div style={{ fontWeight: 400, fontSize: 11, color: "var(--text-2)", marginTop: 2 }}>{alarm.description}</div>}
        </td>
        <td style={{ padding: "11px 8px", fontSize: 12, color: "var(--text-2)" }}>
          {alarm.machine ? (
            <Link href={`/factory/machines/${alarm.machineId}`} style={{ color: "var(--steel)", textDecoration: "none", fontWeight: 600 }}>
              {alarm.machine.code}
            </Link>
          ) : "—"}
        </td>
        <td style={{ padding: "11px 8px", fontSize: 11, color: "var(--text-3)" }}>
          {new Date(alarm.triggeredAt).toLocaleString()}
        </td>
        <td style={{ padding: "11px 8px", fontSize: 11 }}>
          <span style={{
            padding: "2px 7px", borderRadius: 4, fontWeight: 600,
            background: alarm.status === "ACTIVE" ? "var(--red-bg)" : alarm.status === "ACKNOWLEDGED" ? "var(--amber-bg)" : "var(--green-bg)",
            color: alarm.status === "ACTIVE" ? "var(--red)" : alarm.status === "ACKNOWLEDGED" ? "var(--amber)" : "var(--green)",
          }}>
            {alarm.status === "ACTIVE" ? "Active" : alarm.status === "ACKNOWLEDGED" ? "Acknowledged" : "Resolved"}
          </span>
          {alarm.acknowledgedBy && <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: 2 }}>by {alarm.acknowledgedBy.name}</div>}
        </td>
        <td style={{ padding: "11px 8px" }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {alarm.status === "ACTIVE" && (
              <button
                disabled={pending}
                onClick={() => setShowNotes(p => !p)}
                style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, border: "1px solid var(--border)", cursor: "pointer", background: "var(--amber-bg)", color: "var(--amber)", fontWeight: 600 }}
              >
                Acknowledge
              </button>
            )}
            {alarm.status === "ACKNOWLEDGED" && (
              <button
                disabled={pending}
                onClick={() => setShowNotes(p => !p)}
                style={{ fontSize: 11, padding: "3px 8px", borderRadius: 5, border: "1px solid var(--border)", cursor: "pointer", background: "var(--green-bg)", color: "var(--green)", fontWeight: 600 }}
              >
                Resolve
              </button>
            )}
          </div>
        </td>
      </tr>
      {showNotes && (
        <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--surface-2)" }}>
          <td colSpan={6} style={{ padding: "8px 14px" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Optional notes…"
                style={{ flex: 1, padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 13, background: "var(--surface)" }}
              />
              {alarm.status === "ACTIVE" && (
                <button
                  disabled={pending}
                  onClick={doAck}
                  style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "var(--amber)", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                >
                  Confirm Ack
                </button>
              )}
              {alarm.status === "ACKNOWLEDGED" && (
                <button
                  disabled={pending}
                  onClick={doResolve}
                  style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "var(--green)", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" }}
                >
                  Confirm Resolve
                </button>
              )}
              <button onClick={() => setShowNotes(false)} style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", fontSize: 12 }}>Cancel</button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function AlarmCenter({ alarms, counts }: Props) {
  const router = useRouter();
  const refresh = useCallback(() => router.refresh(), [router]);
  useEffect(() => { const t = setInterval(refresh, 5000); return () => clearInterval(t); }, [refresh]);

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ACTIVE");
  const [pending, start] = useTransition();

  const doEvaluate = () => start(async () => {
    await evaluateAndCreateAlarms();
    refresh();
  });

  const filtered = alarms.filter(a => statusFilter === "ALL" ? true : a.status === statusFilter);

  const statBtn = (s: StatusFilter, label: string) => (
    <button
      key={s}
      onClick={() => setStatusFilter(s)}
      style={{
        padding: "6px 14px", borderRadius: 7, border: "1px solid var(--border)", cursor: "pointer", fontSize: 12, fontWeight: 600,
        background: statusFilter === s ? "var(--steel)" : "var(--surface)",
        color: statusFilter === s ? "#fff" : "var(--text-2)",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1300, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", margin: 0 }}>Alarm Center</h1>
          <div style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Live · auto-refresh 5s</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            disabled={pending}
            onClick={doEvaluate}
            style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", fontSize: 13, color: "var(--text-2)", fontWeight: 600 }}
          >
            {pending ? "Evaluating…" : "Auto-Evaluate"}
          </button>
          <Link href="/factory" style={{ fontSize: 13, padding: "8px 14px", borderRadius: 8, background: "var(--surface)", border: "1px solid var(--border)", color: "var(--text-2)", textDecoration: "none" }}>← Factory</Link>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Critical", value: counts.critical, bg: "var(--red-bg)", color: "var(--red)" },
          { label: "Warning", value: counts.warning, bg: "var(--amber-bg)", color: "var(--amber)" },
          { label: "Info", value: counts.info, bg: "var(--blue-bg)", color: "var(--blue)" },
          { label: "Total Active", value: counts.total, bg: "var(--surface-2)", color: "var(--text)" },
        ].map(c => (
          <div key={c.label} style={{ background: c.bg, borderRadius: 10, padding: "14px 18px" }}>
            <div style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {statBtn("ACTIVE", "Active")}
        {statBtn("ACKNOWLEDGED", "Acknowledged")}
        {statBtn("RESOLVED", "Resolved (recent)")}
        {statBtn("ALL", "All")}
        <span style={{ marginLeft: "auto", fontSize: 13, color: "var(--text-3)", alignSelf: "center" }}>{filtered.length} alarm{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Table */}
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
              {["Severity", "Title / Description", "Machine", "Triggered At", "Status", "Action"].map(h => (
                <th key={h} style={{ padding: "10px 8px", fontSize: 11, color: "var(--text-3)", fontWeight: 600, textAlign: "left" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(a => (
              <AlarmRow key={a.id} alarm={a as Alarm} onAction={refresh} />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: 40, textAlign: "center", color: "var(--text-3)", fontSize: 14 }}>
                  {statusFilter === "ACTIVE" ? "No active alarms — system is healthy." : "No alarms match the current filter."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
