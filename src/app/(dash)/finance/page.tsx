import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { getFinanceSummary } from "@/actions/finance";
import { FinanceDashboard } from "./FinanceDashboard";

export const metadata: Metadata = { title: "Finance & Accounting" };

export default async function FinancePage() {
  const user = await requireUser();
  const result = await getFinanceSummary();

  if ("error" in result) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Finance & Accounting</h1>
        <div style={{ marginTop: 12, padding: "12px 16px", borderRadius: 8, background: "var(--red-bg)", color: "var(--red)", fontSize: 13 }}>{result.error}</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Finance Dashboard</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Revenue, expenses, accounts receivable and payable</p>
      </div>
      <FinanceDashboard
        summary={result.data}
        canManage={can(user.role, "finance.manage")}
      />
    </div>
  );
}
