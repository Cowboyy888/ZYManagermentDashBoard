import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { listInspections } from "@/actions/quality";
import { prisma } from "@/lib/db";
import { InspectionsManager } from "./InspectionsManager";

export const metadata: Metadata = { title: "Quality Inspections" };

export default async function InspectionsPage() {
  const user = await requireUser();

  const [result, employees, productionOrders, inventoryItems, salesOrders] = await Promise.all([
    listInspections({ limit: 300 }),
    prisma.employee.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, nameEn: true },
      orderBy: { nameEn: "asc" },
    }),
    prisma.productionOrder.findMany({
      where: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
      select: { id: true, orderCode: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.inventoryItem.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, itemCode: true, name: true },
      orderBy: { name: "asc" },
      take: 300,
    }),
    prisma.salesOrder.findMany({
      where: { status: { notIn: ["DELIVERED", "CANCELLED"] } },
      select: { id: true, orderNumber: true, customer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  const inspections = result.ok ? result.data.map((i) => ({
    id: i.id,
    inspectionNumber: i.inspectionNumber,
    type: i.type as string,
    status: i.status as string,
    productionOrderId: i.productionOrderId,
    inventoryItemId: i.inventoryItemId,
    salesOrderId: i.salesOrderId,
    batchNumber: i.batchNumber,
    productDescription: i.productDescription,
    sampleSize: i.sampleSize,
    defectCount: i.defectCount,
    result: i.result as string | null,
    inspectorId: i.inspectorId,
    inspectorName: i.inspector?.nameEn ?? null,
    inspectionDate: (i.inspectionDate as Date).toISOString(),
    remarks: i.remarks,
    orderCode: i.productionOrder?.orderCode ?? null,
    inventoryItemName: i.inventoryItem?.name ?? null,
    salesOrderNumber: i.salesOrder?.orderNumber ?? null,
    ncrCount: i._count.nonConformances,
    testResults: i.testResults.map((t) => ({
      id: t.id,
      parameter: t.parameter,
      unit: t.unit,
      specMin: t.specMin !== null ? Number(t.specMin) : null,
      specMax: t.specMax !== null ? Number(t.specMax) : null,
      measuredValue: t.measuredValue !== null ? Number(t.measuredValue) : null,
      result: t.result as string | null,
      notes: t.notes,
    })),
    createdAt: i.createdAt.toISOString(),
  })) : [];

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Inspections</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Incoming, in-process and final product inspections</p>
      </div>
      <InspectionsManager
        inspections={inspections}
        employees={employees}
        productionOrders={productionOrders}
        inventoryItems={inventoryItems.map((i) => ({ id: i.id, itemCode: i.itemCode ?? "", name: i.name }))}
        salesOrders={salesOrders.map((o) => ({ id: o.id, orderNumber: o.orderNumber, customerName: o.customer.name }))}
        canWrite={can(user.role, "quality.write")}
        canApprove={can(user.role, "quality.approve")}
      />
    </div>
  );
}
