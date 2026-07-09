import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { getOEEByMachine, getOEETrend } from "@/actions/factory/oee";
import OEEDashboard from "./OEEDashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OEEPage() {
  const user = await requireUser();
  if (!can(user.role, "factory.view")) {
    return <div style={{ padding: "2rem", color: "var(--text-2)" }}>You do not have permission to view this page.</div>;
  }

  const [byMachineRes, trendRes] = await Promise.all([
    getOEEByMachine(),
    getOEETrend(undefined, 30),
  ]);

  const byMachine = byMachineRes.ok ? byMachineRes.data : [];
  const trend = trendRes.ok ? trendRes.data : [];

  return <OEEDashboard byMachine={byMachine} trend={trend} />;
}
