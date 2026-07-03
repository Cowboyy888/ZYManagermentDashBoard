import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { listQuotations, listCustomers } from "@/actions/sales";
import { prisma } from "@/lib/db";
import { QuotationsManager } from "./QuotationsManager";

export const metadata: Metadata = { title: "Quotations" };

export default async function QuotationsPage() {
  const user = await requireUser();

  const [quotResult, custResult, items] = await Promise.all([
    listQuotations(),
    listCustomers({ status: "ACTIVE" }),
    prisma.inventoryItem.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, itemCode: true, name: true, unitOfMeasure: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
  ]);

  const quotations = quotResult.ok ? quotResult.data.map((q) => ({
    id: q.id,
    quotationNumber: q.quotationNumber,
    customerId: q.customerId,
    customerName: q.customer.name,
    customerCode: q.customer.customerCode,
    status: q.status as string,
    validUntil: (q.validUntil as Date).toISOString(),
    currency: q.currency,
    subtotalUsd: Number(q.subtotalUsd),
    discountUsd: Number(q.discountUsd),
    taxUsd: Number(q.taxUsd),
    totalUsd: Number(q.totalUsd),
    notes: q.notes,
    termsConditions: q.termsConditions,
    revision: q.revision,
    createdBy: q.createdBy.name,
    approvedBy: q.approvedBy?.name ?? null,
    approvedAt: q.approvedAt?.toISOString() ?? null,
    orderCount: q._count.salesOrders,
    createdAt: q.createdAt.toISOString(),
    items: q.items.map((i) => ({
      id: i.id,
      inventoryItemId: i.inventoryItemId,
      description: i.description,
      specification: i.specification,
      unitOfMeasure: i.unitOfMeasure,
      quantity: Number(i.quantity),
      unitPriceUsd: Number(i.unitPriceUsd),
      discountPct: Number(i.discountPct),
      totalUsd: Number(i.totalUsd),
      sortOrder: i.sortOrder,
    })),
  })) : [];

  const customers = custResult.ok ? custResult.data.map((c) => ({
    id: c.id, name: c.name, customerCode: c.customerCode,
    paymentTerms: c.paymentTerms,
  })) : [];

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Quotations</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Create and manage sales quotations</p>
      </div>
      <QuotationsManager
        quotations={quotations}
        customers={customers}
        inventoryItems={items.map((i) => ({ id: i.id, itemCode: i.itemCode ?? "", name: i.name, unitOfMeasure: i.unitOfMeasure }))}
        canWrite={can(user.role, "sales.write")}
        canApprove={can(user.role, "sales.approve")}
      />
    </div>
  );
}
