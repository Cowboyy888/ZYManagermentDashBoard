import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { listBills } from "@/actions/finance";
import { prisma } from "@/lib/db";
import { BillsManager } from "./BillsManager";

export const metadata: Metadata = { title: "Supplier Bills" };

export default async function BillsPage() {
  const user = await requireUser();

  const [result, suppliers, purchaseOrders] = await Promise.all([
    listBills({ limit: 400 }),
    prisma.supplier.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, supplierCode: true, paymentTerms: true },
      orderBy: { name: "asc" },
    }),
    prisma.purchaseOrder.findMany({
      where: { status: { in: ["APPROVED", "PARTIALLY_RECEIVED", "RECEIVED"] } },
      select: { id: true, poNumber: true, supplierId: true, totalAmountUsd: true },
      orderBy: { poNumber: "desc" },
      take: 200,
    }),
  ]);

  const bills = result.ok ? result.data.map((b) => ({
    id: b.id,
    billNumber: b.billNumber,
    supplierId: b.supplierId,
    supplierName: b.supplier.name,
    supplierCode: b.supplier.supplierCode,
    purchaseOrderId: b.purchaseOrderId,
    poNumber: b.purchaseOrder?.poNumber ?? null,
    billDate: (b.billDate as Date).toISOString(),
    dueDate: (b.dueDate as Date).toISOString(),
    status: b.status,
    subtotalUsd: Number(b.subtotalUsd),
    taxUsd: Number(b.taxUsd),
    totalUsd: Number(b.totalUsd),
    paidUsd: Number(b.paidUsd),
    notes: b.notes,
    paymentCount: b._count.payments,
    createdAt: b.createdAt.toISOString(),
  })) : [];

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Supplier Bills</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Accounts payable — track and pay supplier bills</p>
      </div>
      <BillsManager
        bills={bills}
        suppliers={suppliers}
        purchaseOrders={purchaseOrders.map((p) => ({ id: p.id, poNumber: p.poNumber, supplierId: p.supplierId, totalAmountUsd: Number(p.totalAmountUsd) }))}
        canWrite={can(user.role, "finance.write")}
        canManage={can(user.role, "finance.manage")}
      />
    </div>
  );
}
