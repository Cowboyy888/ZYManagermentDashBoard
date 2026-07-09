import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { getMachineMetrics } from "@/actions/factory/machines";
import MachineGrid from "./MachineGrid";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MachinesPage() {
  const user = await requireUser();
  if (!can(user.role, "factory.view")) {
    return <div style={{ padding: "2rem", color: "var(--text-2)" }}>You do not have permission to view this page.</div>;
  }

  const res = await getMachineMetrics();
  const machines = res.ok ? res.data : [];

  return <MachineGrid machines={machines} />;
}
