import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { listRequisitions } from "@/actions/purchasing";
import { prisma } from "@/lib/db";
import { RequisitionsManager } from "./RequisitionsManager";

export const metadata: Metadata = { title: "Purchase Requisitions" };

export default async function RequisitionsPage() {
  const user = await requireUser();

  const [prResult, departments, inventoryItems] = await Promise.all([
    listRequisitions(),
    prisma.department.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.inventoryItem.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, itemCode: true, name: true, unitOfMeasure: true },
      orderBy: { itemCode: "asc" },
    }),
  ]);

  const requisitions = prResult.ok ? prResult.data.map((pr) => ({
    id: pr.id, prNumber: pr.prNumber,
    departmentName: pr.department?.name ?? null,
    requestedBy: pr.requestedBy.name,
    approvedBy: pr.approvedBy?.name ?? null,
    status: pr.status as string,
    requiredDate: pr.requiredDate.toISOString(),
    reason: pr.reason, notes: pr.notes,
    itemCount: pr.items.length,
    linkedPOs: pr._count.purchaseOrders,
    items: pr.items.map((i) => ({
      id: i.id, description: i.description, unitOfMeasure: i.unitOfMeasure,
      quantity: Number(i.quantity), estimatedUnitCost: i.estimatedUnitCost !== null ? Number(i.estimatedUnitCost) : null,
      notes: i.notes, inventoryItemId: i.inventoryItemId,
    })),
    createdAt: pr.createdAt.toISOString(),
  })) : [];

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Purchase Requisitions</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Department requests for materials and supplies</p>
      </div>
      <RequisitionsManager
        requisitions={requisitions}
        departments={departments}
        inventoryItems={inventoryItems}
        canWrite={can(user.role, "purchasing.write")}
        canApprove={can(user.role, "purchasing.approve")}
      />
    </div>
  );
}
