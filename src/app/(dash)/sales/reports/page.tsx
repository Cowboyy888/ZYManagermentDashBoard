import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { listSalesOrders, listCustomers, listQuotations, listDeliveries } from "@/actions/sales";
import { SalesReports } from "./SalesReports";

export const metadata: Metadata = { title: "Sales Reports" };

export default async function SalesReportsPage() {
  const user = await requireUser();

  const [ordersResult, customersResult, quotResult, delResult] = await Promise.all([
    listSalesOrders({ limit: 1000 }),
    listCustomers({ limit: 500 }),
    listQuotations({ limit: 1000 }),
    listDeliveries({ days: 180 }),
  ]);

  const orders = ordersResult.ok ? ordersResult.data.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    customerName: o.customer.name,
    customerCode: o.customer.customerCode,
    status: o.status as string,
    orderDate: (o.orderDate as Date).toISOString(),
    totalUsd: Number(o.totalUsd),
    paymentStatus: o.paymentStatus,
    items: o.items.map((i) => ({
      description: i.description,
      quantity: Number(i.quantity),
      totalUsd: Number(i.totalUsd),
    })),
  })) : [];

  const customers = customersResult.ok ? customersResult.data.map((c) => ({
    id: c.id,
    name: c.name,
    customerCode: c.customerCode,
    country: c.country,
    status: c.status as string,
    orderCount: c._count.salesOrders,
    quotationCount: c._count.quotations,
  })) : [];

  const quotations = quotResult.ok ? quotResult.data.map((q) => ({
    id: q.id,
    quotationNumber: q.quotationNumber,
    customerName: q.customer.name,
    status: q.status as string,
    totalUsd: Number(q.totalUsd),
    createdAt: q.createdAt.toISOString(),
    validUntil: (q.validUntil as Date).toISOString(),
    hasOrder: q._count.salesOrders > 0,
  })) : [];

  const deliveries = delResult.ok ? delResult.data.map((d) => ({
    id: d.id,
    deliveryNumber: d.deliveryNumber,
    orderNumber: d.order.orderNumber,
    customerName: d.order.customer.name,
    status: d.status as string,
    scheduledDate: (d.scheduledDate as Date).toISOString(),
    deliveredDate: d.deliveredDate ? (d.deliveredDate as Date).toISOString() : null,
  })) : [];

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Sales Reports</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Revenue analysis, customer performance and delivery tracking</p>
      </div>
      <SalesReports
        orders={orders}
        customers={customers}
        quotations={quotations}
        deliveries={deliveries}
        canExport={can(user.role, "report.export")}
      />
    </div>
  );
}
