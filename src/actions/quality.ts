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

// ── Number generators ──────────────────────────────────────────────────────────

async function nextInspectionNumber() {
  const count = await prisma.qualityInspection.count();
  const now = new Date();
  return `QI-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${String(count + 1).padStart(4, "0")}`;
}
async function nextNCRNumber() {
  const count = await prisma.nonConformance.count();
  const now = new Date();
  return `NCR-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${String(count + 1).padStart(4, "0")}`;
}
async function nextCertNumber(type: string) {
  const count = await prisma.qualityCertificate.count();
  const now = new Date();
  const prefix = type === "COC" ? "COC" : type === "TEST_REPORT" ? "TR" : "IC";
  return `${prefix}-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-${String(count + 1).padStart(4, "0")}`;
}

// ── Quality Inspections ───────────────────────────────────────────────────────

const TestResultInput = z.object({
  parameter:     z.string().min(1).max(100),
  unit:          z.string().max(20).optional().nullable(),
  specMin:       z.coerce.number().optional().nullable(),
  specMax:       z.coerce.number().optional().nullable(),
  measuredValue: z.coerce.number().optional().nullable(),
  result:        z.enum(["PASS", "FAIL", "REWORK"]).optional().nullable(),
  notes:         z.string().max(300).optional().nullable(),
});

const InspectionInput = z.object({
  type:               z.enum(["INCOMING", "IN_PROCESS", "FINAL"]),
  productionOrderId:  z.coerce.number().int().positive().optional().nullable(),
  inventoryItemId:    z.coerce.number().int().positive().optional().nullable(),
  salesOrderId:       z.coerce.number().int().positive().optional().nullable(),
  batchNumber:        z.string().max(60).optional().nullable(),
  productDescription: z.string().max(200).optional().nullable(),
  sampleSize:         z.coerce.number().int().positive().default(1),
  defectCount:        z.coerce.number().int().min(0).default(0),
  result:             z.enum(["PASS", "FAIL", "REWORK"]).optional().nullable(),
  inspectorId:        z.coerce.number().int().positive().optional().nullable(),
  inspectionDate:     z.string().min(1),
  remarks:            z.string().max(1000).optional().nullable(),
  testResults:        z.array(TestResultInput).default([]),
});

export async function listInspections(opts?: { type?: string; status?: string; days?: number; limit?: number }) {
  try {
    await guard("quality.read");
    const since = opts?.days ? new Date(Date.now() - opts.days * 86400000) : undefined;
    const data = await prisma.qualityInspection.findMany({
      where: {
        ...(opts?.type   ? { type:   opts.type as never }   : {}),
        ...(opts?.status ? { status: opts.status as never } : {}),
        ...(since ? { inspectionDate: { gte: since } } : {}),
      },
      include: {
        inspector:       { select: { id: true, nameEn: true } },
        productionOrder: { select: { id: true, orderCode: true } },
        inventoryItem:   { select: { id: true, name: true, itemCode: true } },
        salesOrder:      { select: { id: true, orderNumber: true } },
        testResults:     true,
        _count: { select: { nonConformances: true, certificates: true } },
      },
      orderBy: { inspectionDate: "desc" },
      take: opts?.limit ?? 300,
    });
    return ok(data);
  } catch (e) { return err(errMsg(e)); }
}

export async function createInspection(raw: unknown) {
  try {
    const actor = await guard("quality.write");
    const p = InspectionInput.safeParse(raw);
    if (!p.success) return err(p.error.errors[0].message);
    const d = p.data;
    if (d.defectCount > d.sampleSize) return err("Defect count cannot exceed sample size");

    const inspectionNumber = await nextInspectionNumber();

    const inspection = await prisma.qualityInspection.create({
      data: {
        inspectionNumber,
        type:               d.type,
        status:             "IN_PROGRESS",
        productionOrderId:  d.productionOrderId ?? null,
        inventoryItemId:    d.inventoryItemId ?? null,
        salesOrderId:       d.salesOrderId ?? null,
        batchNumber:        d.batchNumber ?? null,
        productDescription: d.productDescription ?? null,
        sampleSize:         d.sampleSize,
        defectCount:        d.defectCount,
        result:             d.result ?? null,
        inspectorId:        d.inspectorId ?? null,
        inspectionDate:     new Date(d.inspectionDate),
        remarks:            d.remarks ?? null,
        createdById:        actor.id,
        testResults: {
          create: d.testResults.map((t) => ({
            parameter:     t.parameter,
            unit:          t.unit ?? null,
            specMin:       t.specMin ?? null,
            specMax:       t.specMax ?? null,
            measuredValue: t.measuredValue ?? null,
            result:        t.result ?? null,
            notes:         t.notes ?? null,
          })),
        },
      },
      include: { testResults: true },
    });

    revalidatePath("/quality/inspections");
    revalidatePath("/quality");
    return ok(inspection);
  } catch (e) { return err(errMsg(e)); }
}

export async function updateInspectionStatus(raw: { id: number; status: string; result?: string }) {
  try {
    await guard("quality.write");
    const insp = await prisma.qualityInspection.findUnique({ where: { id: raw.id }, select: { id: true } });
    if (!insp) return err("Inspection not found");
    const updated = await prisma.qualityInspection.update({
      where: { id: raw.id },
      data: {
        status: raw.status as never,
        result: raw.result ? raw.result as never : undefined,
      },
    });
    revalidatePath("/quality/inspections");
    revalidatePath("/quality");
    // Workflow: failed inspection → notify production + quality managers
    if (raw.result === "FAIL" || raw.status === "FAILED") {
      void notifyRole(["OWNER", "HR_MANAGER"], {
        title: `Quality inspection failed: #${insp.id}`,
        body: `Inspection ${raw.id} has been marked as FAILED. A Non-Conformance Report may be required.`,
        level: "critical", module: "quality", href: `/quality/inspections`,
      }).catch(console.error);
    }
    return ok(updated);
  } catch (e) { return err(errMsg(e)); }
}

// ── Non-Conformance Reports ────────────────────────────────────────────────────

const NCRInput = z.object({
  inspectionId:      z.coerce.number().int().positive().optional().nullable(),
  defectType:        z.string().min(1).max(100),
  defectDescription: z.string().max(500).optional().nullable(),
  severity:          z.enum(["MINOR", "MAJOR", "CRITICAL"]).default("MINOR"),
  rootCause:         z.string().max(500).optional().nullable(),
  responsibleId:     z.coerce.number().int().positive().optional().nullable(),
  dueDate:           z.string().optional().nullable(),
});

export async function listNCRs(opts?: { status?: string; limit?: number }) {
  try {
    await guard("quality.read");
    const data = await prisma.nonConformance.findMany({
      where: opts?.status ? { status: opts.status as never } : undefined,
      include: {
        inspection:  { select: { id: true, inspectionNumber: true, type: true } },
        responsible: { select: { id: true, nameEn: true } },
        createdBy:   { select: { name: true } },
        _count: { select: { correctiveActions: true } },
      },
      orderBy: { createdAt: "desc" },
      take: opts?.limit ?? 300,
    });
    return ok(data);
  } catch (e) { return err(errMsg(e)); }
}

export async function createNCR(raw: unknown) {
  try {
    const actor = await guard("quality.write");
    const p = NCRInput.safeParse(raw);
    if (!p.success) return err(p.error.errors[0].message);
    const d = p.data;
    const ncrNumber = await nextNCRNumber();
    const ncr = await prisma.nonConformance.create({
      data: {
        ncrNumber,
        inspectionId:      d.inspectionId ?? null,
        defectType:        d.defectType,
        defectDescription: d.defectDescription ?? null,
        severity:          d.severity,
        rootCause:         d.rootCause ?? null,
        responsibleId:     d.responsibleId ?? null,
        dueDate:           d.dueDate ? new Date(d.dueDate) : null,
        createdById:       actor.id,
      },
    });
    revalidatePath("/quality/ncr");
    revalidatePath("/quality");
    return ok(ncr);
  } catch (e) { return err(errMsg(e)); }
}

export async function updateNCR(raw: unknown) {
  try {
    await guard("quality.write");
    const p = NCRInput.extend({ id: z.coerce.number().int().positive() }).safeParse(raw);
    if (!p.success) return err(p.error.errors[0].message);
    const { id, inspectionId, defectType, defectDescription, severity, rootCause, responsibleId, dueDate } = p.data;
    const ncr = await prisma.nonConformance.update({
      where: { id },
      data: {
        inspectionId:      inspectionId ?? null,
        defectType, defectDescription: defectDescription ?? null,
        severity, rootCause: rootCause ?? null,
        responsibleId:     responsibleId ?? null,
        dueDate:           dueDate ? new Date(dueDate) : null,
      },
    });
    revalidatePath("/quality/ncr");
    return ok(ncr);
  } catch (e) { return err(errMsg(e)); }
}

export async function updateNCRStatus(raw: { id: number; status: string }) {
  try {
    const actor = await guard("quality.approve");
    const ncr = await prisma.nonConformance.findUnique({ where: { id: raw.id }, select: { id: true } });
    if (!ncr) return err("NCR not found");
    const updated = await prisma.nonConformance.update({
      where: { id: raw.id },
      data: {
        status: raw.status as never,
        closedAt:   ["CLOSED", "CANCELLED"].includes(raw.status) ? new Date() : null,
        closedById: ["CLOSED", "CANCELLED"].includes(raw.status) ? actor.id : null,
      },
    });
    revalidatePath("/quality/ncr");
    revalidatePath("/quality");
    return ok(updated);
  } catch (e) { return err(errMsg(e)); }
}

// ── Corrective Actions (CAPA) ─────────────────────────────────────────────────

const CAPAInput = z.object({
  ncrId:        z.coerce.number().int().positive(),
  actionType:   z.enum(["CORRECTIVE", "PREVENTIVE"]),
  description:  z.string().min(1).max(1000),
  assignedToId: z.string().optional().nullable(),
  dueDate:      z.string().optional().nullable(),
  notes:        z.string().max(500).optional().nullable(),
});

export async function listCAPAs(opts?: { status?: string; ncrId?: number; limit?: number }) {
  try {
    await guard("quality.read");
    const data = await prisma.correctiveAction.findMany({
      where: {
        ...(opts?.status ? { status: opts.status } : {}),
        ...(opts?.ncrId  ? { ncrId:  opts.ncrId  } : {}),
      },
      include: {
        ncr:        { select: { id: true, ncrNumber: true, defectType: true, severity: true } },
        assignedTo: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: opts?.limit ?? 300,
    });
    return ok(data);
  } catch (e) { return err(errMsg(e)); }
}

export async function createCAPA(raw: unknown) {
  try {
    await guard("quality.write");
    const p = CAPAInput.safeParse(raw);
    if (!p.success) return err(p.error.errors[0].message);
    const d = p.data;
    const capa = await prisma.correctiveAction.create({
      data: {
        ncrId:       d.ncrId,
        actionType:  d.actionType,
        description: d.description,
        assignedToId: d.assignedToId ?? null,
        dueDate:     d.dueDate ? new Date(d.dueDate) : null,
        notes:       d.notes ?? null,
        status:      "OPEN",
      },
    });
    // Advance NCR status
    await prisma.nonConformance.update({
      where: { id: d.ncrId },
      data: { status: "CORRECTIVE_ACTION" },
    }).catch(() => null);
    revalidatePath("/quality/capa");
    revalidatePath("/quality/ncr");
    return ok(capa);
  } catch (e) { return err(errMsg(e)); }
}

export async function updateCAPAStatus(raw: { id: number; status: "OPEN" | "IN_PROGRESS" | "COMPLETE"; notes?: string }) {
  try {
    await guard("quality.write");
    const updated = await prisma.correctiveAction.update({
      where: { id: raw.id },
      data: {
        status:      raw.status,
        completedAt: raw.status === "COMPLETE" ? new Date() : null,
        notes:       raw.notes ?? undefined,
      },
    });
    revalidatePath("/quality/capa");
    return ok(updated);
  } catch (e) { return err(errMsg(e)); }
}

// ── Quality Certificates ──────────────────────────────────────────────────────

const CertInput = z.object({
  type:               z.enum(["COC", "TEST_REPORT", "INSPECTION_CERT"]),
  inspectionId:       z.coerce.number().int().positive().optional().nullable(),
  customerId:         z.coerce.number().int().positive().optional().nullable(),
  salesOrderId:       z.coerce.number().int().positive().optional().nullable(),
  productDescription: z.string().max(300).optional().nullable(),
  batchNumber:        z.string().max(60).optional().nullable(),
  issuedDate:         z.string().min(1),
  validUntil:         z.string().optional().nullable(),
  remarks:            z.string().max(1000).optional().nullable(),
});

export async function listCertificates(opts?: { type?: string; customerId?: number; limit?: number }) {
  try {
    await guard("quality.read");
    const data = await prisma.qualityCertificate.findMany({
      where: {
        ...(opts?.type       ? { type:       opts.type as never }   : {}),
        ...(opts?.customerId ? { customerId: opts.customerId }       : {}),
      },
      include: {
        inspection: { select: { id: true, inspectionNumber: true } },
        customer:   { select: { id: true, name: true, customerCode: true } },
        salesOrder: { select: { id: true, orderNumber: true } },
        issuedBy:   { select: { name: true } },
      },
      orderBy: { issuedDate: "desc" },
      take: opts?.limit ?? 300,
    });
    return ok(data);
  } catch (e) { return err(errMsg(e)); }
}

export async function createCertificate(raw: unknown) {
  try {
    const actor = await guard("quality.write");
    const p = CertInput.safeParse(raw);
    if (!p.success) return err(p.error.errors[0].message);
    const d = p.data;
    const certificateNumber = await nextCertNumber(d.type);
    const cert = await prisma.qualityCertificate.create({
      data: {
        certificateNumber,
        type:               d.type,
        inspectionId:       d.inspectionId ?? null,
        customerId:         d.customerId ?? null,
        salesOrderId:       d.salesOrderId ?? null,
        productDescription: d.productDescription ?? null,
        batchNumber:        d.batchNumber ?? null,
        issuedDate:         new Date(d.issuedDate),
        validUntil:         d.validUntil ? new Date(d.validUntil) : null,
        issuedById:         actor.id,
        remarks:            d.remarks ?? null,
      },
    });
    revalidatePath("/quality/certificates");
    return ok(cert);
  } catch (e) { return err(errMsg(e)); }
}

// ── Quality Summary / Dashboard ───────────────────────────────────────────────

export async function getQualitySummary() {
  try {
    await guard("quality.read");

    const today     = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const last6mo   = new Date(today.getFullYear(), today.getMonth() - 5, 1);

    const [
      totalInspections,
      passCount, failCount, reworkCount,
      openNCRs, criticalNCRs, overdueCapas,
      inspectionsByType,
      recentInspections,
      recentNCRs,
      ncrsBySeverity,
      ncrsByStatus,
      monthlyTrend,
      certThisMonth,
    ] = await Promise.all([
      prisma.qualityInspection.count({ where: { inspectionDate: { gte: monthStart } } }),
      prisma.qualityInspection.count({ where: { result: "PASS", inspectionDate: { gte: monthStart } } }),
      prisma.qualityInspection.count({ where: { result: "FAIL", inspectionDate: { gte: monthStart } } }),
      prisma.qualityInspection.count({ where: { result: "REWORK", inspectionDate: { gte: monthStart } } }),
      prisma.nonConformance.count({ where: { status: { notIn: ["CLOSED", "CANCELLED"] } } }),
      prisma.nonConformance.count({ where: { severity: "CRITICAL", status: { notIn: ["CLOSED", "CANCELLED"] } } }),
      prisma.correctiveAction.count({ where: { status: { not: "COMPLETE" }, dueDate: { lt: today } } }),
      prisma.qualityInspection.groupBy({ by: ["type"], _count: { id: true }, where: { inspectionDate: { gte: monthStart } } }),
      prisma.qualityInspection.findMany({
        take: 10, orderBy: { inspectionDate: "desc" },
        include: { inspector: { select: { nameEn: true } }, productionOrder: { select: { orderCode: true } } },
      }),
      prisma.nonConformance.findMany({
        take: 8, orderBy: { createdAt: "desc" },
        include: { responsible: { select: { nameEn: true } } },
      }),
      prisma.nonConformance.groupBy({ by: ["severity"], _count: { id: true } }),
      prisma.nonConformance.groupBy({ by: ["status"], _count: { id: true } }),
      // Monthly inspection trend (last 6 months)
      prisma.qualityInspection.findMany({
        where: { inspectionDate: { gte: last6mo } },
        select: { inspectionDate: true, result: true },
      }),
      prisma.qualityCertificate.count({ where: { issuedDate: { gte: monthStart } } }),
    ]);

    const passRate = totalInspections > 0 ? Math.round((passCount / totalInspections) * 100) : null;

    // Build monthly trend map
    const trendMap: Record<string, { pass: number; fail: number; rework: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      trendMap[`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`] = { pass: 0, fail: 0, rework: 0 };
    }
    for (const insp of monthlyTrend) {
      const k = `${insp.inspectionDate.getFullYear()}-${String(insp.inspectionDate.getMonth() + 1).padStart(2, "0")}`;
      if (k in trendMap && insp.result) {
        if (insp.result === "PASS")   trendMap[k].pass++;
        if (insp.result === "FAIL")   trendMap[k].fail++;
        if (insp.result === "REWORK") trendMap[k].rework++;
      }
    }
    const trend = Object.entries(trendMap).map(([month, v]) => ({ month, ...v }));

    return ok({
      totalInspections, passCount, failCount, reworkCount, passRate,
      openNCRs, criticalNCRs, overdueCapas, certThisMonth,
      inspectionsByType: inspectionsByType.map((r) => ({ type: r.type as string, count: r._count.id })),
      ncrsBySeverity: ncrsBySeverity.map((r) => ({ severity: r.severity, count: r._count.id })),
      ncrsByStatus: ncrsByStatus.map((r) => ({ status: r.status as string, count: r._count.id })),
      trend,
      recentInspections: recentInspections.map((i) => ({
        id: i.id, inspectionNumber: i.inspectionNumber, type: i.type as string,
        status: i.status as string, result: i.result as string | null,
        inspectionDate: i.inspectionDate.toISOString(),
        inspectorName: i.inspector?.nameEn ?? null,
        orderCode: i.productionOrder?.orderCode ?? null,
        sampleSize: i.sampleSize, defectCount: i.defectCount,
      })),
      recentNCRs: recentNCRs.map((n) => ({
        id: n.id, ncrNumber: n.ncrNumber, defectType: n.defectType,
        severity: n.severity, status: n.status as string,
        responsibleName: n.responsible?.nameEn ?? null,
        dueDate: n.dueDate?.toISOString() ?? null,
        createdAt: n.createdAt.toISOString(),
      })),
    });
  } catch (e) { return err(errMsg(e)); }
}

export async function getQualityExecutiveSummary() {
  try {
    const today      = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [totalInspections, passCount, openNCRs, overdueCapas, certificatesThisMonth] = await Promise.all([
      prisma.qualityInspection.count({ where: { inspectionDate: { gte: monthStart } } }),
      prisma.qualityInspection.count({ where: { result: "PASS", inspectionDate: { gte: monthStart } } }),
      prisma.nonConformance.count({ where: { status: { notIn: ["CLOSED", "CANCELLED"] } } }),
      prisma.correctiveAction.count({ where: { status: { not: "COMPLETE" }, dueDate: { lt: today } } }),
      prisma.qualityCertificate.count({ where: { issuedDate: { gte: monthStart } } }),
    ]);

    const passRate = totalInspections > 0 ? Math.round((passCount / totalInspections) * 100) : null;

    return ok({ totalInspections, passRate, openNCRs, overdueCapas, certificatesThisMonth });
  } catch (e) { return err(errMsg(e)); }
}
