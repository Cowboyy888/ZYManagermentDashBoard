import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { listWireInventory, listMeshInventory } from "@/actions/production";
import { InventoryManager } from "./InventoryManager";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryPage() {
  const user = await requireUser();

  const [wireResult, meshResult] = await Promise.all([
    listWireInventory(),
    listMeshInventory(),
  ]);

  const wire = wireResult.ok
    ? wireResult.data.map((w) => ({
        id: w.id,
        batchCode: w.batchCode,
        wireDiameterMm: Number(w.wireDiameterMm),
        weightKg: Number(w.weightKg),
        remainingKg: Number(w.remainingKg),
        supplier: w.supplier,
        receivedDate: w.receivedDate.toISOString(),
        notes: w.notes,
      }))
    : [];

  const mesh = meshResult.ok
    ? meshResult.data.map((m) => ({
        id: m.id,
        sku: m.sku,
        lengthM: Number(m.lengthM),
        widthM: Number(m.widthM),
        wireDiameterMm: Number(m.wireDiameterMm),
        gridSpacingMm: m.gridSpacingMm,
        qtyInStock: m.qtyInStock,
        unitWeightKg: Number(m.unitWeightKg),
        notes: m.notes,
      }))
    : [];

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Inventory</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Wire stock and rebar mesh finished goods</p>
      </div>
      <InventoryManager
        wire={wire}
        mesh={mesh}
        canWrite={can(user.role, "production.write")}
        canManage={can(user.role, "production.manage")}
      />
    </div>
  );
}
