"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "../lib/db";
import { guard } from "../lib/auth/session";

function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Unexpected error";
}
function ok<T>(data: T) { return { ok: true as const, data }; }
function err(error: string) { return { ok: false as const, error }; }

export async function getNotifications(opts?: { unreadOnly?: boolean; limit?: number }) {
  try {
    const session = await guard("notification.read");
    const rows = await prisma.notification.findMany({
      where: {
        userId: session.id,
        ...(opts?.unreadOnly ? { read: false } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: opts?.limit ?? 50,
    });
    return ok(rows.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      level: n.level,
      module: n.module,
      href: n.href,
      read: n.read,
      createdAt: n.createdAt.toISOString(),
    })));
  } catch (e) { return err(errMsg(e)); }
}

export async function getUnreadCount(): Promise<number> {
  try {
    const session = await guard("notification.read");
    return await prisma.notification.count({
      where: { userId: session.id, read: false },
    });
  } catch { return 0; }
}

export async function markRead(id: number) {
  try {
    const session = await guard("notification.read");
    await prisma.notification.updateMany({
      where: { id, userId: session.id },
      data: { read: true, readAt: new Date() },
    });
    revalidatePath("/notifications");
    return ok(null);
  } catch (e) { return err(errMsg(e)); }
}

export async function markAllRead() {
  try {
    const session = await guard("notification.read");
    await prisma.notification.updateMany({
      where: { userId: session.id, read: false },
      data: { read: true, readAt: new Date() },
    });
    revalidatePath("/notifications");
    return ok(null);
  } catch (e) { return err(errMsg(e)); }
}

export async function deleteNotification(id: number) {
  try {
    const session = await guard("notification.read");
    await prisma.notification.deleteMany({
      where: { id, userId: session.id },
    });
    revalidatePath("/notifications");
    return ok(null);
  } catch (e) { return err(errMsg(e)); }
}

export async function clearAllRead() {
  try {
    const session = await guard("notification.read");
    await prisma.notification.deleteMany({
      where: { userId: session.id, read: true },
    });
    revalidatePath("/notifications");
    return ok(null);
  } catch (e) { return err(errMsg(e)); }
}
