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
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Audit Log</h1>
      <AuditLogViewer
        initialLogs={result.logs}
        total={result.total}
        page={result.page}
      />
    </div>
  );
}
