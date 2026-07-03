import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { listLeads, listCustomers } from "@/actions/sales";
import { prisma } from "@/lib/db";
import { LeadsManager } from "./LeadsManager";

export const metadata: Metadata = { title: "Sales Leads" };

export default async function LeadsPage() {
  const user = await requireUser();

  const [leadsResult, customersResult, users] = await Promise.all([
    listLeads(),
    listCustomers({ status: "ACTIVE" }),
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const leads = leadsResult.ok ? leadsResult.data.map((l) => ({
    id: l.id,
    contactName: l.contactName,
    companyName: l.companyName,
    phone: l.phone,
    email: l.email,
    source: l.source as string,
    stage: l.stage as string,
    productInterest: l.productInterest,
    estimatedValueUsd: l.estimatedValueUsd !== null ? Number(l.estimatedValueUsd) : null,
    assignedToId: l.assignedToId,
    assignedToName: l.assignedTo?.name ?? null,
    customerId: l.customerId,
    customerName: l.customer?.name ?? null,
    notes: l.notes,
    lostReason: l.lostReason,
    createdAt: l.createdAt.toISOString(),
  })) : [];

  const customers = customersResult.ok ? customersResult.data.map((c) => ({
    id: c.id, name: c.name, customerCode: c.customerCode,
  })) : [];

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Sales Leads</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Track leads from first contact to won or lost</p>
      </div>
      <LeadsManager
        leads={leads}
        customers={customers}
        users={users}
        canWrite={can(user.role, "sales.write")}
      />
    </div>
  );
}
