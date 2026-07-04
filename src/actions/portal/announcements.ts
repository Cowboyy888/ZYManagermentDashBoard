"use server";
import { prisma } from "@/lib/db";
import { requirePortalUser } from "@/lib/auth/portal";
import { guard } from "@/lib/auth/session";

type AR<T> = { ok: true; data: T } | { ok: false; error: string };
function ok<T>(data: T): AR<T> { return { ok: true, data }; }
function err(e: unknown): AR<never> {
  return { ok: false, error: e instanceof Error ? e.message : String(e) };
}

export async function getPortalAnnouncements() {
  try {
    const u = await requirePortalUser();
    const targetType = u.role === "CUSTOMER_PORTAL"
      ? { in: ["ALL", "CUSTOMERS"] as ("ALL" | "CUSTOMERS" | "SUPPLIERS")[] }
      : { in: ["ALL", "SUPPLIERS"] as ("ALL" | "CUSTOMERS" | "SUPPLIERS")[] };

    const announcements = await prisma.portalAnnouncement.findMany({
      where: {
        targetType,
        publishedAt: { lte: new Date() },
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { publishedAt: "desc" },
      take: 50,
      select: { id: true, title: true, body: true, targetType: true, publishedAt: true, expiresAt: true },
    });
    return ok(announcements);
  } catch (e) {
    return err(e);
  }
}

// Internal: create / manage announcements

export async function listAnnouncements() {
  try {
    await guard("portal.manage");
    const rows = await prisma.portalAnnouncement.findMany({
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select: { name: true } } },
    });
    return ok(rows);
  } catch (e) {
    return err(e);
  }
}

export async function createAnnouncement(input: {
  title: string;
  body: string;
  targetType: "ALL" | "CUSTOMERS" | "SUPPLIERS";
  publishedAt?: string;
  expiresAt?: string;
}): Promise<AR<undefined>> {
  try {
    const actor = await guard("portal.manage");
    await prisma.portalAnnouncement.create({
      data: {
        title: input.title,
        body: input.body,
        targetType: input.targetType,
        publishedAt: input.publishedAt ? new Date(input.publishedAt) : new Date(),
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        createdById: actor.id,
      },
    });
    return ok(undefined);
  } catch (e) {
    return err(e);
  }
}

export async function deleteAnnouncement(id: number): Promise<AR<undefined>> {
  try {
    await guard("portal.manage");
    await prisma.portalAnnouncement.delete({ where: { id } });
    return ok(undefined);
  } catch (e) {
    return err(e);
  }
}
