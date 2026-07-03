import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { getFinancialReportData } from "@/actions/finance";
import { FinancialReports } from "./FinancialReports";

export const metadata: Metadata = { title: "Financial Reports" };

export default async function FinancialReportsPage() {
  const user = await requireUser();
  const result = await getFinancialReportData({ days: 180 });

  const data = result.ok ? result.data : { invoices: [], bills: [], expenses: [], payrollRuns: [], arAging: { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 }, apAging: { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 } };

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Financial Reports</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>P&amp;L, cash flow, AR/AP aging and expense breakdown (last 180 days)</p>
      </div>
      <FinancialReports
        invoices={data.invoices}
        bills={data.bills}
        expenses={data.expenses}
        payrollRuns={data.payrollRuns}
        arAging={data.arAging}
        apAging={data.apAging}
        canExport={can(user.role, "report.export")}
      />
    </div>
  );
}
