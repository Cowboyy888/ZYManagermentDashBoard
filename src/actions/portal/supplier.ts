"use server";
import { prisma } from "@/lib/db";
import { requireSupplierUser } from "@/lib/auth/portal";

type AR<T> = { ok: true; data: T } | { ok: false; error: string };
function ok<T>(data: T): AR<T> { return { ok: true, data }; }
function err(e: unknown): AR<never> {
  return { ok: false, error: e instanceof Error ? e.message : String(e) };
}

// ── Dashboard ──────────────────────────────────────────────────────────────

export async function getSupplierDashboard() {
  try {
    const u = await requireSupplierUser();
    const sid = u.supplierId;

    const [openOrders, pendingApproval, totalOrders, pendingBills, paidBills, announcements] =
      await Promise.all([
        prisma.purchaseOrder.count({ where: { supplierId: sid, status: { in: ["APPROVED", "PARTIALLY_RECEIVED"] } } }),
        prisma.purchaseOrder.count({ where: { supplierId: sid, supplierAcceptedAt: null, supplierRejectedAt: null, status: "APPROVED" } }),
        prisma.purchaseOrder.count({ where: { supplierId: sid } }),
        prisma.supplierBill.aggregate({
          where: { supplierId: sid, status: { in: ["PENDING", "APPROVED"] } },
          _sum: { totalUsd: true },
        }),
        prisma.supplierBill.aggregate({
          where: { supplierId: sid, status: "PAID" },
          _sum: { paidUsd: true },
        }),
        prisma.portalAnnouncement.findMany({
          where: {
            targetType: { in: ["ALL", "SUPPLIERS"] },
            publishedAt: { lte: new Date() },
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          orderBy: { publishedAt: "desc" },
          take: 5,
          select: { id: true, title: true, body: true, publishedAt: true },
        }),
      ]);

    // Supplier performance: on-time delivery rate
    const allReceipts = await prisma.goodsReceipt.findMany({
      where: { po: { supplierId: sid } },
      select: { receivedDate: true, po: { select: { expectedDelivery: true } } },
      take: 50,
      orderBy: { createdAt: "desc" },
    });
    const onTime = allReceipts.filter(r =>
      r.po.expectedDelivery && r.receivedDate <= r.po.expectedDelivery
    ).length;
    const performanceScore = allReceipts.length > 0 ? Math.round((onTime / allReceipts.length) * 100) : null;

    return ok({
      openOrders,
      pendingApproval,
      totalOrders,
      pendingBillsUsd: Number(pendingBills._sum.totalUsd ?? 0),
      paidUsd: Number(paidBills._sum.paidUsd ?? 0),
      performanceScore,
      announcements,
    });
  } catch (e) {
    return err(e);
  }
}

// ── Purchase Orders ────────────────────────────────────────────────────────

export async function getSupplierPurchaseOrders(page = 1) {
  try {
    const u = await requireSupplierUser();
    const take = 20;
    const skip = (page - 1) * take;
    const [items, total] = await Promise.all([
      prisma.purchaseOrder.findMany({
        where: { supplierId: u.supplierId, status: { not: "DRAFT" } },
        orderBy: { orderDate: "desc" },
        skip, take,
        select: {
          id: true, poNumber: true, status: true, totalAmountUsd: true, currency: true,
          orderDate: true, expectedDelivery: true,
          supplierAcceptedAt: true, supplierRejectedAt: true, supplierConfirmedDelivery: true,
          _count: { select: { receipts: true } },
        },
      }),
      prisma.purchaseOrder.count({ where: { supplierId: u.supplierId, status: { not: "DRAFT" } } }),
    ]);
    return ok({ items, total, page });
  } catch (e) {
    return err(e);
  }
}

export async function getSupplierPODetail(id: number) {
  try {
    const u = await requireSupplierUser();
    const po = await prisma.purchaseOrder.findFirst({
      where: { id, supplierId: u.supplierId, status: { not: "DRAFT" } },
      include: {
        items: { include: { inventoryItem: { select: { name: true, itemCode: true } } } },
        receipts: { select: { id: true, receiptNumber: true, receivedDate: true, status: true } },
        bills: { select: { id: true, billNumber: true, status: true, totalUsd: true, paidUsd: true, dueDate: true } },
      },
    });
    if (!po) return { ok: false, error: "Not found" } as const;
    return ok(po);
  } catch (e) {
    return err(e);
  }
}

export async function acceptPurchaseOrder(id: number, confirmedDelivery?: string, note?: string): Promise<AR<undefined>> {
  try {
    const u = await requireSupplierUser();
    const po = await prisma.purchaseOrder.findFirst({ where: { id, supplierId: u.supplierId } });
    if (!po) return { ok: false, error: "Not found" };
    if (po.status !== "APPROVED") return { ok: false, error: "PO cannot be accepted in current status." };
    await prisma.purchaseOrder.update({
      where: { id },
      data: {
        supplierAcceptedAt: new Date(),
        supplierRejectedAt: null,
        supplierNote: note ?? null,
        supplierConfirmedDelivery: confirmedDelivery ? new Date(confirmedDelivery) : null,
      },
    });
    return ok(undefined);
  } catch (e) {
    return err(e);
  }
}

export async function rejectPurchaseOrder(id: number, note?: string): Promise<AR<undefined>> {
  try {
    const u = await requireSupplierUser();
    const po = await prisma.purchaseOrder.findFirst({ where: { id, supplierId: u.supplierId } });
    if (!po) return { ok: false, error: "Not found" };
    if (po.status !== "APPROVED") return { ok: false, error: "PO cannot be rejected in current status." };
    await prisma.purchaseOrder.update({
      where: { id },
      data: { supplierRejectedAt: new Date(), supplierAcceptedAt: null, supplierNote: note ?? null },
    });
    return ok(undefined);
  } catch (e) {
    return err(e);
  }
}

// ── Payments ───────────────────────────────────────────────────────────────

export async function getSupplierBills(page = 1) {
  try {
    const u = await requireSupplierUser();
    const take = 20;
    const skip = (page - 1) * take;
    const [items, total] = await Promise.all([
      prisma.supplierBill.findMany({
        where: { supplierId: u.supplierId },
        orderBy: { billDate: "desc" },
        skip, take,
        select: {
          id: true, billNumber: true, status: true, totalUsd: true, paidUsd: true,
          billDate: true, dueDate: true,
          purchaseOrder: { select: { id: true, poNumber: true } },
        },
      }),
      prisma.supplierBill.count({ where: { supplierId: u.supplierId } }),
    ]);
    return ok({ items, total, page });
  } catch (e) {
    return err(e);
  }
}

// ── Performance ────────────────────────────────────────────────────────────

export async function getSupplierPerformance() {
  try {
    const u = await requireSupplierUser();
    const sid = u.supplierId;

    const [totalPOs, cancelledPOs, receipts, bills] = await Promise.all([
      prisma.purchaseOrder.count({ where: { supplierId: sid } }),
      prisma.purchaseOrder.count({ where: { supplierId: sid, status: "CANCELLED" } }),
      prisma.goodsReceipt.findMany({
        where: { po: { supplierId: sid } },
        select: { receivedDate: true, po: { select: { expectedDelivery: true } } },
        take: 100,
        orderBy: { createdAt: "desc" },
      }),
      prisma.supplierBill.findMany({
        where: { supplierId: sid },
        select: { totalUsd: true, paidUsd: true, status: true, dueDate: true },
        take: 100,
        orderBy: { billDate: "desc" },
      }),
    ]);

    const onTime = receipts.filter(r =>
      r.po.expectedDelivery && r.receivedDate <= r.po.expectedDelivery
    ).length;
    const onTimeRate = receipts.length > 0 ? Math.round((onTime / receipts.length) * 100) : null;

    const fulfilmentRate = totalPOs > 0
      ? Math.round(((totalPOs - cancelledPOs) / totalPOs) * 100)
      : null;

    const totalBilled = bills.reduce((s, b) => s + Number(b.totalUsd), 0);
    const totalPaid = bills.reduce((s, b) => s + Number(b.paidUsd), 0);

    return ok({
      totalOrders: totalPOs,
      cancelledOrders: cancelledPOs,
      fulfilmentRate,
      totalDeliveries: receipts.length,
      onTimeDeliveries: onTime,
      onTimeRate,
      totalBilledUsd: totalBilled,
      totalPaidUsd: totalPaid,
      outstandingUsd: totalBilled - totalPaid,
    });
  } catch (e) {
    return err(e);
  }
}

// ── Profile ────────────────────────────────────────────────────────────────

export async function getSupplierProfile() {
  try {
    const u = await requireSupplierUser();
    const supplier = await prisma.supplier.findUnique({
      where: { id: u.supplierId },
      select: {
        id: true, supplierCode: true, name: true, contactPerson: true, phone: true,
        email: true, address: true, taxId: true, paymentTerms: true, currency: true,
        status: true, notes: true,
      },
    });
    if (!supplier) return { ok: false, error: "Not found" } as const;
    return ok(supplier);
  } catch (e) {
    return err(e);
  }
}

export async function updateSupplierProfile(input: {
  contactPerson?: string;
  phone?: string;
  address?: string;
}): Promise<AR<undefined>> {
  try {
    const u = await requireSupplierUser();
    await prisma.supplier.update({
      where: { id: u.supplierId },
      data: { ...input },
    });
    return ok(undefined);
  } catch (e) {
    return err(e);
  }
}
