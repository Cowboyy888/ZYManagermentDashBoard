import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { listWorkExecutions, getShopFloorSummary, listDowntimeEvents } from "@/actions/mes";
import { listMachines } from "@/actions/production";
import { ShopFloorClient } from "./ShopFloorClient";

export const metadata: Metadata = { title: "Shop Floor (MES)" };

export default async function ShopFloorPage() {
  await requireUser();

  const [execRes, summaryRes, dtRes, machinesRes] = await Promise.all([
    listWorkExecutions(),
    getShopFloorSummary(),
    listDowntimeEvents(),
    listMachines(),
  ]);

  return (
    <ShopFloorClient
      executions={execRes.ok ? execRes.data : []}
      summary={summaryRes.ok ? summaryRes.data : { active: 0, queued: 0, completedToday: 0, activeDowntime: 0 }}
      downtimeEvents={dtRes.ok ? dtRes.data : []}
      machines={machinesRes.ok ? machinesRes.data : []}
    />
  );
}
