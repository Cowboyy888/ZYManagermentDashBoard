"use server";
import { prisma } from "@/lib/db";
import { guard } from "@/lib/auth/session";
import type { TicketStatus } from "@prisma/client";

type AR<T> = { ok: true; data: T } | { ok: false; error: string };
function ok<T>(data: T): AR<T> { return { ok: true, data }; }
function err(e: unknown): AR<never> {
  return { ok: false, error: e instanceof Error ? e.message : String(e) };
}

export async function getPortalOverview() {
  try {
    await guard("portal.manage");
    const [
      totalCustomerPortal, pendingCustomerPortal, activeCustomerPortal,
      totalSupplierPortal, pendingSupplierPortal, activeSupplierPortal,
      openTickets, openThreads, pendingQuotationResponses, pendingPOResponses,
    ] = await Promise.all([
      prisma.portalAccount.count({ where: { portalType: "CUSTOMER" } }),
      prisma.portalAccount.count({ where: { portalType: "CUSTOMER", status: "PENDING" } }),
      prisma.portalAccount.count({ where: { portalType: "CUSTOMER", status: "ACTIVE" } }),
      prisma.portalAccount.count({ where: { portalType: "SUPPLIER" } }),
      prisma.portalAccount.count({ where: { portalType: "SUPPLIER", status: "PENDING" } }),
      prisma.portalAccount.count({ where: { portalType: "SUPPLIER", status: "ACTIVE" } }),
      prisma.supportTicket.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
      prisma.portalThread.count({ where: { status: "OPEN" } }),
      prisma.quotation.count({ where: { status: "SENT", portalAcceptedAt: null, portalRejectedAt: null } }),
      prisma.purchaseOrder.count({ where: { status: "APPROVED", supplierAcceptedAt: null, supplierRejectedAt: null } }),
    ]);

    return ok({
      customers: { total: totalCustomerPortal, pending: pendingCustomerPortal, active: activeCustomerPortal },
      suppliers: { total: totalSupplierPortal, pending: pendingSupplierPortal, active: activeSupplierPortal },
      openTickets, openThreads, pendingQuotationResponses, pendingPOResponses,
    });
  } catch (e) {
    return err(e);
  }
}

export async function listPortalAccounts(type: "CUSTOMER" | "SUPPLIER") {
  try {
    await guard("portal.manage");
    const accounts = await prisma.portalAccount.findMany({
      where: { portalType: type },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { name: true, email: true, active: true } },
        customer: { select: { name: true, customerCode: true, status: true } },
        supplier: { select: { name: true, supplierCode: true, status: true } },
      },
    });
    return ok(accounts);
  } catch (e) {
    return err(e);
  }
}

export async function setPortalAccountStatus(
  id: number,
  status: "ACTIVE" | "SUSPENDED" | "PENDING"
): Promise<AR<undefined>> {
  try {
    await guard("portal.manage");
    await prisma.portalAccount.update({
      where: { id },
      data: { status, approvedAt: status === "ACTIVE" ? new Date() : undefined },
    });
    return ok(undefined);
  } catch (e) {
    return err(e);
  }
}

export async function listAdminTickets(status?: TicketStatus) {
  try {
    await guard("portal.manage");
    const tickets = await prisma.supportTicket.findMany({
      where: { status: status ?? { in: ["OPEN", "IN_PROGRESS"] as const } },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      take: 100,
      include: {
        customer: { select: { name: true } },
        createdBy: { select: { name: true } },
        assignedTo: { select: { name: true } },
        _count: { select: { messages: true } },
      },
    });
    return ok(tickets);
  } catch (e) {
    return err(e);
  }
}

export async function replyToTicketAsStaff(ticketId: number, body: string, isInternal = false): Promise<AR<undefined>> {
  try {
    const actor = await guard("portal.manage");
    await prisma.supportTicketMessage.create({
      data: { ticketId, senderUserId: actor.id, body, isInternal },
    });
    return ok(undefined);
  } catch (e) {
    return err(e);
  }
}

export async function closeTicket(ticketId: number): Promise<AR<undefined>> {
  try {
    await guard("portal.manage");
    await prisma.supportTicket.update({
      where: { id: ticketId },
      data: { status: "CLOSED", resolvedAt: new Date() },
    });
    return ok(undefined);
  } catch (e) {
    return err(e);
  }
}

export async function createSupplierPortalAccount(input: {
  name: string;
  email: string;
  password: string;
  supplierId: number;
}): Promise<AR<undefined>> {
  try {
    await guard("portal.manage");
    const { auth } = await import("@/lib/auth/config");
    const res = await auth.api.signUpEmail({
      body: { email: input.email, password: input.password, name: input.name, role: "SUPPLIER_PORTAL" },
    });
    if (!res?.user?.id) return { ok: false, error: "Failed to create user." };
    await prisma.portalAccount.create({
      data: {
        userId: res.user.id,
        portalType: "SUPPLIER",
        supplierId: input.supplierId,
        status: "ACTIVE",
        approvedAt: new Date(),
      },
    });
    return ok(undefined);
  } catch (e) {
    return err(e);
  }
}
