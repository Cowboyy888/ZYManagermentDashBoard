import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { listWarehouses, listCategories } from "@/actions/inventory";
import { WarehousesManager } from "./WarehousesManager";

export const metadata: Metadata = { title: "Warehouses" };

export default async function WarehousesPage() {
  const user = await requireUser();
  const [whResult, catResult] = await Promise.all([listWarehouses(), listCategories()]);

  if (!whResult.ok) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Warehouses</h1>
        <div style={{ marginTop: 12, padding: "12px 16px", borderRadius: 8, background: "var(--red-bg)", color: "var(--red)", fontSize: 13 }}>{whResult.error}</div>
      </div>
    );
  }

  const warehouses = whResult.data.map((w) => ({
    id: w.id, code: w.code, name: w.name, description: w.description,
    active: w.active, itemCount: w._count.items, createdAt: w.createdAt.toISOString(),
  }));

  const categories = catResult.ok ? catResult.data.map((c) => ({
    id: c.id, name: c.name, code: c.code, description: c.description, itemCount: c._count.items,
  })) : [];

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Warehouses & Categories</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Manage storage locations and inventory categories</p>
      </div>
      <WarehousesManager
        warehouses={warehouses}
        categories={categories}
        canManage={can(user.role, "inventory.manage")}
      />
    </div>
  );
}
