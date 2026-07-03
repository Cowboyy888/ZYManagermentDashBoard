import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { listCustomers } from "@/actions/sales";
import { CustomersManager } from "./CustomersManager";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage() {
  const user = await requireUser();
  const result = await listCustomers();

  const customers = result.ok ? result.data.map((c) => ({
    id: c.id,
    customerCode: c.customerCode,
    name: c.name,
    contactPerson: c.contactPerson,
    phone: c.phone,
    email: c.email,
    address: c.address,
    country: c.country,
    taxId: c.taxId,
    paymentTerms: c.paymentTerms,
    creditLimitUsd: c.creditLimitUsd !== null ? Number(c.creditLimitUsd) : null,
    status: c.status as string,
    notes: c.notes,
    quotationCount: c._count.quotations,
    orderCount: c._count.salesOrders,
    createdAt: c.createdAt.toISOString(),
  })) : [];

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Customers</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Manage customer profiles, credit limits and status</p>
      </div>
      <CustomersManager
        customers={customers}
        canManage={can(user.role, "sales.manage")}
      />
    </div>
  );
}
