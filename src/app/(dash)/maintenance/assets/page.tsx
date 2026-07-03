import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { listAssets } from "@/actions/maintenance";
import { prisma } from "@/lib/db";
import { AssetsManager } from "./AssetsManager";

export const metadata: Metadata = { title: "Asset Management" };

export default async function AssetsPage() {
  const user = await requireUser();

  const [result, employees, factoryAreas] = await Promise.all([
    listAssets({ limit: 500 }),
    prisma.employee.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, nameEn: true },
      orderBy: { nameEn: "asc" },
    }),
    prisma.factoryArea.findMany({
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const assets = result.ok ? result.data.map((m) => ({
    id: m.id, code: m.code, name: m.name, type: m.type,
    status: m.status as string,
    factoryAreaId: m.factoryAreaId, factoryAreaName: m.factoryArea?.name ?? null,
    brand: m.brand, machineModel: m.machineModel, serialNumber: m.serialNumber,
    capacityKgPerShift: m.capacityKgPerShift !== null ? Number(m.capacityKgPerShift) : null,
    purchaseDate: m.purchaseDate ? (m.purchaseDate as Date).toISOString() : null,
    installationDate: m.installationDate ? (m.installationDate as Date).toISOString() : null,
    warrantyExpiry: m.warrantyExpiry ? (m.warrantyExpiry as Date).toISOString() : null,
    assignedTechnicianId: m.assignedTechnicianId,
    assignedTechnicianName: m.assignedTechnician?.nameEn ?? null,
    notes: m.notes,
    workOrderCount: m._count.workOrders,
    scheduleCount: m._count.maintenanceSchedules,
    createdAt: m.createdAt.toISOString(),
  })) : [];

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Asset Management</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Factory equipment register, lifecycle and status</p>
      </div>
      <AssetsManager
        assets={assets}
        employees={employees}
        factoryAreas={factoryAreas}
        canManage={can(user.role, "maintenance.manage")}
        canWrite={can(user.role, "maintenance.write")}
      />
    </div>
  );
}
