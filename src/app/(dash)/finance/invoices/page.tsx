import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { listInvoices } from "@/actions/finance";
import { prisma } from "@/lib/db";
import { InvoicesManager } from "./InvoicesManager";

export const metadata: Metadata = { title: "Customer Invoices" };

export default async function InvoicesPage() {
  const user = await requireUser();

  const [result, customers, salesOrders] = await Promise.all([
    listInvoices({ limit: 400 }),
    prisma.customer.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, customerCode: true },
      orderBy: { name: "asc" },
    }),
    prisma.salesOrder.findMany({
      where: { status: { in: ["CONFIRMED", "IN_PRODUCTION"] } },
      select: { id: true, orderNumber: true, customerId: true, totalUsd: true },
      orderBy: { orderNumber: "desc" },
      take: 200,
    }),
  ]);

  const invoices = result.ok ? result.data.map((i) => ({
    id: i.id,
    invoiceNumber: i.invoiceNumber,
    customerId: i.customerId,
    customerName: i.customer.name,
    customerCode: i.customer.customerCode,
    salesOrderId: i.salesOrderId,
    salesOrderNumber: i.salesOrder?.orderNumber ?? null,
    invoiceDate: (i.invoiceDate as Date).toISOString(),
    dueDate: (i.dueDate as Date).toISOString(),
    status: i.status,
    subtotalUsd: Number(i.subtotalUsd),
    taxUsd: Number(i.taxUsd),
    discountUsd: Number(i.discountUsd),
    totalUsd: Number(i.totalUsd),
    paidUsd: Number(i.paidUsd),
    notes: i.notes,
    paymentCount: i._count.payments,
    items: i.items.map((it) => ({
      id: it.id, description: it.description,
      quantity: Number(it.quantity), unitPriceUsd: Number(it.unitPriceUsd), totalUsd: Number(it.totalUsd),
    })),
    createdAt: i.createdAt.toISOString(),
  })) : [];

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Customer Invoices</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Accounts receivable — create, track and collect customer invoices</p>
      </div>
      <InvoicesManager
        invoices={invoices}
        customers={customers}
        salesOrders={salesOrders.map((s) => ({ id: s.id, orderNumber: s.orderNumber, customerId: s.customerId, totalUsd: Number(s.totalUsd) }))}
        canWrite={can(user.role, "finance.write")}
        canManage={can(user.role, "finance.manage")}
      />
    </div>
  );
}
