import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { listProductionPlans, getCapacitySnapshot } from "@/actions/productionPlanning";
import { getShifts } from "@/actions/shifts";
import { listMachines } from "@/actions/production";
import { PlanningClient } from "./PlanningClient";

export const metadata: Metadata = { title: "Production Planning" };

export default async function ProductionPlanningPage() {
  await requireUser();

  const [plansRes, capacityRes, shiftsRes, machinesRes] = await Promise.all([
    listProductionPlans(),
    getCapacitySnapshot(),
    getShifts(),
    listMachines(),
  ]);

  return (
    <PlanningClient
      plans={plansRes.ok ? plansRes.data : []}
      capacity={capacityRes.ok ? capacityRes.data : { machines: 0, shifts: 0, pendingOrders: 0, activePlans: 0 }}
      shifts={shiftsRes.ok ? shiftsRes.data : []}
      machines={machinesRes.ok ? machinesRes.data : []}
    />
  );
}
