import { redirect } from "next/navigation";
import { guard } from "@/lib/auth/session";
import { getFactoryOverview, getFactoryAreaBreakdown } from "@/actions/factory/overview";
import { getActiveAlarmCounts } from "@/actions/factory/alarms";
import { getCurrentShiftProgress } from "@/actions/factory/shifts";
import FactoryOverviewClient from "./FactoryOverviewClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function FactoryPage() {
  try {
    await guard("factory.view");
  } catch {
    redirect("/login");
  }

  const [overviewRes, areasRes, alarmsRes, shiftRes] = await Promise.all([
    getFactoryOverview(),
    getFactoryAreaBreakdown(),
    getActiveAlarmCounts(),
    getCurrentShiftProgress(),
  ]);

  const overview = overviewRes.ok ? overviewRes.data : null;
  const areas = areasRes.ok ? areasRes.data : [];
  const alarms = alarmsRes.ok ? alarmsRes.data : { critical: 0, warning: 0, info: 0, total: 0 };
  const shift = shiftRes.ok ? shiftRes.data : null;

  return <FactoryOverviewClient overview={overview} areas={areas} alarms={alarms} shift={shift} />;
}
