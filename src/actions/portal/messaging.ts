"use server";
import { prisma } from "@/lib/db";
import { requirePortalUser } from "@/lib/auth/portal";
import { notifyRole } from "@/lib/notify";

type AR<T> = { ok: true; data: T } | { ok: false; error: string };
function ok<T>(data: T): AR<T> { return { ok: true, data }; }
function err(e: unknown): AR<never> {
  return { ok: false, error: e instanceof Error ? e.message : String(e) };
}

export async function getPortalThreads() {
  try {
    const u = await requirePortalUser();
    const where = u.role === "CUSTOMER_PORTAL"
      ? { customerId: { not: null as number | null } }
      : { supplierId: { not: null as number | null } };
    // Filter to threads belonging to this user's company
    const ownWhere = u.role === "CUSTOMER_PORTAL"
      ? { customerId: u.customerId! }
      : { supplierId: u.supplierId! };

    const threads = await prisma.portalThread.findMany({
      where: ownWhere,
      orderBy: { lastMessageAt: "desc" },
      take: 50,
      select: {
        id: true, subject: true, type: true, status: true, lastMessageAt: true, createdAt: true,
        _count: { select: { messages: true } },
      },
    });
    return ok(threads);
  } catch (e) {
    return err(e);
  }
}

export async function getPortalThread(threadId: number) {
  try {
    const u = await requirePortalUser();
    const ownWhere = u.role === "CUSTOMER_PORTAL"
      ? { customerId: u.customerId! }
      : { supplierId: u.supplierId! };

    const thread = await prisma.portalThread.findFirst({
      where: { id: threadId, ...ownWhere },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          include: { sender: { select: { id: true, name: true, role: true } } },
        },
      },
    });
    if (!thread) return { ok: false, error: "Not found" } as const;
    return ok(thread);
  } catch (e) {
    return err(e);
  }
}

export async function createPortalThread(input: {
  subject: string;
  type?: "SALES" | "PURCHASING" | "SUPPORT" | "GENERAL";
  body: string;
}): Promise<AR<{ threadId: number }>> {
  try {
    const u = await requirePortalUser();
    const threadData = u.role === "CUSTOMER_PORTAL"
      ? { customerId: u.customerId, supplierId: null }
      : { supplierId: u.supplierId, customerId: null };

    const thread = await prisma.portalThread.create({
      data: {
        subject: input.subject,
        type: input.type ?? "GENERAL",
        ...threadData,
        status: "OPEN",
        lastMessageAt: new Date(),
        createdById: u.id,
        messages: {
          create: { senderUserId: u.id, body: input.body },
        },
      },
    });

    void notifyRole(["OWNER", "HR_MANAGER"], {
      title: `New portal message: ${input.subject}`,
      body: `From ${u.companyName}`,
      level: "info",
      module: "portal",
      href: `/portal/admin/threads/${thread.id}`,
    }).catch(console.error);

    return ok({ threadId: thread.id });
  } catch (e) {
    return err(e);
  }
}

export async function sendPortalMessage(threadId: number, body: string): Promise<AR<undefined>> {
  try {
    const u = await requirePortalUser();
    const ownWhere = u.role === "CUSTOMER_PORTAL"
      ? { customerId: u.customerId! }
      : { supplierId: u.supplierId! };

    const thread = await prisma.portalThread.findFirst({
      where: { id: threadId, ...ownWhere },
    });
    if (!thread) return { ok: false, error: "Not found" };
    if (thread.status === "CLOSED") return { ok: false, error: "Thread is closed." };

    await prisma.portalThread.update({
      where: { id: threadId },
      data: {
        lastMessageAt: new Date(),
        messages: { create: { senderUserId: u.id, body } },
      },
    });

    void notifyRole(["OWNER", "HR_MANAGER"], {
      title: `New reply from ${u.companyName}`,
      body: body.slice(0, 100),
      level: "info",
      module: "portal",
      href: `/portal/admin/threads/${threadId}`,
    }).catch(console.error);

    return ok(undefined);
  } catch (e) {
    return err(e);
  }
}
