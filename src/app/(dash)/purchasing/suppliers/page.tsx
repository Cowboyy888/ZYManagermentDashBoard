import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { listSuppliers } from "@/actions/purchasing";
import { SuppliersManager } from "./SuppliersManager";

export const metadata: Metadata = { title: "Suppliers" };

export default async function SuppliersPage() {
  const user = await requireUser();
  const result = await listSuppliers();

  const suppliers = result.ok ? result.data.map((s) => ({
    id: s.id, supplierCode: s.supplierCode, name: s.name,
    contactPerson: s.contactPerson, phone: s.phone, email: s.email,
    address: s.address, taxId: s.taxId, paymentTerms: s.paymentTerms,
    currency: s.currency, status: s.status as string, notes: s.notes,
    orderCount: s._count.purchaseOrders,
    createdAt: s.createdAt.toISOString(),
  })) : [];

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Suppliers</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Manage supplier profiles, contacts and status</p>
      </div>
      <SuppliersManager
        suppliers={suppliers}
        canManage={can(user.role, "purchasing.manage")}
      />
    </div>
  );
}
