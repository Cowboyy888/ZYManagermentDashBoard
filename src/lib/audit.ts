// Audit trail writer (product story: every change attributable).
// Called by Server Actions after a successful mutation.
import { prisma } from "./db";

export async function writeAudit(params: {
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string | number;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
}): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: params.userId ?? undefined,
      action: params.action,
      entityType: params.entityType,
      entityId: String(params.entityId),
      before: params.before === undefined ? undefined : (params.before as object),
      after: params.after === undefined ? undefined : (params.after as object),
      ip: params.ip ?? undefined,
    },
  });
}
