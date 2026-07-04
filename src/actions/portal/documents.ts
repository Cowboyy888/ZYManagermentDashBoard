"use server";
import { prisma } from "@/lib/db";
import { requirePortalUser } from "@/lib/auth/portal";

type AR<T> = { ok: true; data: T } | { ok: false; error: string };
function ok<T>(data: T): AR<T> { return { ok: true, data }; }
function err(e: unknown): AR<never> {
  return { ok: false, error: e instanceof Error ? e.message : String(e) };
}

export type DocumentType =
  | "QUOTATION"
  | "SALES_ORDER"
  | "INVOICE"
  | "CERTIFICATE"
  | "PURCHASE_ORDER"
  | "DELIVERY";

export async function logDocumentDownload(
  documentType: DocumentType,
  documentId: number
): Promise<AR<undefined>> {
  try {
    const u = await requirePortalUser();
    await prisma.portalDocumentLog.create({
      data: { userId: u.id, documentType, documentId },
    });
    return ok(undefined);
  } catch (e) {
    return err(e);
  }
}

export async function getMyDownloadHistory() {
  try {
    const u = await requirePortalUser();
    const logs = await prisma.portalDocumentLog.findMany({
      where: { userId: u.id },
      orderBy: { downloadedAt: "desc" },
      take: 100,
    });
    return ok(logs);
  } catch (e) {
    return err(e);
  }
}
