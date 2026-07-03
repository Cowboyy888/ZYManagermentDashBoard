import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { listStockTransactions, listInventoryItems, listAllWarehouses } from "@/actions/inventory";
import { prisma } from "@/lib/db";
import { TransactionsManager } from "./TransactionsManager";

export const metadata: Metadata = { title: "Stock Transactions" };

export default async function TransactionsPage() {
  const user = await requireUser();

  const [txResult, itemsResult, whResult, orders] = await Promise.all([
    listStockTransactions({ days: 30 }),
    listInventoryItems({ status: "ACTIVE" }),
    listAllWarehouses(),
    prisma.productionOrder.findMany({
      where: { status: "IN_PROGRESS" },
      select: { id: true, orderCode: true },
      orderBy: { orderCode: "asc" },
    }),
  ]);

  if (!txResult.ok) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Stock Transactions</h1>
        <div style={{ marginTop: 12, padding: "12px 16px", borderRadius: 8, background: "var(--red-bg)", color: "var(--red)", fontSize: 13 }}>{txResult.error}</div>
      </div>
    );
  }

  const transactions = txResult.data.map((t) => ({
    id: t.id.toString(),
    type: t.type as string,
    itemId: t.itemId,
    itemCode: t.item.itemCode,
    itemName: t.item.name,
    uom: t.item.unitOfMeasure,
    warehouseCode: t.warehouse?.code ?? null,
    quantity: Number(t.quantity),
    unitCostUsd: t.unitCostUsd !== null ? Number(t.unitCostUsd) : null,
    balanceAfter: t.balanceAfter !== null ? Number(t.balanceAfter) : null,
    refNumber: t.refNumber,
    productionOrderCode: t.productionOrder?.orderCode ?? null,
    note: t.note,
    createdBy: t.createdBy.name,
    createdAt: t.createdAt.toISOString(),
  }));

  const items = itemsResult.ok ? itemsResult.data.map((i) => ({
    id: i.id, itemCode: i.itemCode, name: i.name,
    unitOfMeasure: i.unitOfMeasure, currentStock: Number(i.currentStock),
    warehouseId: i.warehouseId,
  })) : [];

  const warehouses = whResult.ok ? whResult.data.map((w) => ({ id: w.id, code: w.code, name: w.name })) : [];

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Stock Transactions</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Record stock in, out, adjustments, and returns</p>
      </div>
      <TransactionsManager
        transactions={transactions}
        items={items}
        warehouses={warehouses}
        productionOrders={orders}
        canWrite={can(user.role, "inventory.write")}
      />
    </div>
  );
}
