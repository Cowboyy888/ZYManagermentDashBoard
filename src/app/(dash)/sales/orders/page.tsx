import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { listSalesOrders, listCustomers } from "@/actions/sales";
import { prisma } from "@/lib/db";
import { SalesOrdersManager } from "./SalesOrdersManager";

export const metadata: Metadata = { title: "Sales Orders" };

export default async function SalesOrdersPage() {
  const user = await requireUser();

  const [ordersResult, custResult, items] = await Promise.all([
    listSalesOrders(),
    listCustomers({ status: "ACTIVE" }),
    prisma.inventoryItem.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, itemCode: true, name: true, unitOfMeasure: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
  ]);

  const orders = ordersResult.ok ? ordersResult.data.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    customerId: o.customerId,
    customerName: o.customer.name,
    customerCode: o.customer.customerCode,
    quotationId: o.quotationId,
    status: o.status as string,
    orderDate: (o.orderDate as Date).toISOString(),
    requestedDelivery: o.requestedDelivery ? (o.requestedDelivery as Date).toISOString() : null,
    currency: o.currency,
    totalUsd: Number(o.totalUsd),
    paymentStatus: o.paymentStatus,
    paymentTerms: o.paymentTerms,
    notes: o.notes,
    createdBy: o.createdBy.name,
    deliveryCount: o._count.deliveries,
    createdAt: o.createdAt.toISOString(),
    items: o.items.map((i) => ({
      id: i.id,
      inventoryItemId: i.inventoryItemId,
      description: i.description,
      unitOfMeasure: i.unitOfMeasure,
      quantity: Number(i.quantity),
      unitPriceUsd: Number(i.unitPriceUsd),
      totalUsd: Number(i.totalUsd),
      deliveredQty: Number(i.deliveredQty),
    })),
  })) : [];

  const customers = custResult.ok ? custResult.data.map((c) => ({
    id: c.id, name: c.name, customerCode: c.customerCode, paymentTerms: c.paymentTerms,
  })) : [];

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Sales Orders</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Manage confirmed sales orders and fulfillment status</p>
      </div>
      <SalesOrdersManager
        orders={orders}
        customers={customers}
        inventoryItems={items.map((i) => ({ id: i.id, itemCode: i.itemCode ?? "", name: i.name, unitOfMeasure: i.unitOfMeasure }))}
        canWrite={can(user.role, "sales.write")}
        canApprove={can(user.role, "sales.approve")}
      />
    </div>
  );
}
