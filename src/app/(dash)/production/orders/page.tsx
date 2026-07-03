import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { listProductionOrders, listMachines, listMeshInventory } from "@/actions/production";
import { OrdersManager } from "./OrdersManager";

export const metadata: Metadata = { title: "Production Orders" };

export default async function OrdersPage() {
  const user = await requireUser();

  const [ordersResult, machinesResult, meshResult, supervisors] = await Promise.all([
    listProductionOrders(),
    listMachines(),
    listMeshInventory(),
    prisma.employee.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, nameEn: true },
      orderBy: { nameEn: "asc" },
    }),
  ]);

  if (!ordersResult.ok) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Production Orders</h1>
        <div style={{ marginTop: 12, padding: "12px 16px", borderRadius: 8, background: "var(--red-bg)", color: "var(--red)", fontSize: 13 }}>
          {ordersResult.error}
        </div>
      </div>
    );
  }

  const orders = ordersResult.data.map((o) => ({
    id: o.id,
    orderCode: o.orderCode,
    customer: o.customer,
    priority: o.priority,
    status: o.status as string,
    plannedDate: o.plannedDate.toISOString(),
    completedDate: o.completedDate ? o.completedDate.toISOString() : null,
    notes: o.notes,
    machine: o.machine,
    supervisor: o.supervisor,
    lines: o.lines.map((l) => ({
      id: l.id,
      meshId: l.meshId,
      qtyOrdered: l.qtyOrdered,
      qtyProduced: l.qtyProduced,
      mesh: {
        sku: l.mesh.sku,
        lengthM: Number(l.mesh.lengthM),
        widthM: Number(l.mesh.widthM),
        wireDiameterMm: Number(l.mesh.wireDiameterMm),
        gridSpacingMm: l.mesh.gridSpacingMm,
      },
    })),
    createdAt: o.createdAt.toISOString(),
  }));

  const machines = machinesResult.ok
    ? machinesResult.data.map((m) => ({ id: m.id, code: m.code, name: m.name }))
    : [];

  const meshSkus = meshResult.ok
    ? meshResult.data.map((m) => ({
        id: m.id,
        sku: m.sku,
        lengthM: Number(m.lengthM),
        widthM: Number(m.widthM),
        wireDiameterMm: Number(m.wireDiameterMm),
        gridSpacingMm: m.gridSpacingMm,
        qtyInStock: m.qtyInStock,
      }))
    : [];

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Production Orders</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Create and track work orders</p>
      </div>
      <OrdersManager
        orders={orders}
        machines={machines}
        meshSkus={meshSkus}
        supervisors={supervisors}
        canManage={can(user.role, "production.manage")}
        canWrite={can(user.role, "production.write")}
      />
    </div>
  );
}
