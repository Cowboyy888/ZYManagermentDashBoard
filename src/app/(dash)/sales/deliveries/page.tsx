import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { listDeliveries, listSalesOrders } from "@/actions/sales";
import { DeliveriesManager } from "./DeliveriesManager";

export const metadata: Metadata = { title: "Deliveries" };

export default async function DeliveriesPage() {
  const user = await requireUser();

  const [delResult, ordResult] = await Promise.all([
    listDeliveries(),
    listSalesOrders({ status: "CONFIRMED" }),
  ]);

  const deliveries = delResult.ok ? delResult.data.map((d) => ({
    id: d.id,
    deliveryNumber: d.deliveryNumber,
    orderId: d.orderId,
    orderNumber: d.order.orderNumber,
    customerName: d.order.customer.name,
    status: d.status as string,
    scheduledDate: (d.scheduledDate as Date).toISOString(),
    deliveredDate: d.deliveredDate ? (d.deliveredDate as Date).toISOString() : null,
    carrier: d.carrier,
    trackingNumber: d.trackingNumber,
    notes: d.notes,
    createdBy: d.createdBy.name,
    createdAt: d.createdAt.toISOString(),
    items: d.items.map((i) => ({
      id: i.id,
      orderItemId: i.orderItemId,
      inventoryItemId: i.inventoryItemId,
      description: i.orderItem?.description ?? "",
      unitOfMeasure: i.orderItem?.unitOfMeasure ?? "",
      quantity: Number(i.quantity),
    })),
  })) : [];

  // Orders eligible to create deliveries from (CONFIRMED, IN_PRODUCTION, READY)
  const allOrdersResult = await listSalesOrders({ status: "CONFIRMED" });
  const readyOrders = allOrdersResult.ok ? allOrdersResult.data
    .filter((o) => ["CONFIRMED", "IN_PRODUCTION", "READY"].includes(o.status))
    .map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customer.name,
      items: o.items.map((i) => ({
        id: i.id,
        inventoryItemId: i.inventoryItemId,
        description: i.description,
        unitOfMeasure: i.unitOfMeasure,
        quantity: Number(i.quantity),
        deliveredQty: Number(i.deliveredQty),
      })),
    })) : [];

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Deliveries</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Schedule and track outgoing deliveries</p>
      </div>
      <DeliveriesManager
        deliveries={deliveries}
        shipableOrders={readyOrders}
        canWrite={can(user.role, "sales.write")}
      />
    </div>
  );
}
