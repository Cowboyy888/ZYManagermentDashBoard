"use server";
import { prisma } from "@/lib/db";
import { requireCustomerUser } from "@/lib/auth/portal";

type AR<T> = { ok: true; data: T } | { ok: false; error: string };
function ok<T>(data: T): AR<T> { return { ok: true, data }; }
function err(e: unknown): AR<never> {
  return { ok: false, error: e instanceof Error ? e.message : String(e) };
}

// ── Dashboard ──────────────────────────────────────────────────────────────

export async function getCustomerDashboard() {
  try {
    const u = await requireCustomerUser();
    const cid = u.customerId;

    const [openQuotations, activeOrders, inProduction, pendingDeliveries, unpaidInvoices, announcements] =
      await Promise.all([
        prisma.quotation.count({ where: { customerId: cid, status: { in: ["SENT", "APPROVED"] } } }),
        prisma.salesOrder.count({ where: { customerId: cid, status: { in: ["CONFIRMED", "READY"] } } }),
        prisma.salesOrder.count({ where: { customerId: cid, status: "IN_PRODUCTION" } }),
        prisma.delivery.count({
          where: { order: { customerId: cid }, status: { in: ["SCHEDULED", "IN_TRANSIT"] } },
        }),
        prisma.invoice.aggregate({
          where: { customerId: cid, status: { in: ["SENT", "OVERDUE"] } },
          _sum: { totalUsd: true },
        }),
        prisma.portalAnnouncement.findMany({
          where: {
            targetType: { in: ["ALL", "CUSTOMERS"] },
            publishedAt: { lte: new Date() },
            OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
          },
          orderBy: { publishedAt: "desc" },
          take: 5,
          select: { id: true, title: true, body: true, publishedAt: true },
        }),
      ]);

    return ok({
      openQuotations,
      activeOrders,
      inProduction,
      pendingDeliveries,
      outstandingInvoicesUsd: Number(unpaidInvoices._sum.totalUsd ?? 0),
      announcements,
    });
  } catch (e) {
    return err(e);
  }
}

// ── Quotations ─────────────────────────────────────────────────────────────

export async function getCustomerQuotations(page = 1) {
  try {
    const u = await requireCustomerUser();
    const take = 20;
    const skip = (page - 1) * take;
    const [items, total] = await Promise.all([
      prisma.quotation.findMany({
        where: { customerId: u.customerId, status: { in: ["SENT", "APPROVED", "REJECTED", "EXPIRED", "CONVERTED"] } },
        orderBy: { createdAt: "desc" },
        skip,
        take,
        select: {
          id: true, quotationNumber: true, status: true, totalUsd: true, currency: true,
          validUntil: true, createdAt: true, portalAcceptedAt: true, portalRejectedAt: true,
        },
      }),
      prisma.quotation.count({
        where: { customerId: u.customerId, status: { in: ["SENT", "APPROVED", "REJECTED", "EXPIRED", "CONVERTED"] } },
      }),
    ]);
    return ok({ items, total, page });
  } catch (e) {
    return err(e);
  }
}

export async function getCustomerQuotationDetail(id: number) {
  try {
    const u = await requireCustomerUser();
    const q = await prisma.quotation.findFirst({
      where: { id, customerId: u.customerId },
      include: {
        items: true,
        customer: { select: { name: true } },
      },
    });
    if (!q) return { ok: false, error: "Not found" } as const;
    return ok(q);
  } catch (e) {
    return err(e);
  }
}

export async function acceptQuotation(id: number, note?: string): Promise<AR<undefined>> {
  try {
    const u = await requireCustomerUser();
    const q = await prisma.quotation.findFirst({ where: { id, customerId: u.customerId } });
    if (!q) return { ok: false, error: "Not found" };
    if (q.status !== "SENT" && q.status !== "APPROVED") return { ok: false, error: "Quotation cannot be accepted in current status." };
    await prisma.quotation.update({
      where: { id },
      data: { portalAcceptedAt: new Date(), portalRejectedAt: null, portalNote: note ?? null },
    });
    return ok(undefined);
  } catch (e) {
    return err(e);
  }
}

export async function rejectQuotation(id: number, note?: string): Promise<AR<undefined>> {
  try {
    const u = await requireCustomerUser();
    const q = await prisma.quotation.findFirst({ where: { id, customerId: u.customerId } });
    if (!q) return { ok: false, error: "Not found" };
    if (q.status !== "SENT" && q.status !== "APPROVED") return { ok: false, error: "Quotation cannot be rejected in current status." };
    await prisma.quotation.update({
      where: { id },
      data: { portalRejectedAt: new Date(), portalAcceptedAt: null, portalNote: note ?? null },
    });
    return ok(undefined);
  } catch (e) {
    return err(e);
  }
}

// ── Sales Orders ───────────────────────────────────────────────────────────

export async function getCustomerOrders(page = 1) {
  try {
    const u = await requireCustomerUser();
    const take = 20;
    const skip = (page - 1) * take;
    const [items, total] = await Promise.all([
      prisma.salesOrder.findMany({
        where: { customerId: u.customerId },
        orderBy: { orderDate: "desc" },
        skip, take,
        select: {
          id: true, orderNumber: true, status: true, totalUsd: true, currency: true,
          orderDate: true, requestedDelivery: true, paymentStatus: true,
          _count: { select: { deliveries: true } },
        },
      }),
      prisma.salesOrder.count({ where: { customerId: u.customerId } }),
    ]);
    return ok({ items, total, page });
  } catch (e) {
    return err(e);
  }
}

export async function getCustomerOrderDetail(id: number) {
  try {
    const u = await requireCustomerUser();
    const order = await prisma.salesOrder.findFirst({
      where: { id, customerId: u.customerId },
      include: {
        items: true,
        deliveries: { select: { id: true, deliveryNumber: true, status: true, scheduledDate: true, deliveredDate: true, carrier: true, trackingNumber: true } },
        qualityInspections: { select: { id: true, inspectionNumber: true, type: true, status: true, result: true, inspectionDate: true } },
        invoices: { select: { id: true, invoiceNumber: true, status: true, totalUsd: true, paidUsd: true, dueDate: true } },
        quotation: { select: { id: true, quotationNumber: true } },
      },
    });
    if (!order) return { ok: false, error: "Not found" } as const;
    return ok(order);
  } catch (e) {
    return err(e);
  }
}

// ── Deliveries ─────────────────────────────────────────────────────────────

export async function getCustomerDeliveries(page = 1) {
  try {
    const u = await requireCustomerUser();
    const take = 20;
    const skip = (page - 1) * take;
    const [items, total] = await Promise.all([
      prisma.delivery.findMany({
        where: { order: { customerId: u.customerId } },
        orderBy: { scheduledDate: "desc" },
        skip, take,
        select: {
          id: true, deliveryNumber: true, status: true, scheduledDate: true,
          deliveredDate: true, carrier: true, trackingNumber: true,
          order: { select: { id: true, orderNumber: true } },
        },
      }),
      prisma.delivery.count({ where: { order: { customerId: u.customerId } } }),
    ]);
    return ok({ items, total, page });
  } catch (e) {
    return err(e);
  }
}

// ── Invoices ───────────────────────────────────────────────────────────────

export async function getCustomerInvoices(page = 1) {
  try {
    const u = await requireCustomerUser();
    const take = 20;
    const skip = (page - 1) * take;
    const [items, total] = await Promise.all([
      prisma.invoice.findMany({
        where: { customerId: u.customerId },
        orderBy: { invoiceDate: "desc" },
        skip, take,
        select: {
          id: true, invoiceNumber: true, status: true, totalUsd: true, paidUsd: true,
          invoiceDate: true, dueDate: true,
          salesOrder: { select: { id: true, orderNumber: true } },
        },
      }),
      prisma.invoice.count({ where: { customerId: u.customerId } }),
    ]);
    return ok({ items, total, page });
  } catch (e) {
    return err(e);
  }
}

export async function getCustomerPayments() {
  try {
    const u = await requireCustomerUser();
    const payments = await prisma.payment.findMany({
      where: { invoice: { customerId: u.customerId } },
      orderBy: { paymentDate: "desc" },
      take: 50,
      select: {
        id: true, paymentNumber: true, amountUsd: true, paymentDate: true,
        method: true, reference: true,
        invoice: { select: { invoiceNumber: true, id: true } },
      },
    });
    return ok(payments);
  } catch (e) {
    return err(e);
  }
}

// ── Certificates ───────────────────────────────────────────────────────────

export async function getCustomerCertificates(page = 1) {
  try {
    const u = await requireCustomerUser();
    const take = 20;
    const skip = (page - 1) * take;
    const [items, total] = await Promise.all([
      prisma.qualityCertificate.findMany({
        where: { customerId: u.customerId },
        orderBy: { issuedDate: "desc" },
        skip, take,
        select: {
          id: true, certificateNumber: true, type: true, productDescription: true,
          batchNumber: true, issuedDate: true, validUntil: true,
          salesOrder: { select: { id: true, orderNumber: true } },
        },
      }),
      prisma.qualityCertificate.count({ where: { customerId: u.customerId } }),
    ]);
    return ok({ items, total, page });
  } catch (e) {
    return err(e);
  }
}

// ── Profile ────────────────────────────────────────────────────────────────

export async function getCustomerProfile() {
  try {
    const u = await requireCustomerUser();
    const customer = await prisma.customer.findUnique({
      where: { id: u.customerId },
      select: {
        id: true, customerCode: true, name: true, contactPerson: true, phone: true,
        email: true, address: true, country: true, taxId: true, paymentTerms: true,
        status: true, notes: true,
      },
    });
    if (!customer) return { ok: false, error: "Not found" } as const;
    return ok(customer);
  } catch (e) {
    return err(e);
  }
}

export async function updateCustomerProfile(input: {
  contactPerson?: string;
  phone?: string;
  address?: string;
  country?: string;
}): Promise<AR<undefined>> {
  try {
    const u = await requireCustomerUser();
    await prisma.customer.update({
      where: { id: u.customerId },
      data: { ...input },
    });
    return ok(undefined);
  } catch (e) {
    return err(e);
  }
}
