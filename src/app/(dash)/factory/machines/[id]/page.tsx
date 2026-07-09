import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { getMachineDetail } from "@/actions/factory/machines";
import MachineDetail from "./MachineDetail";

export const dynamic = "force-dynamic";

export default async function MachineDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!can(user.role, "factory.view")) {
    return <div style={{ padding: "2rem", color: "var(--text-2)" }}>You do not have permission to view this page.</div>;
  }

  const { id } = await params;
  const machineId = Number(id);
  if (isNaN(machineId)) notFound();

  const res = await getMachineDetail(machineId);
  if (!res.ok) notFound();

  return <MachineDetail data={res.data} />;
}
