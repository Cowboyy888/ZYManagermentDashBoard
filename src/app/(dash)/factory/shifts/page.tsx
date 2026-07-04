import { redirect } from "next/navigation";
import { guard } from "@/lib/auth/session";
import { getTodayShiftSummary, getShiftTrend } from "@/actions/factory/shifts";
import ShiftManager from "./ShiftManager";

export const dynamic = "force-dynamic";

export default async function ShiftsPage() {
  try {
    await guard("factory.view");
  } catch {
    redirect("/login");
  }

  const [todayRes, trendRes] = await Promise.all([
    getTodayShiftSummary(),
    getShiftTrend(14),
  ]);

  const today = todayRes.ok ? todayRes.data : null;
  const trend = trendRes.ok ? trendRes.data : [];

  return <ShiftManager today={today} trend={trend} />;
}
