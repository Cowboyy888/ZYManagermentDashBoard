import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { listPurchaseOrders, listSuppliers, listRequisitions } from "@/actions/purchasing";
import { listAllWarehouses } from "@/actions/inventory";
import { prisma } from "@/lib/db";
import { OrdersManager } from "./OrdersManager";

export const metadata: Metadata = { title: "Purchase Orders" };

export default async function OrdersPage() {
  const user = await requireUser();

  const [poResult, suppResult, whResult, prResult, inventoryItems] = await Promise.all([
    listPurchaseOrders(),
    listSuppliers({ status: "ACTIVE" }),
    listAllWarehouses(),
    listRequisitions({ status: "APPROVED" }),
    prisma.inventoryItem.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, itemCode: true, name: true, unitOfMeasure: true, unitCostUsd: true },
      orderBy: { itemCode: "asc" },
    }),
  ]);

  const orders = poResult.ok ? poResult.data.map((po) => ({
    id: po.id, poNumber: po.poNumber,
    supplierId: po.supplierId, supplierName: po.supplier.name, supplierCode: po.supplier.supplierCode,
    warehouseCode: po.warehouse?.code ?? null,
    status: po.status as string,
    orderDate: po.orderDate.toISOString(),
    expectedDelivery: po.expectedDelivery?.toISOString() ?? null,
    totalAmountUsd: Number(po.totalAmountUsd), currency: po.currency,
    notes: po.notes, createdBy: po.createdBy.name,
    approvedBy: po.approvedBy?.name ?? null,
    receiptCount: po._count.receipts,
    items: po.items.map((i) => ({
      id: i.id, description: i.description, unitOfMeasure: i.unitOfMeasure,
      quantity: Number(i.quantity), unitPriceUsd: Number(i.unitPriceUsd),
      totalUsd: Number(i.totalUsd), receivedQty: Number(i.receivedQty),
      inventoryItemId: i.inventoryItemId, notes: i.notes,
    })),
    createdAt: po.createdAt.toISOString(),
  })) : [];

  const suppliers = suppResult.ok ? suppResult.data.map((s) => ({ id: s.id, name: s.name, supplierCode: s.supplierCode, currency: s.currency })) : [];
  const warehouses = whResult.ok ? whResult.data.map((w) => ({ id: w.id, code: w.code, name: w.name })) : [];
  const approvedPRs = prResult.ok ? prResult.data.map((pr) => ({ id: pr.id, prNumber: pr.prNumber })) : [];
  const items = inventoryItems.map((i) => ({
    id: i.id, itemCode: i.itemCode, name: i.name,
    unitOfMeasure: i.unitOfMeasure, unitCostUsd: i.unitCostUsd !== null ? Number(i.unitCostUsd) : null,
  }));

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Purchase Orders</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Create, approve and track purchase orders</p>
      </div>
      <OrdersManager
        orders={orders}
        suppliers={suppliers}
        warehouses={warehouses}
        approvedPRs={approvedPRs}
        inventoryItems={items}
        canManage={can(user.role, "purchasing.manage")}
        canApprove={can(user.role, "purchasing.approve")}
      />
    </div>
  );
}
