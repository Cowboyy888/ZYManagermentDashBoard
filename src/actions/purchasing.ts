"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "../lib/db";
import { guard } from "../lib/auth/session";
import { notifyRole } from "../lib/notify";

// ── Helpers ───────────────────────────────────────────────────────────────────

function errMsg(e: unknown): string {
  if (e instanceof Error) {
    if (e.message === "Not authenticated") redirect("/login");
    if (e.name === "ForbiddenError") return "You do not have permission.";
    return e.message;
  }
  return "Unexpected error";
}

function ok<T>(data: T) { return { ok: true as const, data }; }
function err(error: string) { return { ok: false as const, error }; }

// ── Supplier ──────────────────────────────────────────────────────────────────

const SupplierInput = z.object({
  supplierCode:  z.string().min(1).max(30),
  name:          z.string().min(1).max(150),
  contactPerson: z.string().max(100).optional().nullable(),
  phone:         z.string().max(30).optional().nullable(),
  email:         z.string().email().max(100).optional().nullable(),
  address:       z.string().max(300).optional().nullable(),
  taxId:         z.string().max(50).optional().nullable(),
  paymentTerms:  z.string().max(50).optional().nullable(),
  currency:      z.string().max(10).default("USD"),
  notes:         z.string().max(500).optional().nullable(),
});

export async function listSuppliers(opts?: { status?: string }) {
  try {
    await guard("purchasing.read");
    const data = await prisma.supplier.findMany({
      where: opts?.status ? { status: opts.status as never } : undefined,
      include: { _count: { select: { purchaseOrders: true } } },
      orderBy: { name: "asc" },
    });
    return ok(data);
  } catch (e) { return err(errMsg(e)); }
}

export async function createSupplier(raw: unknown) {
  try {
    await guard("purchasing.manage");
    const p = SupplierInput.safeParse(raw);
    if (!p.success) return err(p.error.errors[0].message);
    const d = p.data;
    const s = await prisma.supplier.create({
      data: {
        supplierCode: d.supplierCode, name: d.name,
        contactPerson: d.contactPerson ?? null, phone: d.phone ?? null,
        email: d.email ?? null, address: d.address ?? null,
        taxId: d.taxId ?? null, paymentTerms: d.paymentTerms ?? null,
        currency: d.currency, notes: d.notes ?? null,
      },
    });
    revalidatePath("/purchasing/suppliers");
    return ok(s);
  } catch (e) { return err(errMsg(e)); }
}

export async function updateSupplier(raw: unknown) {
  try {
    await guard("purchasing.manage");
    const p = SupplierInput.extend({ id: z.coerce.number().int().positive() }).safeParse(raw);
    if (!p.success) return err(p.error.errors[0].message);
    const { id, supplierCode, name, contactPerson, phone, email,
            address, taxId, paymentTerms, currency, notes } = p.data;
    const s = await prisma.supplier.update({
      where: { id },
      data: { supplierCode, name, contactPerson: contactPerson ?? null, phone: phone ?? null,
              email: email ?? null, address: address ?? null, taxId: taxId ?? null,
              paymentTerms: paymentTerms ?? null, currency, notes: notes ?? null },
    });
    revalidatePath("/purchasing/suppliers");
    return ok(s);
  } catch (e) { return err(errMsg(e)); }
}

export async function setSupplierStatus(raw: { id: number; status: "ACTIVE" | "INACTIVE" | "BLACKLISTED" }) {
  try {
    await guard("purchasing.manage");
    await prisma.supplier.update({ where: { id: raw.id }, data: { status: raw.status } });
    revalidatePath("/purchasing/suppliers");
    return ok(undefined);
  } catch (e) { return err(errMsg(e)); }
}

// ── Purchase Requisition ──────────────────────────────────────────────────────

const PRItemInput = z.object({
  inventoryItemId:   z.coerce.number().int().positive().optional().nullable(),
  description:       z.string().min(1).max(200),
  unitOfMeasure:     z.string().min(1).max(20),
  quantity:          z.coerce.number().positive(),
  estimatedUnitCost: z.coerce.number().min(0).optional().nullable(),
  notes:             z.string().max(300).optional().nullable(),
});

const PRInput = z.object({
  departmentId: z.coerce.number().int().positive().optional().nullable(),
  requiredDate: z.string().min(1),
  reason:       z.string().max(500).optional().nullable(),
  notes:        z.string().max(500).optional().nullable(),
  items:        z.array(PRItemInput).min(1),
});

export async function listRequisitions(opts?: { status?: string; limit?: number }) {
  try {
    await guard("purchasing.read");
    const data = await prisma.purchaseRequisition.findMany({
      where: opts?.status ? { status: opts.status as never } : undefined,
      include: {
        department:  { select: { name: true } },
        requestedBy: { select: { name: true } },
        approvedBy:  { select: { name: true } },
        items:       true,
        _count:      { select: { purchaseOrders: true } },
      },
      orderBy: { createdAt: "desc" },
      take: opts?.limit ?? 200,
    });
    return ok(data);
  } catch (e) { return err(errMsg(e)); }
}

export async function createRequisition(raw: unknown) {
  try {
    const actor = await guard("purchasing.write");
    const p = PRInput.safeParse(raw);
    if (!p.success) return err(p.error.errors[0].message);
    const d = p.data;

    // Auto-generate PR number: PR-YYYYMM-NNN
    const count = await prisma.purchaseRequisition.count();
    const now = new Date();
    const prNumber = `PR-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${String(count + 1).padStart(3, "0")}`;

    const pr = await prisma.purchaseRequisition.create({
      data: {
        prNumber,
        departmentId:  d.departmentId ?? null,
        requestedById: actor.id,
        requiredDate:  new Date(d.requiredDate),
        reason:        d.reason ?? null,
        notes:         d.notes ?? null,
        items: {
          create: d.items.map((i) => ({
            inventoryItemId:   i.inventoryItemId ?? null,
            description:       i.description,
            unitOfMeasure:     i.unitOfMeasure,
            quantity:          i.quantity,
            estimatedUnitCost: i.estimatedUnitCost ?? null,
            notes:             i.notes ?? null,
          })),
        },
      },
      include: { items: true },
    });
    revalidatePath("/purchasing/requisitions");
    return ok(pr);
  } catch (e) { return err(errMsg(e)); }
}

export async function submitRequisition(id: number) {
  try {
    await guard("purchasing.write");
    const pr = await prisma.purchaseRequisition.findUnique({ where: { id }, select: { status: true } });
    if (!pr) return err("Requisition not found");
    if (pr.status !== "DRAFT") return err("Only DRAFT requisitions can be submitted");
    const updated = await prisma.purchaseRequisition.update({ where: { id }, data: { status: "SUBMITTED" } });
    revalidatePath("/purchasing/requisitions");
    return ok(updated);
  } catch (e) { return err(errMsg(e)); }
}

export async function approveRequisition(raw: { id: number; approve: boolean; notes?: string }) {
  try {
    const actor = await guard("purchasing.approve");
    const pr = await prisma.purchaseRequisition.findUnique({ where: { id: raw.id }, select: { status: true } });
    if (!pr) return err("Requisition not found");
    if (pr.status !== "SUBMITTED") return err("Only SUBMITTED requisitions can be approved or rejected");
    const updated = await prisma.purchaseRequisition.update({
      where: { id: raw.id },
      data: {
        status: raw.approve ? "APPROVED" : "REJECTED",
        approvedById: actor.id,
      },
    });
    revalidatePath("/purchasing/requisitions");
    return ok(updated);
  } catch (e) { return err(errMsg(e)); }
}

// ── Purchase Order ────────────────────────────────────────────────────────────

const POItemInput = z.object({
  inventoryItemId: z.coerce.number().int().positive().optional().nullable(),
  description:     z.string().min(1).max(200),
  unitOfMeasure:   z.string().min(1).max(20),
  quantity:        z.coerce.number().positive(),
  unitPriceUsd:    z.coerce.number().min(0),
  notes:           z.string().max(300).optional().nullable(),
});

const POInput = z.object({
  supplierId:       z.coerce.number().int().positive(),
  prId:             z.coerce.number().int().positive().optional().nullable(),
  warehouseId:      z.coerce.number().int().positive().optional().nullable(),
  orderDate:        z.string().min(1),
  expectedDelivery: z.string().optional().nullable(),
  currency:         z.string().max(10).default("USD"),
  notes:            z.string().max(500).optional().nullable(),
  items:            z.array(POItemInput).min(1),
});

export async function listPurchaseOrders(opts?: { status?: string; supplierId?: number; days?: number }) {
  try {
    await guard("purchasing.read");
    const since = opts?.days ? new Date(Date.now() - opts.days * 86400000) : undefined;
    const data = await prisma.purchaseOrder.findMany({
      where: {
        ...(opts?.status ? { status: opts.status as never } : {}),
        ...(opts?.supplierId ? { supplierId: opts.supplierId } : {}),
        ...(since ? { orderDate: { gte: since } } : {}),
      },
      include: {
        supplier: { select: { id: true, name: true, supplierCode: true } },
        warehouse: { select: { id: true, code: true, name: true } },
        createdBy: { select: { name: true } },
        approvedBy: { select: { name: true } },
        items: true,
        receipts: { select: { id: true, status: true } },
        _count: { select: { receipts: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 300,
    });
    return ok(data);
  } catch (e) { return err(errMsg(e)); }
}

export async function getPurchaseOrder(id: number) {
  try {
    await guard("purchasing.read");
    const data = await prisma.purchaseOrder.findUnique({
      where: { id },
      include: {
        supplier: true,
        warehouse: { select: { id: true, code: true, name: true } },
        pr: { select: { id: true, prNumber: true } },
        createdBy: { select: { name: true } },
        approvedBy: { select: { name: true } },
        items: { include: { inventoryItem: { select: { id: true, itemCode: true, name: true } } } },
        receipts: {
          include: {
            items: true,
            receivedBy: { select: { name: true } },
          },
        },
      },
    });
    if (!data) return err("Purchase order not found");
    return ok(data);
  } catch (e) { return err(errMsg(e)); }
}

export async function createPurchaseOrder(raw: unknown) {
  try {
    const actor = await guard("purchasing.manage");
    const p = POInput.safeParse(raw);
    if (!p.success) return err(p.error.errors[0].message);
    const d = p.data;

    const count = await prisma.purchaseOrder.count();
    const now = new Date();
    const poNumber = `PO-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${String(count + 1).padStart(4, "0")}`;

    let totalAmountUsd = 0;
    const itemsData = d.items.map((i) => {
      const total = Math.round(i.quantity * i.unitPriceUsd * 100) / 100;
      totalAmountUsd += total;
      return {
        inventoryItemId: i.inventoryItemId ?? null,
        description:     i.description,
        unitOfMeasure:   i.unitOfMeasure,
        quantity:        i.quantity,
        unitPriceUsd:    i.unitPriceUsd,
        totalUsd:        total,
        notes:           i.notes ?? null,
      };
    });

    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        supplierId:       d.supplierId,
        prId:             d.prId ?? null,
        warehouseId:      d.warehouseId ?? null,
        orderDate:        new Date(d.orderDate),
        expectedDelivery: d.expectedDelivery ? new Date(d.expectedDelivery) : null,
        currency:         d.currency,
        totalAmountUsd,
        notes:            d.notes ?? null,
        createdById:      actor.id,
        items: { create: itemsData },
      },
      include: { items: true },
    });

    // Mark linked PR as ordered
    if (d.prId) {
      await prisma.purchaseRequisition.update({
        where: { id: d.prId },
        data: { status: "ORDERED" },
      }).catch(() => null);
    }

    revalidatePath("/purchasing/orders");
    revalidatePath("/purchasing");
    return ok(po);
  } catch (e) { return err(errMsg(e)); }
}

export async function approvePurchaseOrder(raw: { id: number; approve: boolean }) {
  try {
    const actor = await guard("purchasing.approve");
    const po = await prisma.purchaseOrder.findUnique({ where: { id: raw.id }, select: { status: true } });
    if (!po) return err("Purchase order not found");
    if (po.status !== "PENDING_APPROVAL") return err("Only PENDING_APPROVAL orders can be approved or rejected");
    const updated = await prisma.purchaseOrder.update({
      where: { id: raw.id },
      data: {
        status:      raw.approve ? "APPROVED" : "CANCELLED",
        approvedById: actor.id,
        approvedAt:   new Date(),
      },
    });
    revalidatePath("/purchasing/orders");
    return ok(updated);
  } catch (e) { return err(errMsg(e)); }
}

export async function submitPurchaseOrder(id: number) {
  try {
    await guard("purchasing.manage");
    const po = await prisma.purchaseOrder.findUnique({ where: { id }, select: { status: true } });
    if (!po) return err("Purchase order not found");
    if (po.status !== "DRAFT") return err("Only DRAFT orders can be submitted for approval");
    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: "PENDING_APPROVAL" },
    });
    revalidatePath("/purchasing/orders");
    return ok(updated);
  } catch (e) { return err(errMsg(e)); }
}

export async function cancelPurchaseOrder(id: number) {
  try {
    await guard("purchasing.manage");
    const po = await prisma.purchaseOrder.findUnique({ where: { id }, select: { status: true } });
    if (!po) return err("Purchase order not found");
    if (po.status === "RECEIVED") return err("Fully received orders cannot be cancelled");
    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
    revalidatePath("/purchasing/orders");
    return ok(updated);
  } catch (e) { return err(errMsg(e)); }
}

// ── Goods Receipt ─────────────────────────────────────────────────────────────

const GRItemInput = z.object({
  poItemId:    z.coerce.number().int().positive(),
  receivedQty: z.coerce.number().min(0),
  rejectedQty: z.coerce.number().min(0).default(0),
  notes:       z.string().max(300).optional().nullable(),
});

const GRInput = z.object({
  poId:         z.coerce.number().int().positive(),
  warehouseId:  z.coerce.number().int().positive(),
  receivedDate: z.string().min(1),
  notes:        z.string().max(500).optional().nullable(),
  items:        z.array(GRItemInput).min(1),
});

export async function listGoodsReceipts(opts?: { poId?: number; days?: number }) {
  try {
    await guard("purchasing.read");
    const since = opts?.days ? new Date(Date.now() - opts.days * 86400000) : undefined;
    const data = await prisma.goodsReceipt.findMany({
      where: {
        ...(opts?.poId ? { poId: opts.poId } : {}),
        ...(since ? { receivedDate: { gte: since } } : {}),
      },
      include: {
        po:         { select: { id: true, poNumber: true, supplier: { select: { name: true } } } },
        warehouse:  { select: { id: true, code: true, name: true } },
        receivedBy: { select: { name: true } },
        items:      { include: { poItem: { select: { description: true, unitOfMeasure: true, quantity: true } } } },
      },
      orderBy: { receivedDate: "desc" },
      take: 200,
    });
    return ok(data);
  } catch (e) { return err(errMsg(e)); }
}

export async function createGoodsReceipt(raw: unknown) {
  try {
    const actor = await guard("purchasing.write");
    const p = GRInput.safeParse(raw);
    if (!p.success) return err(p.error.errors[0].message);
    const d = p.data;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id: d.poId },
      include: { items: true },
    });
    if (!po) return err("Purchase order not found");
    if (po.status === "CANCELLED") return err("Cannot receive against a cancelled order");
    if (!["APPROVED", "PARTIALLY_RECEIVED"].includes(po.status)) return err("Order must be APPROVED before receiving");

    const count = await prisma.goodsReceipt.count();
    const now = new Date();
    const receiptNumber = `GR-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${String(count + 1).padStart(4, "0")}`;

    // Determine if this is full or partial receipt
    const poItemMap = new Map(po.items.map((i) => [i.id, i]));
    const grItems = d.items.filter((i) => i.receivedQty > 0);

    // Check if all PO items are now fully received
    let allReceived = true;
    for (const poItem of po.items) {
      const grItem = grItems.find((g) => g.poItemId === poItem.id);
      const newReceived = Number(poItem.receivedQty) + (grItem?.receivedQty ?? 0);
      if (newReceived < Number(poItem.quantity)) allReceived = false;
    }

    const grStatus = allReceived ? "COMPLETED" : "PARTIAL";
    const newPoStatus = allReceived ? "RECEIVED" : "PARTIALLY_RECEIVED";

    // Build stock transactions for accepted items
    const stockTxOps: ReturnType<typeof prisma.stockTransaction.create>[] = [];
    const poItemUpdates: ReturnType<typeof prisma.purchaseOrderItem.update>[] = [];

    for (const grItem of grItems) {
      const poItem = poItemMap.get(grItem.poItemId);
      if (!poItem || !poItem.inventoryItemId) continue;

      const acceptedQty = grItem.receivedQty - (grItem.rejectedQty ?? 0);
      if (acceptedQty <= 0) continue;

      const invItem = await prisma.inventoryItem.findUnique({
        where: { id: poItem.inventoryItemId },
        select: { currentStock: true, warehouseId: true },
      });
      if (!invItem) continue;

      const newStock = Number(invItem.currentStock) + acceptedQty;

      stockTxOps.push(
        prisma.stockTransaction.create({
          data: {
            type:        "STOCK_IN",
            itemId:      poItem.inventoryItemId,
            warehouseId: d.warehouseId,
            quantity:    acceptedQty,
            unitCostUsd: Number(poItem.unitPriceUsd),
            balanceAfter: newStock,
            refNumber:   receiptNumber,
            note:        `Goods receipt from PO ${po.poNumber}`,
            createdById: actor.id,
          },
        })
      );

      stockTxOps.push(
        prisma.inventoryItem.update({
          where: { id: poItem.inventoryItemId },
          data:  { currentStock: newStock },
        }) as unknown as ReturnType<typeof prisma.stockTransaction.create>
      );

      poItemUpdates.push(
        prisma.purchaseOrderItem.update({
          where: { id: grItem.poItemId },
          data:  { receivedQty: Number(poItem.receivedQty) + grItem.receivedQty },
        })
      );
    }

    // Atomic: create receipt + update stock + update PO status
    const [receipt] = await prisma.$transaction([
      prisma.goodsReceipt.create({
        data: {
          receiptNumber,
          poId:         d.poId,
          warehouseId:  d.warehouseId,
          receivedDate: new Date(d.receivedDate),
          receivedById: actor.id,
          status:       grStatus,
          notes:        d.notes ?? null,
          items: {
            create: grItems.map((i) => ({
              poItemId:    i.poItemId,
              receivedQty: i.receivedQty,
              rejectedQty: i.rejectedQty ?? 0,
              notes:       i.notes ?? null,
            })),
          },
        },
      }),
      prisma.purchaseOrder.update({ where: { id: d.poId }, data: { status: newPoStatus } }),
      ...poItemUpdates,
      ...stockTxOps,
    ]);

    revalidatePath("/purchasing/receipts");
    revalidatePath("/purchasing/orders");
    revalidatePath("/purchasing");
    revalidatePath("/inventory");
    // Workflow: goods received → notify purchasing + warehouse managers
    void notifyRole(["OWNER", "HR_MANAGER"], {
      title: `Goods received: ${receiptNumber}`,
      body: `PO ${po.poNumber} — ${grStatus === "COMPLETED" ? "fully received" : "partially received"}. Inventory has been updated.`,
      level: "info", module: "purchasing", href: `/purchasing/receipts`,
    }, { excludeUserId: actor.id }).catch(console.error);
    return ok(receipt);
  } catch (e) { return err(errMsg(e)); }
}

// ── Dashboard Summary ─────────────────────────────────────────────────────────

export async function getPurchasingSummary() {
  try {
    await guard("purchasing.read");

    const today     = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const last6mo    = new Date(today.getFullYear(), today.getMonth() - 5, 1);

    const [
      totalPOs,
      pendingApproval,
      approvedPOs,
      awaitingReceipt,
      monthlyPOs,
      suppliers,
      recentPOs,
      recentReceipts,
      posByStatus,
      monthlySpend,
    ] = await Promise.all([
      prisma.purchaseOrder.count(),
      prisma.purchaseOrder.count({ where: { status: "PENDING_APPROVAL" } }),
      prisma.purchaseOrder.count({ where: { status: "APPROVED" } }),
      prisma.purchaseOrder.count({ where: { status: { in: ["APPROVED", "PARTIALLY_RECEIVED"] } } }),
      prisma.purchaseOrder.count({ where: { orderDate: { gte: monthStart } } }),
      prisma.supplier.findMany({
        where: { status: "ACTIVE" },
        include: { _count: { select: { purchaseOrders: true } } },
        orderBy: { name: "asc" },
        take: 10,
      }),
      prisma.purchaseOrder.findMany({
        take: 8,
        orderBy: { createdAt: "desc" },
        include: {
          supplier: { select: { name: true } },
          createdBy: { select: { name: true } },
        },
      }),
      prisma.goodsReceipt.findMany({
        take: 5,
        orderBy: { receivedDate: "desc" },
        include: {
          po: { select: { poNumber: true, supplier: { select: { name: true } } } },
          receivedBy: { select: { name: true } },
          items: { select: { receivedQty: true } },
        },
      }),
      prisma.purchaseOrder.groupBy({
        by: ["status"],
        _count: { id: true },
        _sum: { totalAmountUsd: true },
      }),
      prisma.purchaseOrder.findMany({
        where: { orderDate: { gte: last6mo } },
        select: { orderDate: true, totalAmountUsd: true, status: true },
      }),
    ]);

    // Monthly trend (6 months)
    const trendMap: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      trendMap[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`] = 0;
    }
    for (const po of monthlySpend) {
      if (po.status === "CANCELLED") continue;
      const k = `${po.orderDate.getFullYear()}-${String(po.orderDate.getMonth() + 1).padStart(2, "0")}`;
      if (k in trendMap) trendMap[k] += Number(po.totalAmountUsd);
    }
    const spendTrend = Object.entries(trendMap).map(([month, amount]) => ({ month, amount: Math.round(amount * 100) / 100 }));

    // Monthly spend
    let monthlySpendUsd = 0;
    for (const po of monthlySpend) {
      if (po.status === "CANCELLED") continue;
      const d = po.orderDate;
      if (d >= monthStart) monthlySpendUsd += Number(po.totalAmountUsd);
    }

    // Low stock items needing purchase
    const lowStockItems = await prisma.inventoryItem.findMany({
      where: { status: "ACTIVE", currentStock: { lte: prisma.inventoryItem.fields.minStock } },
      select: { id: true, itemCode: true, name: true, currentStock: true, minStock: true, unitOfMeasure: true,
                category: { select: { code: true } }, warehouse: { select: { code: true } } },
      orderBy: { currentStock: "asc" },
      take: 10,
    });

    return ok({
      totalPOs,
      pendingApproval,
      approvedPOs,
      awaitingReceipt,
      monthlyPOs,
      monthlySpendUsd: Math.round(monthlySpendUsd * 100) / 100,
      supplierCount: suppliers.length,
      topSuppliers: suppliers.slice(0, 5).map((s) => ({
        id: s.id, name: s.name, supplierCode: s.supplierCode,
        orderCount: s._count.purchaseOrders, status: s.status,
      })),
      posByStatus: posByStatus.map((r) => ({
        status: r.status, count: r._count.id,
        totalUsd: Math.round(Number(r._sum.totalAmountUsd ?? 0) * 100) / 100,
      })),
      spendTrend,
      recentPOs: recentPOs.map((po) => ({
        id: po.id, poNumber: po.poNumber, supplierName: po.supplier.name,
        status: po.status, totalAmountUsd: Number(po.totalAmountUsd),
        orderDate: po.orderDate.toISOString(), createdBy: po.createdBy.name,
      })),
      recentReceipts: recentReceipts.map((r) => ({
        id: r.id.toString(), receiptNumber: r.receiptNumber,
        poNumber: r.po.poNumber, supplierName: r.po.supplier.name,
        status: r.status, itemCount: r.items.length,
        receivedBy: r.receivedBy.name, receivedDate: r.receivedDate.toISOString(),
      })),
      lowStockNeedingPurchase: lowStockItems.map((i) => ({
        id: i.id, itemCode: i.itemCode, name: i.name,
        currentStock: Number(i.currentStock), minStock: Number(i.minStock),
        unitOfMeasure: i.unitOfMeasure, categoryCode: i.category.code,
        warehouseCode: i.warehouse.code,
      })),
    });
  } catch (e) { return err(errMsg(e)); }
}

// ── Executive summary ─────────────────────────────────────────────────────────

export async function getPurchasingExecutiveSummary() {
  try {
    const today      = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [pendingApproval, awaitingReceipt, monthlySpend] = await Promise.all([
      prisma.purchaseOrder.count({ where: { status: "PENDING_APPROVAL" } }),
      prisma.purchaseOrder.count({ where: { status: { in: ["APPROVED", "PARTIALLY_RECEIVED"] } } }),
      prisma.purchaseOrder.aggregate({
        where: { orderDate: { gte: monthStart }, status: { not: "CANCELLED" } },
        _sum: { totalAmountUsd: true },
      }),
    ]);

    const lowStockCount = await prisma.inventoryItem.count({
      where: { status: "ACTIVE", currentStock: { lte: prisma.inventoryItem.fields.minStock } },
    });

    return ok({
      pendingApproval,
      awaitingReceipt,
      monthlySpendUsd: Math.round(Number(monthlySpend._sum.totalAmountUsd ?? 0) * 100) / 100,
      lowStockCount,
    });
  } catch (e) { return err(errMsg(e)); }
}
