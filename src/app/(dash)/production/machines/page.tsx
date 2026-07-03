import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { listMachines } from "@/actions/production";
import { MachinesManager } from "./MachinesManager";

export const metadata: Metadata = { title: "Machines" };

export default async function MachinesPage() {
  const user = await requireUser();
  const [result, factoryAreas] = await Promise.all([
    listMachines(),
    prisma.factoryArea.findMany({ orderBy: { code: "asc" } }),
  ]);

  if (!result.ok) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Machines</h1>
        <div style={{ marginTop: 12, padding: "12px 16px", borderRadius: 8, background: "var(--red-bg)", color: "var(--red)", fontSize: 13 }}>
          {result.error}
        </div>
      </div>
    );
  }

  const machines = result.data.map((m) => ({
    id: m.id,
    code: m.code,
    name: m.name,
    type: m.type,
    status: m.status as string,
    purchaseDate: m.purchaseDate ? m.purchaseDate.toISOString() : null,
    notes: m.notes,
    factoryArea: m.factoryArea,
    factoryAreaId: m.factoryAreaId,
    createdAt: m.createdAt.toISOString(),
  }));

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Machines</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Machine registry and status</p>
      </div>
      <MachinesManager
        machines={machines}
        factoryAreas={factoryAreas}
        canManage={can(user.role, "production.manage")}
      />
    </div>
  );
}
