import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { listAlarms, getActiveAlarmCounts } from "@/actions/factory/alarms";
import AlarmCenter from "./AlarmCenter";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AlarmsPage() {
  const user = await requireUser();
  if (!can(user.role, "factory.view")) {
    return <div style={{ padding: "2rem", color: "var(--text-2)" }}>You do not have permission to view this page.</div>;
  }

  const [alarmsRes, countsRes] = await Promise.all([
    listAlarms(),
    getActiveAlarmCounts(),
  ]);

  const alarms = alarmsRes.ok ? alarmsRes.data : [];
  const counts = countsRes.ok ? countsRes.data : { critical: 0, warning: 0, info: 0, total: 0 };

  return <AlarmCenter alarms={alarms} counts={counts} />;
}
