import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { listQualityChecks, listProductionOrders, listMeshInventory } from "@/actions/production";
import { QualityManager } from "./QualityManager";

export const metadata: Metadata = { title: "Quality Control" };

export default async function QualityPage() {
  const user = await requireUser();

  const [checksResult, ordersResult, meshResult, employees] = await Promise.all([
    listQualityChecks(),
    listProductionOrders(),
    listMeshInventory(),
    prisma.employee.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, nameEn: true },
      orderBy: { nameEn: "asc" },
    }),
  ]);

  if (!checksResult.ok) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Quality Control</h1>
        <div style={{ marginTop: 12, padding: "12px 16px", borderRadius: 8, background: "var(--red-bg)", color: "var(--red)", fontSize: 13 }}>
          {checksResult.error}
        </div>
      </div>
    );
  }

  const checks = checksResult.data.map((c) => ({
    id: c.id.toString(),
    checkDate: c.checkDate.toISOString(),
    meshSku: c.meshSku,
    sampleSize: c.sampleSize,
    defectCount: c.defectCount,
    result: c.result as string,
    notes: c.notes,
    order: c.order,
    inspectedBy: c.inspectedBy,
    createdAt: c.createdAt.toISOString(),
  }));

  const orders = ordersResult.ok
    ? ordersResult.data.map((o) => ({ id: o.id, orderCode: o.orderCode }))
    : [];

  const meshSkus = meshResult.ok ? meshResult.data.map((m) => m.sku) : [];

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Quality Control</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Inspection records and pass/fail tracking</p>
      </div>
      <QualityManager
        checks={checks}
        orders={orders}
        meshSkus={meshSkus}
        employees={employees}
        canWrite={can(user.role, "production.write")}
      />
    </div>
  );
}
