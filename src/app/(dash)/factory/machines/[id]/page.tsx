import { redirect, notFound } from "next/navigation";
import { guard } from "@/lib/auth/session";
import { getMachineDetail } from "@/actions/factory/machines";
import MachineDetail from "./MachineDetail";

export const dynamic = "force-dynamic";

export default async function MachineDetailPage({ params }: { params: Promise<{ id: string }> }) {
  try {
    await guard("factory.view");
  } catch {
    redirect("/login");
  }

  const { id } = await params;
  const machineId = Number(id);
  if (isNaN(machineId)) notFound();

  const res = await getMachineDetail(machineId);
  if (!res.ok) notFound();

  return <MachineDetail data={res.data} />;
}
