import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { getTodayShiftSummary, getShiftTrend } from "@/actions/factory/shifts";
import ShiftManager from "./ShiftManager";

export const dynamic = "force-dynamic";

export default async function ShiftsPage() {
  const user = await requireUser();
  if (!can(user.role, "factory.view")) {
    return <div style={{ padding: "2rem", color: "var(--text-2)" }}>You do not have permission to view this page.</div>;
  }

  const [todayRes, trendRes] = await Promise.all([
    getTodayShiftSummary(),
    getShiftTrend(14),
  ]);

  const today = todayRes.ok ? todayRes.data : null;
  const trend = trendRes.ok ? trendRes.data : [];

  return <ShiftManager today={today} trend={trend} />;
}
