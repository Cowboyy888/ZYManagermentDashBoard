import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { listInventoryItems, listStockTransactions } from "@/actions/inventory";
import { InventoryReports } from "./InventoryReports";

export const metadata: Metadata = { title: "Inventory Reports" };

export default async function InventoryReportsPage() {
  const user = await requireUser();

  const [itemsResult, txResult] = await Promise.all([
    listInventoryItems(),
    listStockTransactions({ days: 30 }),
  ]);

  const items = itemsResult.ok ? itemsResult.data.map((i) => ({
    id: i.id, itemCode: i.itemCode, name: i.name,
    categoryCode: i.category.code, categoryName: i.category.name,
    warehouseCode: i.warehouse.code, warehouseName: i.warehouse.name,
    unitOfMeasure: i.unitOfMeasure,
    minStock: Number(i.minStock),
    maxStock: i.maxStock !== null ? Number(i.maxStock) : null,
    currentStock: Number(i.currentStock),
    unitCostUsd: i.unitCostUsd !== null ? Number(i.unitCostUsd) : null,
    totalValue: Number(i.currentStock) * Number(i.unitCostUsd ?? 0),
    status: i.status,
  })) : [];

  const transactions = txResult.ok ? txResult.data.map((t) => ({
    id: t.id.toString(),
    type: t.type as string,
    itemCode: t.item.itemCode,
    itemName: t.item.name,
    uom: t.item.unitOfMeasure,
    warehouseCode: t.warehouse?.code ?? null,
    quantity: Number(t.quantity),
    unitCostUsd: t.unitCostUsd !== null ? Number(t.unitCostUsd) : null,
    balanceAfter: t.balanceAfter !== null ? Number(t.balanceAfter) : null,
    refNumber: t.refNumber,
    createdBy: t.createdBy.name,
    createdAt: t.createdAt.toISOString(),
  })) : [];

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Inventory Reports</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Export inventory summaries, stock movements, and valuations</p>
      </div>
      <InventoryReports
        items={items}
        transactions={transactions}
        canExport={can(user.role, "report.export")}
      />
    </div>
  );
}
