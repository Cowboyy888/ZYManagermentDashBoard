import { redirect } from "next/navigation";
import { guard } from "@/lib/auth/session";
import { listAlarms, getActiveAlarmCounts } from "@/actions/factory/alarms";
import AlarmCenter from "./AlarmCenter";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AlarmsPage() {
  try {
    await guard("factory.view");
  } catch {
    redirect("/login");
  }

  const [alarmsRes, countsRes] = await Promise.all([
    listAlarms(),
    getActiveAlarmCounts(),
  ]);

  const alarms = alarmsRes.ok ? alarmsRes.data : [];
  const counts = countsRes.ok ? countsRes.data : { critical: 0, warning: 0, info: 0, total: 0 };

  return <AlarmCenter alarms={alarms} counts={counts} />;
}
