import { redirect } from "next/navigation";
import { guard } from "@/lib/auth/session";
import { getOEEByMachine, getOEETrend } from "@/actions/factory/oee";
import OEEDashboard from "./OEEDashboard";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OEEPage() {
  try {
    await guard("factory.view");
  } catch {
    redirect("/login");
  }

  const [byMachineRes, trendRes] = await Promise.all([
    getOEEByMachine(),
    getOEETrend(undefined, 30),
  ]);

  const byMachine = byMachineRes.ok ? byMachineRes.data : [];
  const trend = trendRes.ok ? trendRes.data : [];

  return <OEEDashboard byMachine={byMachine} trend={trend} />;
}
