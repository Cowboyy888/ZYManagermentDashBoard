import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { listInventoryItems, listCategories, listAllWarehouses } from "@/actions/inventory";
import { ItemsManager } from "./ItemsManager";

export const metadata: Metadata = { title: "Inventory Items" };

export default async function ItemsPage() {
  const user = await requireUser();

  const [itemsResult, catResult, whResult] = await Promise.all([
    listInventoryItems(),
    listCategories(),
    listAllWarehouses(),
  ]);

  if (!itemsResult.ok) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Inventory Items</h1>
        <div style={{ marginTop: 12, padding: "12px 16px", borderRadius: 8, background: "var(--red-bg)", color: "var(--red)", fontSize: 13 }}>{itemsResult.error}</div>
      </div>
    );
  }

  const items = itemsResult.data.map((i) => ({
    id: i.id,
    itemCode: i.itemCode,
    name: i.name,
    categoryId: i.categoryId,
    categoryName: i.category.name,
    categoryCode: i.category.code,
    warehouseId: i.warehouseId,
    warehouseCode: i.warehouse.code,
    warehouseName: i.warehouse.name,
    unitOfMeasure: i.unitOfMeasure,
    specification: i.specification,
    minStock: Number(i.minStock),
    maxStock: i.maxStock !== null ? Number(i.maxStock) : null,
    currentStock: Number(i.currentStock),
    unitCostUsd: i.unitCostUsd !== null ? Number(i.unitCostUsd) : null,
    status: i.status,
    notes: i.notes,
    updatedAt: i.updatedAt.toISOString(),
  }));

  const categories = catResult.ok ? catResult.data.map((c) => ({ id: c.id, name: c.name, code: c.code })) : [];
  const warehouses = whResult.ok ? whResult.data.map((w) => ({ id: w.id, name: w.name, code: w.code })) : [];

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Item Master</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>All inventory items, stock levels, and valuation</p>
      </div>
      <ItemsManager
        items={items}
        categories={categories}
        warehouses={warehouses}
        canManage={can(user.role, "inventory.manage")}
        canWrite={can(user.role, "inventory.write")}
      />
    </div>
  );
}
