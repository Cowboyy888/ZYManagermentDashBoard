import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { listPayments, listInvoices, listBills } from "@/actions/finance";
import { PaymentsManager } from "./PaymentsManager";

export const metadata: Metadata = { title: "Payments" };

export default async function PaymentsPage() {
  const user = await requireUser();

  const [paymentsResult, invoicesResult, billsResult] = await Promise.all([
    listPayments({ limit: 500 }),
    listInvoices({ limit: 300 }),
    listBills({ limit: 300 }),
  ]);

  const payments = paymentsResult.ok ? paymentsResult.data.map((p) => ({
    id: p.id, paymentNumber: p.paymentNumber, type: p.type, method: p.method,
    invoiceId: p.invoiceId, invoiceNumber: p.invoice?.invoiceNumber ?? null,
    customerName: p.invoice?.customer?.name ?? null,
    billId: p.billId, billNumber: p.bill?.billNumber ?? null,
    supplierName: p.bill?.supplier?.name ?? null,
    amountUsd: Number(p.amountUsd),
    paymentDate: (p.paymentDate as Date).toISOString(),
    reference: p.reference, notes: p.notes,
    createdBy: p.createdBy.name, createdAt: p.createdAt.toISOString(),
  })) : [];

  const openInvoices = invoicesResult.ok ? invoicesResult.data
    .filter((i) => !["VOID", "PAID"].includes(i.status))
    .map((i) => ({ id: i.id, invoiceNumber: i.invoiceNumber, customerName: i.customer.name, totalUsd: Number(i.totalUsd), paidUsd: Number(i.paidUsd) })) : [];

  const openBills = billsResult.ok ? billsResult.data
    .filter((b) => !["VOID", "PAID"].includes(b.status))
    .map((b) => ({ id: b.id, billNumber: b.billNumber, supplierName: b.supplier.name, totalUsd: Number(b.totalUsd), paidUsd: Number(b.paidUsd) })) : [];

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Payments</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Record customer receipts and supplier payments</p>
      </div>
      <PaymentsManager
        payments={payments}
        openInvoices={openInvoices}
        openBills={openBills}
        canWrite={can(user.role, "finance.write")}
      />
    </div>
  );
}
