import { redirect } from "next/navigation";
import { guard } from "@/lib/auth/session";
import { getMachineMetrics } from "@/actions/factory/machines";
import MachineGrid from "./MachineGrid";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function MachinesPage() {
  try {
    await guard("factory.view");
  } catch {
    redirect("/login");
  }

  const res = await getMachineMetrics();
  const machines = res.ok ? res.data : [];

  return <MachineGrid machines={machines} />;
}
