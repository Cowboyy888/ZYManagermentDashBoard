"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "../lib/db";
import { guard } from "../lib/auth/session";
import { notifyRole } from "../lib/notify";
import type { ActionResult } from "./employees";

// ── Warehouses ────────────────────────────────────────────────────────────────

export async function listWarehouses() {
  try {
    await guard("inventory.read");
    const data = await prisma.warehouse.findMany({
      include: { _count: { select: { items: true } } },
      orderBy: { code: "asc" },
    });
    return { ok: true as const, data };
  } catch (e) { return { ok: false as const, error: errMsg(e) }; }
}

export async function listAllWarehouses() {
  try {
    await guard("inventory.read");
    const data = await prisma.warehouse.findMany({ orderBy: { code: "asc" } });
    return { ok: true as const, data };
  } catch (e) { return { ok: false as const, error: errMsg(e) }; }
}

const WarehouseInput = z.object({
  code:        z.string().min(1).max(20).toUpperCase(),
  name:        z.string().min(1).max(100),
  description: z.string().max(300).optional().nullable(),
});

export async function createWarehouse(raw: unknown) {
  try {
    await guard("inventory.manage");
    const p = WarehouseInput.safeParse(raw);
    if (!p.success) return { ok: false as const, error: p.error.errors[0].message };
    const wh = await prisma.warehouse.create({
      data: { code: p.data.code, name: p.data.name, description: p.data.description ?? null },
    });
    revalidatePath("/inventory/warehouses");
    return { ok: true as const, data: wh };
  } catch (e) { return { ok: false as const, error: errMsg(e) }; }
}

export async function updateWarehouse(raw: unknown) {
  try {
    await guard("inventory.manage");
    const p = WarehouseInput.extend({ id: z.coerce.number().int().positive() }).safeParse(raw);
    if (!p.success) return { ok: false as const, error: p.error.errors[0].message };
    const { id, ...data } = p.data;
    const wh = await prisma.warehouse.update({ where: { id }, data });
    revalidatePath("/inventory/warehouses");
    return { ok: true as const, data: wh };
  } catch (e) { return { ok: false as const, error: errMsg(e) }; }
}

export async function toggleWarehouseActive(raw: { id: number; active: boolean }): Promise<ActionResult<undefined>> {
  try {
    await guard("inventory.manage");
    await prisma.warehouse.update({ where: { id: raw.id }, data: { active: raw.active } });
    revalidatePath("/inventory/warehouses");
    return { ok: true, data: undefined };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

// ── Categories ────────────────────────────────────────────────────────────────

export async function listCategories() {
  try {
    await guard("inventory.read");
    const data = await prisma.inventoryCategory.findMany({
      include: { _count: { select: { items: true } } },
      orderBy: { code: "asc" },
    });
    return { ok: true as const, data };
  } catch (e) { return { ok: false as const, error: errMsg(e) }; }
}

const CategoryInput = z.object({
  name:        z.string().min(1).max(100),
  code:        z.string().min(1).max(20).toUpperCase(),
  description: z.string().max(300).optional().nullable(),
});

export async function createCategory(raw: unknown) {
  try {
    await guard("inventory.manage");
    const p = CategoryInput.safeParse(raw);
    if (!p.success) return { ok: false as const, error: p.error.errors[0].message };
    const cat = await prisma.inventoryCategory.create({
      data: { name: p.data.name, code: p.data.code, description: p.data.description ?? null },
    });
    revalidatePath("/inventory/warehouses");
    return { ok: true as const, data: cat };
  } catch (e) { return { ok: false as const, error: errMsg(e) }; }
}

export async function updateCategory(raw: unknown) {
  try {
    await guard("inventory.manage");
    const p = CategoryInput.extend({ id: z.coerce.number().int().positive() }).safeParse(raw);
    if (!p.success) return { ok: false as const, error: p.error.errors[0].message };
    const { id, ...data } = p.data;
    const cat = await prisma.inventoryCategory.update({ where: { id }, data });
    revalidatePath("/inventory/warehouses");
    return { ok: true as const, data: cat };
  } catch (e) { return { ok: false as const, error: errMsg(e) }; }
}

// ── Inventory Items ───────────────────────────────────────────────────────────

export async function listInventoryItems(opts?: { categoryId?: number; warehouseId?: number; status?: string }) {
  try {
    await guard("inventory.read");
    const data = await prisma.inventoryItem.findMany({
      where: {
        ...(opts?.categoryId ? { categoryId: opts.categoryId } : {}),
        ...(opts?.warehouseId ? { warehouseId: opts.warehouseId } : {}),
        ...(opts?.status ? { status: opts.status } : {}),
      },
      include: {
        category:  { select: { id: true, name: true, code: true } },
        warehouse: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ categoryId: "asc" }, { itemCode: "asc" }],
    });
    return { ok: true as const, data };
  } catch (e) { return { ok: false as const, error: errMsg(e) }; }
}

export async function getLowStockItems() {
  try {
    await guard("inventory.read");
    const data = await prisma.inventoryItem.findMany({
      where: { status: "ACTIVE", currentStock: { lte: prisma.inventoryItem.fields.minStock } },
      include: {
        category:  { select: { name: true, code: true } },
        warehouse: { select: { name: true, code: true } },
      },
      orderBy: { currentStock: "asc" },
    });
    return { ok: true as const, data };
  } catch (e) { return { ok: false as const, error: errMsg(e) }; }
}

const ItemInput = z.object({
  itemCode:      z.string().min(1).max(50),
  name:          z.string().min(1).max(150),
  categoryId:    z.coerce.number().int().positive(),
  warehouseId:   z.coerce.number().int().positive(),
  unitOfMeasure: z.string().min(1).max(20),
  specification: z.string().max(300).optional().nullable(),
  minStock:      z.coerce.number().min(0).default(0),
  maxStock:      z.coerce.number().min(0).optional().nullable(),
  currentStock:  z.coerce.number().min(0).default(0),
  unitCostUsd:   z.coerce.number().min(0).optional().nullable(),
  status:        z.enum(["ACTIVE", "INACTIVE", "DISCONTINUED"]).default("ACTIVE"),
  notes:         z.string().max(500).optional().nullable(),
});

export async function createInventoryItem(raw: unknown) {
  try {
    await guard("inventory.write");
    const p = ItemInput.safeParse(raw);
    if (!p.success) return { ok: false as const, error: p.error.errors[0].message };
    const d = p.data;
    const item = await prisma.inventoryItem.create({
      data: {
        itemCode:      d.itemCode,
        name:          d.name,
        categoryId:    d.categoryId,
        warehouseId:   d.warehouseId,
        unitOfMeasure: d.unitOfMeasure,
        specification: d.specification ?? null,
        minStock:      d.minStock,
        maxStock:      d.maxStock ?? null,
        currentStock:  d.currentStock,
        unitCostUsd:   d.unitCostUsd ?? null,
        status:        d.status,
        notes:         d.notes ?? null,
      },
    });
    revalidatePath("/inventory/items");
    revalidatePath("/inventory");
    return { ok: true as const, data: item };
  } catch (e) { return { ok: false as const, error: errMsg(e) }; }
}

export async function updateInventoryItem(raw: unknown) {
  try {
    await guard("inventory.write");
    const p = ItemInput.extend({ id: z.coerce.number().int().positive() }).safeParse(raw);
    if (!p.success) return { ok: false as const, error: p.error.errors[0].message };
    const { id, itemCode, name, categoryId, warehouseId, unitOfMeasure,
            specification, minStock, maxStock, currentStock, unitCostUsd,
            status, notes } = p.data;
    const item = await prisma.inventoryItem.update({
      where: { id },
      data: {
        itemCode, name, categoryId, warehouseId, unitOfMeasure,
        specification, minStock, maxStock, currentStock, unitCostUsd, status, notes,
      },
    });
    revalidatePath("/inventory/items");
    revalidatePath("/inventory");
    return { ok: true as const, data: item };
  } catch (e) { return { ok: false as const, error: errMsg(e) }; }
}

export async function setItemStatus(id: number, status: "ACTIVE" | "INACTIVE" | "DISCONTINUED"): Promise<ActionResult<undefined>> {
  try {
    await guard("inventory.manage");
    await prisma.inventoryItem.update({ where: { id }, data: { status } });
    revalidatePath("/inventory/items");
    return { ok: true, data: undefined };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

// ── Stock Transactions ────────────────────────────────────────────────────────

export async function listStockTransactions(opts?: { itemId?: number; days?: number; type?: string }) {
  try {
    await guard("inventory.read");
    const since = new Date();
    since.setDate(since.getDate() - (opts?.days ?? 30));
    const data = await prisma.stockTransaction.findMany({
      where: {
        createdAt: { gte: since },
        ...(opts?.itemId ? { itemId: opts.itemId } : {}),
        ...(opts?.type ? { type: opts.type as never } : {}),
      },
      include: {
        item:            { select: { id: true, itemCode: true, name: true, unitOfMeasure: true } },
        warehouse:       { select: { id: true, code: true, name: true } },
        productionOrder: { select: { id: true, orderCode: true } },
        createdBy:       { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    });
    return { ok: true as const, data };
  } catch (e) { return { ok: false as const, error: errMsg(e) }; }
}

const TxInput = z.object({
  type:              z.enum(["STOCK_IN", "STOCK_OUT", "ADJUSTMENT", "RETURN", "TRANSFER"]),
  itemId:            z.coerce.number().int().positive(),
  warehouseId:       z.coerce.number().int().positive().optional().nullable(),
  quantity:          z.coerce.number().positive(),
  unitCostUsd:       z.coerce.number().min(0).optional().nullable(),
  refNumber:         z.string().max(50).optional().nullable(),
  productionOrderId: z.coerce.number().int().positive().optional().nullable(),
  note:              z.string().max(300).optional().nullable(),
});

export async function recordStockTransaction(raw: unknown) {
  try {
    const actor = await guard("inventory.write");
    const p = TxInput.safeParse(raw);
    if (!p.success) return { ok: false as const, error: p.error.errors[0].message };

    const item = await prisma.inventoryItem.findUnique({ where: { id: p.data.itemId }, select: { currentStock: true, warehouseId: true } });
    if (!item) return { ok: false as const, error: "Item not found" };

    const isDecrease = p.data.type === "STOCK_OUT" || p.data.type === "TRANSFER";
    const delta = isDecrease ? -p.data.quantity : p.data.quantity;
    const newStock = Number(item.currentStock) + delta;

    if (newStock < 0) return { ok: false as const, error: "Insufficient stock — balance would go negative" };

    const [tx] = await prisma.$transaction([
      prisma.stockTransaction.create({
        data: {
          type:              p.data.type,
          itemId:            p.data.itemId,
          warehouseId:       p.data.warehouseId ?? item.warehouseId,
          quantity:          p.data.quantity,
          unitCostUsd:       p.data.unitCostUsd ?? null,
          balanceAfter:      newStock,
          refNumber:         p.data.refNumber ?? null,
          productionOrderId: p.data.productionOrderId ?? null,
          note:              p.data.note ?? null,
          createdById:       actor.id,
        },
      }),
      prisma.inventoryItem.update({
        where: { id: p.data.itemId },
        data:  { currentStock: newStock },
      }),
    ]);

    revalidatePath("/inventory");
    revalidatePath("/inventory/transactions");
    revalidatePath("/inventory/items");
    // Low-stock check — fire-and-forget
    if (isDecrease) {
      void prisma.inventoryItem.findUnique({
        where: { id: p.data.itemId },
        select: { name: true, itemCode: true, currentStock: true, minStock: true },
      }).then(async (upd) => {
        if (upd && Number(upd.currentStock) <= Number(upd.minStock)) {
          await notifyRole(["OWNER", "HR_MANAGER"], {
            title: `Low stock: ${upd.name}`,
            body: `${upd.itemCode} — current ${upd.currentStock}, minimum ${upd.minStock}. Consider raising a purchase requisition.`,
            level: "warning", module: "inventory", href: "/inventory/items",
          });
        }
      }).catch(console.error);
    }
    return { ok: true as const, data: tx };
  } catch (e) { return { ok: false as const, error: errMsg(e) }; }
}

// ── Dashboard Summary ─────────────────────────────────────────────────────────

export async function getInventorySummary() {
  try {
    await guard("inventory.read");

    const today  = new Date();
    const last7  = new Date(today); last7.setDate(today.getDate() - 6);
    const last30 = new Date(today); last30.setDate(today.getDate() - 29);

    const [allItems, warehouses, txLast30, lowStock, recentTx] = await Promise.all([
      prisma.inventoryItem.findMany({
        where: { status: "ACTIVE" },
        include: {
          category:  { select: { name: true, code: true } },
          warehouse: { select: { name: true, code: true } },
        },
      }),
      prisma.warehouse.findMany({
        where: { active: true },
        include: { _count: { select: { items: true } } },
        orderBy: { code: "asc" },
      }),
      prisma.stockTransaction.groupBy({
        by: ["type"],
        where: { createdAt: { gte: last30 } },
        _count: { id: true },
        _sum: { quantity: true },
      }),
      prisma.inventoryItem.findMany({
        where: { status: "ACTIVE", currentStock: { lte: prisma.inventoryItem.fields.minStock } },
        include: { category: { select: { name: true } }, warehouse: { select: { code: true } } },
        orderBy: { currentStock: "asc" },
        take: 10,
      }),
      prisma.stockTransaction.findMany({
        where: { createdAt: { gte: last7 } },
        include: {
          item:      { select: { itemCode: true, name: true, unitOfMeasure: true } },
          warehouse: { select: { code: true } },
          createdBy: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);

    let totalValueUsd = 0, outOfStockCount = 0, lowStockCount = 0;
    const byCategory:  Record<string, { count: number; value: number }> = {};
    const byWarehouse: Record<string, { count: number; value: number }> = {};

    for (const item of allItems) {
      const qty  = Number(item.currentStock);
      const val  = qty * Number(item.unitCostUsd ?? 0);
      totalValueUsd += val;
      if (qty === 0) outOfStockCount++;
      if (qty <= Number(item.minStock)) lowStockCount++;

      const cat = item.category.code;
      byCategory[cat] = byCategory[cat] ?? { count: 0, value: 0 };
      byCategory[cat].count++;
      byCategory[cat].value += val;

      const wh = item.warehouse.code;
      byWarehouse[wh] = byWarehouse[wh] ?? { count: 0, value: 0 };
      byWarehouse[wh].count++;
      byWarehouse[wh].value += val;
    }

    return {
      ok: true as const,
      data: {
        totalItems: allItems.length,
        totalValueUsd: Math.round(totalValueUsd * 100) / 100,
        outOfStockCount,
        lowStockCount,
        byCategory:  Object.entries(byCategory).map(([code, v])  => ({ code, ...v })),
        byWarehouse: Object.entries(byWarehouse).map(([code, v]) => ({ code, ...v })),
        warehouseList: warehouses.map((w) => ({ id: w.id, code: w.code, name: w.name, itemCount: w._count.items })),
        txByType: txLast30.map((r) => ({ type: r.type, count: r._count.id, qty: Number(r._sum.quantity ?? 0) })),
        lowStockItems: lowStock.map((i) => ({
          id: i.id, itemCode: i.itemCode, name: i.name,
          currentStock: Number(i.currentStock), minStock: Number(i.minStock),
          category: i.category.name, warehouseCode: i.warehouse.code,
          unitOfMeasure: i.unitOfMeasure,
        })),
        recentTransactions: recentTx.map((t) => ({
          id: t.id.toString(),
          type: t.type,
          itemCode: t.item.itemCode,
          itemName: t.item.name,
          uom: t.item.unitOfMeasure,
          quantity: Number(t.quantity),
          balanceAfter: t.balanceAfter !== null ? Number(t.balanceAfter) : null,
          warehouseCode: t.warehouse?.code ?? null,
          refNumber: t.refNumber,
          createdBy: t.createdBy.name,
          createdAt: t.createdAt.toISOString(),
        })),
      },
    };
  } catch (e) { return { ok: false as const, error: errMsg(e) }; }
}

// ── Executive summary (lightweight) ──────────────────────────────────────────

export async function getInventoryExecutiveSummary() {
  try {
    const items = await prisma.inventoryItem.findMany({
      where: { status: "ACTIVE" },
      select: { currentStock: true, minStock: true, unitCostUsd: true },
    });
    let totalValue = 0, lowStock = 0, outOfStock = 0;
    for (const i of items) {
      const qty = Number(i.currentStock);
      totalValue += qty * Number(i.unitCostUsd ?? 0);
      if (qty === 0) outOfStock++;
      else if (qty <= Number(i.minStock)) lowStock++;
    }
    return {
      ok: true as const,
      data: {
        totalValueUsd: Math.round(totalValue * 100) / 100,
        totalItems: items.length,
        lowStockCount: lowStock,
        outOfStockCount: outOfStock,
      },
    };
  } catch (e) { return { ok: false as const, error: errMsg(e) }; }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function errMsg(e: unknown): string {
  if (e instanceof Error) {
    if (e.message === "Not authenticated") redirect("/login");
    if (e.name === "ForbiddenError") return "You do not have permission for this action.";
    return e.message;
  }
  return "Unexpected error";
}
