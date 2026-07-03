import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { getAlerts } from "@/actions/bi";
import { AlertsCenter } from "./AlertsCenter";

export const metadata: Metadata = { title: "Alerts Center" };

export default async function AlertsPage() {
  const user = await requireUser();
  if (!can(user.role, "bi.read")) return <div style={{ padding: 24, color: "var(--red)" }}>Access denied.</div>;

  const result = await getAlerts();
  const data = result.ok ? result.data : null;

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Alerts Center</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>System-wide alerts — overdue payments, low inventory, machine downtime and more</p>
      </div>
      {!data ? (
        <div style={{ padding: "12px 16px", borderRadius: 8, background: "var(--red-bg)", color: "var(--red)", fontSize: 13 }}>
          {"error" in result ? result.error : "Failed to load data"}
        </div>
      ) : <AlertsCenter data={data} />}
    </div>
  );
}
