"use server";
import { prisma } from "@/lib/db";
import { requireCustomerUser } from "@/lib/auth/portal";
import { notifyRole } from "@/lib/notify";

type AR<T> = { ok: true; data: T } | { ok: false; error: string };
function ok<T>(data: T): AR<T> { return { ok: true, data }; }
function err(e: unknown): AR<never> {
  return { ok: false, error: e instanceof Error ? e.message : String(e) };
}

export async function getCustomerTickets(page = 1) {
  try {
    const u = await requireCustomerUser();
    const take = 20;
    const skip = (page - 1) * take;
    const [items, total] = await Promise.all([
      prisma.supportTicket.findMany({
        where: { customerId: u.customerId },
        orderBy: { createdAt: "desc" },
        skip, take,
        select: {
          id: true, ticketNumber: true, subject: true, status: true, priority: true,
          createdAt: true, resolvedAt: true,
          _count: { select: { messages: true } },
        },
      }),
      prisma.supportTicket.count({ where: { customerId: u.customerId } }),
    ]);
    return ok({ items, total, page });
  } catch (e) {
    return err(e);
  }
}

export async function getTicketDetail(id: number) {
  try {
    const u = await requireCustomerUser();
    const ticket = await prisma.supportTicket.findFirst({
      where: { id, customerId: u.customerId },
      include: {
        messages: {
          where: { isInternal: false },
          orderBy: { createdAt: "asc" },
          include: { sender: { select: { id: true, name: true, role: true } } },
        },
        assignedTo: { select: { name: true } },
      },
    });
    if (!ticket) return { ok: false, error: "Not found" } as const;
    return ok(ticket);
  } catch (e) {
    return err(e);
  }
}

export async function createSupportTicket(input: {
  subject: string;
  body: string;
  priority?: "LOW" | "NORMAL" | "HIGH" | "URGENT";
}): Promise<AR<{ ticketId: number }>> {
  try {
    const u = await requireCustomerUser();
    const count = await prisma.supportTicket.count();
    const ticketNumber = `TKT-${String(count + 1).padStart(5, "0")}`;

    const ticket = await prisma.supportTicket.create({
      data: {
        ticketNumber,
        customerId: u.customerId,
        subject: input.subject,
        priority: input.priority ?? "NORMAL",
        status: "OPEN",
        createdById: u.id,
        messages: {
          create: {
            senderUserId: u.id,
            body: input.body,
            isInternal: false,
          },
        },
      },
    });

    void notifyRole(["OWNER", "HR_MANAGER"], {
      title: `New support ticket: ${input.subject}`,
      body: `From ${u.companyName} — Priority: ${input.priority ?? "NORMAL"}`,
      level: input.priority === "URGENT" || input.priority === "HIGH" ? "warning" : "info",
      module: "portal",
      href: `/portal/admin/tickets/${ticket.id}`,
    }).catch(console.error);

    return ok({ ticketId: ticket.id });
  } catch (e) {
    return err(e);
  }
}

export async function replyToTicket(ticketId: number, body: string): Promise<AR<undefined>> {
  try {
    const u = await requireCustomerUser();
    const ticket = await prisma.supportTicket.findFirst({
      where: { id: ticketId, customerId: u.customerId },
    });
    if (!ticket) return { ok: false, error: "Not found" };
    if (ticket.status === "CLOSED") return { ok: false, error: "Ticket is closed." };

    await prisma.supportTicketMessage.create({
      data: { ticketId, senderUserId: u.id, body, isInternal: false },
    });

    void notifyRole(["OWNER", "HR_MANAGER"], {
      title: `Ticket reply from ${u.companyName}`,
      body: body.slice(0, 100),
      level: "info",
      module: "portal",
      href: `/portal/admin/tickets/${ticketId}`,
    }).catch(console.error);

    return ok(undefined);
  } catch (e) {
    return err(e);
  }
}
