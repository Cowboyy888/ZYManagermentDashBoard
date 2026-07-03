import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { listCertificates, listInspections } from "@/actions/quality";
import { prisma } from "@/lib/db";
import { CertificatesManager } from "./CertificatesManager";

export const metadata: Metadata = { title: "Quality Certificates" };

export default async function CertificatesPage() {
  const user = await requireUser();

  const [certResult, inspResult, customers, salesOrders] = await Promise.all([
    listCertificates({ limit: 300 }),
    listInspections({ status: "COMPLETE", limit: 200 }),
    prisma.customer.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, name: true, customerCode: true },
      orderBy: { name: "asc" },
      take: 300,
    }),
    prisma.salesOrder.findMany({
      where: { status: { notIn: ["CANCELLED"] } },
      select: { id: true, orderNumber: true, customer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  const certs = certResult.ok ? certResult.data.map((c) => ({
    id: c.id,
    certificateNumber: c.certificateNumber,
    type: c.type as string,
    inspectionId: c.inspectionId,
    inspectionNumber: c.inspection?.inspectionNumber ?? null,
    customerId: c.customerId,
    customerName: c.customer?.name ?? null,
    salesOrderId: c.salesOrderId,
    salesOrderNumber: c.salesOrder?.orderNumber ?? null,
    productDescription: c.productDescription,
    batchNumber: c.batchNumber,
    issuedDate: (c.issuedDate as Date).toISOString(),
    validUntil: c.validUntil ? (c.validUntil as Date).toISOString() : null,
    issuedBy: c.issuedBy.name,
    remarks: c.remarks,
    createdAt: c.createdAt.toISOString(),
  })) : [];

  const completedInspections = inspResult.ok ? inspResult.data.map((i) => ({
    id: i.id, inspectionNumber: i.inspectionNumber, type: i.type as string,
  })) : [];

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Quality Certificates</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>COC, test reports and inspection certificates</p>
      </div>
      <CertificatesManager
        certificates={certs}
        completedInspections={completedInspections}
        customers={customers}
        salesOrders={salesOrders.map((o) => ({ id: o.id, orderNumber: o.orderNumber, customerName: o.customer.name }))}
        canWrite={can(user.role, "quality.write")}
      />
    </div>
  );
}
