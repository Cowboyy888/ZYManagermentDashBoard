"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";

const PAGE_SIZE = 20;

export type AuditEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  user: { name: string; email: string } | null;
  before: unknown;
  after: unknown;
};

export type AuditResult = {
  logs: AuditEntry[];
  total: number;
  page: number;
};

export async function getAuditLogs(opts?: {
  page?: number;
  search?: string;
  entityType?: string;
}): Promise<AuditResult> {
  try {
    const actor = await requireUser();
    if (!can(actor.role, "audit.view")) {
      return { logs: [], total: 0, page: 1 };
    }

    const page = Math.max(1, opts?.page ?? 1);
    const skip = (page - 1) * PAGE_SIZE;
    const search = opts?.search?.trim();
    const entityType = opts?.entityType?.trim();

    const where: Record<string, unknown> = {};

    if (entityType) {
      where.entityType = entityType;
    }

    if (search) {
      where.OR = [
        { action: { contains: search, mode: "insensitive" } },
        { entityId: { contains: search, mode: "insensitive" } },
        { ip: { contains: search, mode: "insensitive" } },
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [rows, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: PAGE_SIZE,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          action: true,
          entityType: true,
          entityId: true,
          ip: true,
          userAgent: true,
          createdAt: true,
          before: true,
          after: true,
          user: { select: { name: true, email: true } },
        },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs: rows.map((r) => ({
        ...r,
        id: r.id.toString(),
        createdAt: r.createdAt.toISOString(),
        user: r.user ? { name: r.user.name ?? "", email: r.user.email } : null,
      })),
      total,
      page,
    };
  } catch {
    return { logs: [], total: 0, page: 1 };
  }
}
