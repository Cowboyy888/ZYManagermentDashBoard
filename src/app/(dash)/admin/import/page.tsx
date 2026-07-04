import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { ImportDashboard } from "./ImportDashboard";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const user = await requireUser();
  if (!can(user.role, "employee.create")) redirect("/");

  const canImportSales      = can(user.role, "sales.manage");
  const canImportPurchasing = can(user.role, "purchasing.manage");
  const canImportFactory    = can(user.role, "factory.manage");

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", margin: 0, letterSpacing: "-0.02em" }}>
          Data Import
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", margin: "4px 0 0 0" }}>
          Bulk-import master data from CSV files. Download a template, fill it in, then upload.
        </p>
      </div>
      <ImportDashboard
        canImportSales={canImportSales}
        canImportPurchasing={canImportPurchasing}
        canImportFactory={canImportFactory}
      />
    </div>
  );
}
