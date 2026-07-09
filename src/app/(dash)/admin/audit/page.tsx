import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { getAuditLogs } from "@/actions/auditLog";
import AuditLogViewer from "./AuditLogViewer";

export const dynamic = "force-dynamic";

export default async function AuditLogPage() {
  const user = await requireUser();
  if (!can(user.role, "audit.view")) redirect("/");

  const result = await getAuditLogs({ page: 1 });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      <h1 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Audit Log</h1>
      <AuditLogViewer
        initialLogs={result.logs}
        total={result.total}
        page={result.page}
      />
    </div>
  );
}
