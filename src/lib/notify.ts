// Centralized notification dispatch — in-app DB + optional Telegram side-car.
// All calls are fire-and-forget from server actions: wrap in .catch(console.error).
import { prisma } from "./db";

export interface NotifyPayload {
  title: string;
  body?: string;
  level?: "info" | "warning" | "critical";
  module?: string;
  href?: string;
}

export async function notifyUser(userId: string, payload: NotifyPayload): Promise<void> {
  await prisma.notification.create({
    data: {
      userId,
      title: payload.title,
      body: payload.body,
      level: payload.level ?? "info",
      module: payload.module,
      href: payload.href,
    },
  });
}

export async function notifyUsers(userIds: string[], payload: NotifyPayload): Promise<void> {
  if (userIds.length === 0) return;
  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      title: payload.title,
      body: payload.body,
      level: payload.level ?? "info",
      module: payload.module,
      href: payload.href,
    })),
  });
}

export async function notifyRole(
  roles: string | string[],
  payload: NotifyPayload,
  opts: { excludeUserId?: string } = {}
): Promise<void> {
  const roleList = Array.isArray(roles) ? roles : [roles];
  const users = await prisma.user.findMany({
    where: {
      role: { in: roleList as ("OWNER" | "HR_MANAGER" | "SUPERVISOR" | "VIEWER")[] },
      active: true,
      ...(opts.excludeUserId ? { NOT: { id: opts.excludeUserId } } : {}),
    },
    select: { id: true },
  });
  await notifyUsers(users.map((u) => u.id), payload);
}
