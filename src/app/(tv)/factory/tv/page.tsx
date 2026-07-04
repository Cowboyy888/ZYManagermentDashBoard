import { redirect } from "next/navigation";
import { guard } from "@/lib/auth/session";
import { getFactoryOverview } from "@/actions/factory/overview";
import { getActiveAlarmCounts } from "@/actions/factory/alarms";
import { getCurrentShiftProgress } from "@/actions/factory/shifts";
import TVDashboard from "./TVDashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TVFactoryPage() {
  try {
    await guard("factory.view");
  } catch {
    redirect("/login");
  }

  const [overviewRes, alarmsRes, shiftRes] = await Promise.all([
    getFactoryOverview(),
    getActiveAlarmCounts(),
    getCurrentShiftProgress(),
  ]);

  const overview = overviewRes.ok ? overviewRes.data : null;
  const alarms = alarmsRes.ok ? alarmsRes.data : null;
  const shift = shiftRes.ok ? shiftRes.data : null;

  return <TVDashboard overview={overview} alarms={alarms} shift={shift} />;
}
