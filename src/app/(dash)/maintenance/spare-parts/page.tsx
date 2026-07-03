import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { listSparePartUsages } from "@/actions/maintenance";
import { prisma } from "@/lib/db";
import { SparePartsManager } from "./SparePartsManager";

export const metadata: Metadata = { title: "Spare Parts" };

export default async function SparePartsPage() {
  const user = await requireUser();

  const [usageResult, items] = await Promise.all([
    listSparePartUsages({ limit: 500 }),
    prisma.inventoryItem.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true, itemCode: true, name: true, unitOfMeasure: true,
        currentStock: true, minStock: true, unitCostUsd: true,
        warehouse: { select: { id: true, name: true, code: true } },
        _count: { select: { sparePartUsages: true } },
      },
      orderBy: { name: "asc" },
      take: 500,
    }),
  ]);

  const usages = usageResult.ok ? usageResult.data.map((u) => ({
    id: u.id,
    workOrderId: u.workOrderId,
    woNumber: u.workOrder.woNumber,
    woTitle: u.workOrder.title,
    machineCode: u.workOrder.machine.code,
    machineName: u.workOrder.machine.name,
    itemId: u.itemId,
    itemCode: u.item.itemCode ?? "",
    itemName: u.item.name,
    uom: u.item.unitOfMeasure,
    quantityUsed: Number(u.quantityUsed),
    unitCostUsd: u.unitCostUsd !== null ? Number(u.unitCostUsd) : null,
    totalCostUsd: u.totalCostUsd !== null ? Number(u.totalCostUsd) : null,
    notes: u.notes,
    createdAt: u.createdAt.toISOString(),
  })) : [];

  const inventoryItems = items.map((i) => ({
    id: i.id, itemCode: i.itemCode ?? "", name: i.name, unitOfMeasure: i.unitOfMeasure,
    currentStock: Number(i.currentStock), minStock: Number(i.minStock),
    unitCostUsd: i.unitCostUsd ? Number(i.unitCostUsd) : null,
    warehouseName: i.warehouse.name, warehouseCode: i.warehouse.code,
    usageCount: i._count.sparePartUsages,
    isLowStock: Number(i.currentStock) <= Number(i.minStock),
  }));

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Spare Parts</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Inventory items used in maintenance with usage history</p>
      </div>
      <SparePartsManager
        usages={usages}
        inventoryItems={inventoryItems}
        canWrite={can(user.role, "maintenance.write")}
      />
    </div>
  );
}
