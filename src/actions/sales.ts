"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "../lib/db";
import { guard } from "../lib/auth/session";
import { notifyRole } from "../lib/notify";

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

// ── Customer ──────────────────────────────────────────────────────────────────

const CustomerInput = z.object({
  customerCode:  z.string().min(1).max(30),
  name:          z.string().min(1).max(150),
  contactPerson: z.string().max(100).optional().nullable(),
  phone:         z.string().max(30).optional().nullable(),
  email:         z.string().email().max(100).optional().nullable(),
  address:       z.string().max(300).optional().nullable(),
  country:       z.string().max(50).default("Cambodia"),
  taxId:         z.string().max(50).optional().nullable(),
  paymentTerms:  z.string().max(50).optional().nullable(),
  creditLimitUsd: z.coerce.number().min(0).optional().nullable(),
  notes:         z.string().max(500).optional().nullable(),
});

export async function listCustomers(opts?: { status?: string; limit?: number }) {
  try {
    await guard("sales.read");
    const data = await prisma.customer.findMany({
      where: opts?.status ? { status: opts.status as never } : undefined,
      include: {
        _count: { select: { quotations: true, salesOrders: true } },
      },
      orderBy: { name: "asc" },
      take: opts?.limit ?? 500,
    });
    return ok(data);
  } catch (e) { return err(errMsg(e)); }
}

export async function createCustomer(raw: unknown) {
  try {
    await guard("sales.manage");
    const p = CustomerInput.safeParse(raw);
    if (!p.success) return err(p.error.errors[0].message);
    const d = p.data;
    const c = await prisma.customer.create({
      data: {
        customerCode:  d.customerCode,
        name:          d.name,
        contactPerson: d.contactPerson ?? null,
        phone:         d.phone ?? null,
        email:         d.email ?? null,
        address:       d.address ?? null,
        country:       d.country,
        taxId:         d.taxId ?? null,
        paymentTerms:  d.paymentTerms ?? null,
        creditLimitUsd: d.creditLimitUsd !== undefined && d.creditLimitUsd !== null ? d.creditLimitUsd : null,
        notes:         d.notes ?? null,
      },
    });
    revalidatePath("/sales/customers");
    return ok(c);
  } catch (e) { return err(errMsg(e)); }
}

export async function updateCustomer(raw: unknown) {
  try {
    await guard("sales.manage");
    const p = CustomerInput.extend({ id: z.coerce.number().int().positive() }).safeParse(raw);
    if (!p.success) return err(p.error.errors[0].message);
    const { id, customerCode, name, contactPerson, phone, email,
            address, country, taxId, paymentTerms, creditLimitUsd, notes } = p.data;
    const c = await prisma.customer.update({
      where: { id },
      data: {
        customerCode, name,
        contactPerson: contactPerson ?? null, phone: phone ?? null, email: email ?? null,
        address: address ?? null, country, taxId: taxId ?? null,
        paymentTerms: paymentTerms ?? null,
        creditLimitUsd: creditLimitUsd !== undefined && creditLimitUsd !== null ? creditLimitUsd : null,
        notes: notes ?? null,
      },
    });
    revalidatePath("/sales/customers");
    return ok(c);
  } catch (e) { return err(errMsg(e)); }
}

export async function setCustomerStatus(raw: { id: number; status: "ACTIVE" | "INACTIVE" | "BLACKLISTED" }) {
  try {
    await guard("sales.manage");
    await prisma.customer.update({ where: { id: raw.id }, data: { status: raw.status } });
    revalidatePath("/sales/customers");
    return ok(undefined);
  } catch (e) { return err(errMsg(e)); }
}

// ── Leads ─────────────────────────────────────────────────────────────────────

const LeadInput = z.object({
  customerId:        z.coerce.number().int().positive().optional().nullable(),
  contactName:       z.string().min(1).max(100),
  companyName:       z.string().max(150).optional().nullable(),
  phone:             z.string().max(30).optional().nullable(),
  email:             z.string().email().max(100).optional().nullable(),
  source:            z.enum(["WEBSITE", "FACEBOOK", "WHATSAPP", "EMAIL", "TRADE_SHOW", "REFERRAL", "OTHER"]),
  productInterest:   z.string().max(300).optional().nullable(),
  estimatedValueUsd: z.coerce.number().min(0).optional().nullable(),
  assignedToId:      z.string().optional().nullable(),
  notes:             z.string().max(500).optional().nullable(),
});

export async function listLeads(opts?: { stage?: string; limit?: number }) {
  try {
    await guard("sales.read");
    const data = await prisma.lead.findMany({
      where: opts?.stage ? { stage: opts.stage as never } : undefined,
      include: {
        customer:   { select: { id: true, name: true, customerCode: true } },
        assignedTo: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: opts?.limit ?? 300,
    });
    return ok(data);
  } catch (e) { return err(errMsg(e)); }
}

export async function createLead(raw: unknown) {
  try {
    await guard("sales.write");
    const p = LeadInput.safeParse(raw);
    if (!p.success) return err(p.error.errors[0].message);
    const d = p.data;
    const lead = await prisma.lead.create({
      data: {
        customerId:        d.customerId ?? null,
        contactName:       d.contactName,
        companyName:       d.companyName ?? null,
        phone:             d.phone ?? null,
        email:             d.email ?? null,
        source:            d.source,
        productInterest:   d.productInterest ?? null,
        estimatedValueUsd: d.estimatedValueUsd !== undefined && d.estimatedValueUsd !== null ? d.estimatedValueUsd : null,
        assignedToId:      d.assignedToId ?? null,
        notes:             d.notes ?? null,
      },
    });
    revalidatePath("/sales/leads");
    return ok(lead);
  } catch (e) { return err(errMsg(e)); }
}

export async function updateLead(raw: unknown) {
  try {
    await guard("sales.write");
    const p = LeadInput.extend({ id: z.coerce.number().int().positive() }).safeParse(raw);
    if (!p.success) return err(p.error.errors[0].message);
    const { id, customerId, contactName, companyName, phone, email,
            source, productInterest, estimatedValueUsd, assignedToId, notes } = p.data;
    const lead = await prisma.lead.update({
      where: { id },
      data: {
        customerId: customerId ?? null, contactName, companyName: companyName ?? null,
        phone: phone ?? null, email: email ?? null, source,
        productInterest: productInterest ?? null,
        estimatedValueUsd: estimatedValueUsd !== undefined && estimatedValueUsd !== null ? estimatedValueUsd : null,
        assignedToId: assignedToId ?? null, notes: notes ?? null,
      },
    });
    revalidatePath("/sales/leads");
    return ok(lead);
  } catch (e) { return err(errMsg(e)); }
}

export async function updateLeadStage(raw: { id: number; stage: string; lostReason?: string }) {
  try {
    await guard("sales.write");
    const lead = await prisma.lead.update({
      where: { id: raw.id },
      data: {
        stage: raw.stage as never,
        lostReason: raw.stage === "LOST" ? (raw.lostReason ?? null) : null,
      },
    });
    revalidatePath("/sales/leads");
    return ok(lead);
  } catch (e) { return err(errMsg(e)); }
}

// ── Quotations ────────────────────────────────────────────────────────────────

const QItemInput = z.object({
  inventoryItemId: z.coerce.number().int().positive().optional().nullable(),
  description:     z.string().min(1).max(200),
  specification:   z.string().max(300).optional().nullable(),
  unitOfMeasure:   z.string().min(1).max(20),
  quantity:        z.coerce.number().positive(),
  unitPriceUsd:    z.coerce.number().min(0),
  discountPct:     z.coerce.number().min(0).max(100).default(0),
  sortOrder:       z.coerce.number().int().default(0),
});

const QuotationInput = z.object({
  customerId:      z.coerce.number().int().positive(),
  leadId:          z.coerce.number().int().positive().optional().nullable(),
  validUntil:      z.string().min(1),
  currency:        z.string().max(10).default("USD"),
  discountUsd:     z.coerce.number().min(0).default(0),
  taxUsd:          z.coerce.number().min(0).default(0),
  notes:           z.string().max(1000).optional().nullable(),
  termsConditions: z.string().max(2000).optional().nullable(),
  items:           z.array(QItemInput).min(1),
});

export async function listQuotations(opts?: { status?: string; customerId?: number; limit?: number }) {
  try {
    await guard("sales.read");
    const data = await prisma.quotation.findMany({
      where: {
        ...(opts?.status ? { status: opts.status as never } : {}),
        ...(opts?.customerId ? { customerId: opts.customerId } : {}),
      },
      include: {
        customer:  { select: { id: true, name: true, customerCode: true } },
        createdBy: { select: { name: true } },
        approvedBy: { select: { name: true } },
        items: true,
        _count: { select: { salesOrders: true } },
      },
      orderBy: { createdAt: "desc" },
      take: opts?.limit ?? 300,
    });
    return ok(data);
  } catch (e) { return err(errMsg(e)); }
}

export async function createQuotation(raw: unknown) {
  try {
    const actor = await guard("sales.write");
    const p = QuotationInput.safeParse(raw);
    if (!p.success) return err(p.error.errors[0].message);
    const d = p.data;

    const count = await prisma.quotation.count();
    const now = new Date();
    const quotationNumber = `QT-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${String(count + 1).padStart(4, "0")}`;

    let subtotalUsd = 0;
    const itemsData = d.items.map((i, idx) => {
      const disc = Math.round(i.quantity * i.unitPriceUsd * (i.discountPct / 100) * 100) / 100;
      const total = Math.round(i.quantity * i.unitPriceUsd * 100) / 100 - disc;
      subtotalUsd += total;
      return {
        inventoryItemId: i.inventoryItemId ?? null,
        description:     i.description,
        specification:   i.specification ?? null,
        unitOfMeasure:   i.unitOfMeasure,
        quantity:        i.quantity,
        unitPriceUsd:    i.unitPriceUsd,
        discountPct:     i.discountPct,
        totalUsd:        total,
        sortOrder:       i.sortOrder ?? idx,
      };
    });

    const totalUsd = Math.round((subtotalUsd - d.discountUsd + d.taxUsd) * 100) / 100;

    const q = await prisma.quotation.create({
      data: {
        quotationNumber,
        customerId:      d.customerId,
        leadId:          d.leadId ?? null,
        validUntil:      new Date(d.validUntil),
        currency:        d.currency,
        subtotalUsd:     Math.round(subtotalUsd * 100) / 100,
        discountUsd:     d.discountUsd,
        taxUsd:          d.taxUsd,
        totalUsd,
        notes:           d.notes ?? null,
        termsConditions: d.termsConditions ?? null,
        createdById:     actor.id,
        items:           { create: itemsData },
      },
      include: { items: true },
    });

    if (d.leadId) {
      await prisma.lead.update({ where: { id: d.leadId }, data: { stage: "QUOTATION" } }).catch(() => null);
    }
    revalidatePath("/sales/quotations");
    return ok(q);
  } catch (e) { return err(errMsg(e)); }
}

export async function updateQuotationStatus(raw: { id: number; status: "SENT" | "APPROVED" | "REJECTED" | "EXPIRED" }) {
  try {
    const actor = await guard("sales.approve");
    const q = await prisma.quotation.findUnique({ where: { id: raw.id }, select: { status: true } });
    if (!q) return err("Quotation not found");
    const updated = await prisma.quotation.update({
      where: { id: raw.id },
      data: {
        status: raw.status as never,
        approvedById: raw.status === "APPROVED" ? actor.id : undefined,
        approvedAt:   raw.status === "APPROVED" ? new Date() : undefined,
      },
    });
    revalidatePath("/sales/quotations");
    return ok(updated);
  } catch (e) { return err(errMsg(e)); }
}

export async function convertQuotationToOrder(quotationId: number) {
  try {
    const actor = await guard("sales.write");
    const q = await prisma.quotation.findUnique({
      where: { id: quotationId },
      include: { customer: true, items: true },
    });
    if (!q) return err("Quotation not found");
    if (q.status !== "APPROVED") return err("Only APPROVED quotations can be converted to orders");

    const count = await prisma.salesOrder.count();
    const now = new Date();
    const orderNumber = `SO-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${String(count + 1).padStart(4, "0")}`;

    const [order] = await prisma.$transaction([
      prisma.salesOrder.create({
        data: {
          orderNumber,
          customerId:   q.customerId,
          quotationId:  q.id,
          orderDate:    now,
          currency:     q.currency,
          totalUsd:     q.totalUsd,
          paymentTerms: q.customer.paymentTerms ?? null,
          notes:        q.notes ?? null,
          createdById:  actor.id,
          items: {
            create: q.items.map((i) => ({
              quotationItemId: i.id,
              inventoryItemId: i.inventoryItemId ?? null,
              description:     i.description,
              unitOfMeasure:   i.unitOfMeasure,
              quantity:        i.quantity,
              unitPriceUsd:    i.unitPriceUsd,
              totalUsd:        i.totalUsd,
            })),
          },
        },
      }),
      prisma.quotation.update({ where: { id: quotationId }, data: { status: "CONVERTED" } }),
    ]);

    revalidatePath("/sales/quotations");
    revalidatePath("/sales/orders");
    return ok(order);
  } catch (e) { return err(errMsg(e)); }
}

// ── Sales Orders ──────────────────────────────────────────────────────────────

const SOItemInput = z.object({
  inventoryItemId: z.coerce.number().int().positive().optional().nullable(),
  description:     z.string().min(1).max(200),
  unitOfMeasure:   z.string().min(1).max(20),
  quantity:        z.coerce.number().positive(),
  unitPriceUsd:    z.coerce.number().min(0),
});

const SalesOrderInput = z.object({
  customerId:        z.coerce.number().int().positive(),
  orderDate:         z.string().min(1),
  requestedDelivery: z.string().optional().nullable(),
  currency:          z.string().max(10).default("USD"),
  paymentTerms:      z.string().max(50).optional().nullable(),
  notes:             z.string().max(1000).optional().nullable(),
  items:             z.array(SOItemInput).min(1),
});

export async function listSalesOrders(opts?: { status?: string; customerId?: number; limit?: number }) {
  try {
    await guard("sales.read");
    const data = await prisma.salesOrder.findMany({
      where: {
        ...(opts?.status ? { status: opts.status as never } : {}),
        ...(opts?.customerId ? { customerId: opts.customerId } : {}),
      },
      include: {
        customer:  { select: { id: true, name: true, customerCode: true } },
        createdBy: { select: { name: true } },
        items:     true,
        _count:    { select: { deliveries: true } },
      },
      orderBy: { createdAt: "desc" },
      take: opts?.limit ?? 300,
    });
    return ok(data);
  } catch (e) { return err(errMsg(e)); }
}

export async function createSalesOrder(raw: unknown) {
  try {
    const actor = await guard("sales.write");
    const p = SalesOrderInput.safeParse(raw);
    if (!p.success) return err(p.error.errors[0].message);
    const d = p.data;

    const count = await prisma.salesOrder.count();
    const now = new Date();
    const orderNumber = `SO-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${String(count + 1).padStart(4, "0")}`;

    let totalUsd = 0;
    const itemsData = d.items.map((i) => {
      const t = Math.round(i.quantity * i.unitPriceUsd * 100) / 100;
      totalUsd += t;
      return {
        inventoryItemId: i.inventoryItemId ?? null,
        description:     i.description,
        unitOfMeasure:   i.unitOfMeasure,
        quantity:        i.quantity,
        unitPriceUsd:    i.unitPriceUsd,
        totalUsd:        t,
      };
    });

    const order = await prisma.salesOrder.create({
      data: {
        orderNumber,
        customerId:        d.customerId,
        orderDate:         new Date(d.orderDate),
        requestedDelivery: d.requestedDelivery ? new Date(d.requestedDelivery) : null,
        currency:          d.currency,
        totalUsd:          Math.round(totalUsd * 100) / 100,
        paymentTerms:      d.paymentTerms ?? null,
        notes:             d.notes ?? null,
        createdById:       actor.id,
        items:             { create: itemsData },
      },
      include: { items: true },
    });

    revalidatePath("/sales/orders");
    revalidatePath("/sales");
    return ok(order);
  } catch (e) { return err(errMsg(e)); }
}

export async function updateSalesOrderStatus(raw: { id: number; status: string; paymentStatus?: string }) {
  try {
    await guard("sales.write");
    const order = await prisma.salesOrder.findUnique({ where: { id: raw.id }, select: { status: true } });
    if (!order) return err("Order not found");
    const updated = await prisma.salesOrder.update({
      where: { id: raw.id },
      data: {
        status: raw.status as never,
        ...(raw.paymentStatus ? { paymentStatus: raw.paymentStatus } : {}),
      },
    });
    revalidatePath("/sales/orders");
    // Workflow: order confirmed → notify production managers
    if (raw.status === "CONFIRMED" && order.status !== "CONFIRMED") {
      void notifyRole(["OWNER", "HR_MANAGER"], {
        title: `Sales order confirmed: #${raw.id}`,
        body: `Order ${raw.id} has been confirmed and may require production scheduling or inventory allocation.`,
        level: "info", module: "sales", href: `/sales/orders`,
      }).catch(console.error);
    }
    return ok(updated);
  } catch (e) { return err(errMsg(e)); }
}

// ── Deliveries ────────────────────────────────────────────────────────────────

const DItemInput = z.object({
  orderItemId:     z.coerce.number().int().positive(),
  inventoryItemId: z.coerce.number().int().positive().optional().nullable(),
  quantity:        z.coerce.number().positive(),
});

const DeliveryInput = z.object({
  orderId:       z.coerce.number().int().positive(),
  scheduledDate: z.string().min(1),
  carrier:       z.string().max(100).optional().nullable(),
  trackingNumber: z.string().max(100).optional().nullable(),
  notes:         z.string().max(500).optional().nullable(),
  items:         z.array(DItemInput).min(1),
});

export async function listDeliveries(opts?: { status?: string; orderId?: number; days?: number }) {
  try {
    await guard("sales.read");
    const since = opts?.days ? new Date(Date.now() - opts.days * 86400000) : undefined;
    const data = await prisma.delivery.findMany({
      where: {
        ...(opts?.status ? { status: opts.status as never } : {}),
        ...(opts?.orderId ? { orderId: opts.orderId } : {}),
        ...(since ? { scheduledDate: { gte: since } } : {}),
      },
      include: {
        order:     { select: { id: true, orderNumber: true, customer: { select: { name: true } } } },
        createdBy: { select: { name: true } },
        items:     { include: { orderItem: { select: { description: true, unitOfMeasure: true } } } },
      },
      orderBy: { scheduledDate: "desc" },
      take: 300,
    });
    return ok(data);
  } catch (e) { return err(errMsg(e)); }
}

export async function createDelivery(raw: unknown) {
  try {
    const actor = await guard("sales.write");
    const p = DeliveryInput.safeParse(raw);
    if (!p.success) return err(p.error.errors[0].message);
    const d = p.data;

    const count = await prisma.delivery.count();
    const now = new Date();
    const deliveryNumber = `DN-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${String(count + 1).padStart(4, "0")}`;

    const delivery = await prisma.delivery.create({
      data: {
        deliveryNumber,
        orderId:       d.orderId,
        scheduledDate: new Date(d.scheduledDate),
        carrier:       d.carrier ?? null,
        trackingNumber: d.trackingNumber ?? null,
        notes:         d.notes ?? null,
        createdById:   actor.id,
        items: {
          create: d.items.map((i) => ({
            orderItemId:     i.orderItemId,
            inventoryItemId: i.inventoryItemId ?? null,
            quantity:        i.quantity,
          })),
        },
      },
      include: { items: true },
    });
    revalidatePath("/sales/deliveries");
    return ok(delivery);
  } catch (e) { return err(errMsg(e)); }
}

export async function updateDeliveryStatus(raw: { id: number; status: "IN_TRANSIT" | "DELIVERED" | "FAILED"; deliveredDate?: string }) {
  try {
    const actor = await guard("sales.write");
    const delivery = await prisma.delivery.findUnique({
      where: { id: raw.id },
      include: { items: { include: { inventoryItem: { select: { id: true, currentStock: true } } } } },
    });
    if (!delivery) return err("Delivery not found");

    const stockOps: ReturnType<typeof prisma.stockTransaction.create>[] = [];

    if (raw.status === "IN_TRANSIT" && delivery.status === "SCHEDULED") {
      for (const di of delivery.items) {
        if (!di.inventoryItemId || !di.inventoryItem) continue;
        const newStock = Number(di.inventoryItem.currentStock) - Number(di.quantity);
        stockOps.push(
          prisma.stockTransaction.create({
            data: {
              type:        "STOCK_OUT",
              itemId:      di.inventoryItemId,
              warehouseId: null,
              quantity:    Number(di.quantity),
              balanceAfter: Math.max(0, newStock),
              refNumber:   delivery.deliveryNumber,
              note:        `Sales delivery ${delivery.deliveryNumber}`,
              createdById: actor.id,
            },
          })
        );
        stockOps.push(
          prisma.inventoryItem.update({
            where: { id: di.inventoryItemId },
            data: { currentStock: Math.max(0, newStock) },
          }) as unknown as ReturnType<typeof prisma.stockTransaction.create>
        );
      }
    }

    const [updated] = await prisma.$transaction([
      prisma.delivery.update({
        where: { id: raw.id },
        data: {
          status:        raw.status as never,
          deliveredDate: raw.status === "DELIVERED" && raw.deliveredDate ? new Date(raw.deliveredDate) : (raw.status === "DELIVERED" ? new Date() : null),
        },
      }),
      ...stockOps,
    ]);

    // If all deliveries for the order are DELIVERED, mark order DELIVERED
    if (raw.status === "DELIVERED") {
      const allDeliveries = await prisma.delivery.findMany({ where: { orderId: delivery.orderId }, select: { status: true } });
      const allDone = allDeliveries.every((d) => d.status === "DELIVERED");
      if (allDone) {
        await prisma.salesOrder.update({ where: { id: delivery.orderId }, data: { status: "DELIVERED" } }).catch(() => null);
      }
    }

    revalidatePath("/sales/deliveries");
    revalidatePath("/sales/orders");
    revalidatePath("/inventory");
    return ok(updated);
  } catch (e) { return err(errMsg(e)); }
}

// ── Sales Summary ─────────────────────────────────────────────────────────────

export async function getSalesSummary() {
  try {
    await guard("sales.read");

    const today      = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const last6mo    = new Date(today.getFullYear(), today.getMonth() - 5, 1);

    const [
      totalCustomers,
      activeLeads,
      pendingQuotations,
      activeOrders,
      revenueThisMonth,
      outstandingDeliveries,
      topCustomers,
      quotationsByStatus,
      ordersByStatus,
      recentOrders,
      recentLeads,
      monthlyRevenue,
    ] = await Promise.all([
      prisma.customer.count({ where: { status: "ACTIVE" } }),
      prisma.lead.count({ where: { stage: { notIn: ["WON", "LOST"] } } }),
      prisma.quotation.count({ where: { status: { in: ["DRAFT", "SENT"] } } }),
      prisma.salesOrder.count({ where: { status: { in: ["CONFIRMED", "IN_PRODUCTION", "READY"] } } }),
      prisma.salesOrder.aggregate({
        where: { orderDate: { gte: monthStart }, status: { notIn: ["DRAFT", "CANCELLED"] } },
        _sum: { totalUsd: true },
      }),
      prisma.delivery.count({ where: { status: { in: ["SCHEDULED", "IN_TRANSIT"] } } }),
      prisma.salesOrder.groupBy({
        by: ["customerId"],
        where: { status: { notIn: ["DRAFT", "CANCELLED"] } },
        _sum: { totalUsd: true },
        _count: { id: true },
        orderBy: { _sum: { totalUsd: "desc" } },
        take: 5,
      }),
      prisma.quotation.groupBy({ by: ["status"], _count: { id: true }, _sum: { totalUsd: true } }),
      prisma.salesOrder.groupBy({ by: ["status"], _count: { id: true }, _sum: { totalUsd: true } }),
      prisma.salesOrder.findMany({
        take: 8, orderBy: { createdAt: "desc" },
        include: { customer: { select: { name: true } }, createdBy: { select: { name: true } } },
      }),
      prisma.lead.findMany({
        take: 8, orderBy: { createdAt: "desc" },
        include: { customer: { select: { name: true } }, assignedTo: { select: { name: true } } },
      }),
      prisma.salesOrder.findMany({
        where: { orderDate: { gte: last6mo }, status: { notIn: ["DRAFT", "CANCELLED"] } },
        select: { orderDate: true, totalUsd: true },
      }),
    ]);

    // Build monthly revenue trend
    const trendMap: Record<string, number> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      trendMap[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`] = 0;
    }
    for (const o of monthlyRevenue) {
      const k = `${o.orderDate.getFullYear()}-${String(o.orderDate.getMonth() + 1).padStart(2, "0")}`;
      if (k in trendMap) trendMap[k] += Number(o.totalUsd);
    }
    const revenueTrend = Object.entries(trendMap).map(([month, amount]) => ({ month, amount: Math.round(amount * 100) / 100 }));

    // Resolve top customer names
    const customerIds = topCustomers.map((c) => c.customerId);
    const customerMap = await prisma.customer.findMany({
      where: { id: { in: customerIds } },
      select: { id: true, name: true, customerCode: true },
    }).then((rows) => new Map(rows.map((r) => [r.id, r])));

    return ok({
      totalCustomers,
      activeLeads,
      pendingQuotations,
      activeOrders,
      revenueThisMonth: Math.round(Number(revenueThisMonth._sum.totalUsd ?? 0) * 100) / 100,
      outstandingDeliveries,
      revenueTrend,
      topCustomers: topCustomers.map((c) => {
        const cust = customerMap.get(c.customerId);
        return {
          id: c.customerId, name: cust?.name ?? "Unknown",
          customerCode: cust?.customerCode ?? "",
          totalUsd: Math.round(Number(c._sum.totalUsd ?? 0) * 100) / 100,
          orderCount: c._count.id,
        };
      }),
      quotationsByStatus: quotationsByStatus.map((r) => ({
        status: r.status, count: r._count.id,
        totalUsd: Math.round(Number(r._sum.totalUsd ?? 0) * 100) / 100,
      })),
      ordersByStatus: ordersByStatus.map((r) => ({
        status: r.status, count: r._count.id,
        totalUsd: Math.round(Number(r._sum.totalUsd ?? 0) * 100) / 100,
      })),
      recentOrders: recentOrders.map((o) => ({
        id: o.id, orderNumber: o.orderNumber, customerName: o.customer.name,
        status: o.status, totalUsd: Number(o.totalUsd),
        orderDate: o.orderDate.toISOString(), createdBy: o.createdBy.name,
        paymentStatus: o.paymentStatus,
      })),
      recentLeads: recentLeads.map((l) => ({
        id: l.id, contactName: l.contactName, companyName: l.companyName,
        source: l.source, stage: l.stage,
        estimatedValueUsd: l.estimatedValueUsd !== null ? Number(l.estimatedValueUsd) : null,
        assignedToName: l.assignedTo?.name ?? null,
        createdAt: l.createdAt.toISOString(),
      })),
    });
  } catch (e) { return err(errMsg(e)); }
}

export async function getSalesExecutiveSummary() {
  try {
    const today      = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const weekEnd    = new Date(today); weekEnd.setDate(today.getDate() + 7);

    const [revenueThisMonth, activeOrders, pendingQuotations, deliveriesThisWeek] = await Promise.all([
      prisma.salesOrder.aggregate({
        where: { orderDate: { gte: monthStart }, status: { notIn: ["DRAFT", "CANCELLED"] } },
        _sum: { totalUsd: true },
      }),
      prisma.salesOrder.count({ where: { status: { in: ["CONFIRMED", "IN_PRODUCTION", "READY"] } } }),
      prisma.quotation.count({ where: { status: { in: ["DRAFT", "SENT"] } } }),
      prisma.delivery.count({ where: { scheduledDate: { lte: weekEnd }, status: { in: ["SCHEDULED", "IN_TRANSIT"] } } }),
    ]);

    return ok({
      revenueThisMonth: Math.round(Number(revenueThisMonth._sum.totalUsd ?? 0) * 100) / 100,
      activeOrders,
      pendingQuotations,
      deliveriesThisWeek,
    });
  } catch (e) { return err(errMsg(e)); }
}
