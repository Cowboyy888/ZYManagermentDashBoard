import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { listGoodsReceipts, listPurchaseOrders } from "@/actions/purchasing";
import { listAllWarehouses } from "@/actions/inventory";
import { ReceiptsManager } from "./ReceiptsManager";

export const metadata: Metadata = { title: "Goods Receiving" };

export default async function ReceiptsPage() {
  const user = await requireUser();

  const [grResult, poResult, whResult] = await Promise.all([
    listGoodsReceipts({ days: 60 }),
    listPurchaseOrders({ status: "APPROVED" }),
    listAllWarehouses(),
  ]);

  const receipts = grResult.ok ? grResult.data.map((r) => ({
    id: r.id.toString(), receiptNumber: r.receiptNumber,
    poId: r.poId, poNumber: r.po.poNumber, supplierName: r.po.supplier.name,
    warehouseCode: r.warehouse.code, warehouseName: r.warehouse.name,
    status: r.status, receivedBy: r.receivedBy.name,
    receivedDate: r.receivedDate.toISOString(),
    notes: r.notes,
    items: r.items.map((i) => ({
      poItemDescription: i.poItem.description,
      poItemQty: Number(i.poItem.quantity),
      uom: i.poItem.unitOfMeasure,
      receivedQty: Number(i.receivedQty),
      rejectedQty: Number(i.rejectedQty),
      notes: i.notes,
    })),
    createdAt: r.createdAt.toISOString(),
  })) : [];

  // Orders that can receive: APPROVED or PARTIALLY_RECEIVED
  const poPartial = await listPurchaseOrders({ status: "PARTIALLY_RECEIVED" });
  const receivablePOs = [
    ...(poResult.ok ? poResult.data : []),
    ...(poPartial.ok ? poPartial.data : []),
  ].map((po) => ({
    id: po.id, poNumber: po.poNumber,
    supplierName: po.supplier.name, status: po.status as string,
    warehouseId: po.warehouse?.id ?? null,
    items: po.items.map((i) => ({
      id: i.id, description: i.description, unitOfMeasure: i.unitOfMeasure,
      quantity: Number(i.quantity), receivedQty: Number(i.receivedQty),
      inventoryItemId: i.inventoryItemId,
    })),
  }));

  const warehouses = whResult.ok ? whResult.data.filter((w) => w.active).map((w) => ({ id: w.id, code: w.code, name: w.name })) : [];

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Goods Receiving</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Record deliveries, update inventory and track receipts</p>
      </div>
      <ReceiptsManager
        receipts={receipts}
        receivablePOs={receivablePOs}
        warehouses={warehouses}
        canWrite={can(user.role, "purchasing.write")}
      />
    </div>
  );
}
