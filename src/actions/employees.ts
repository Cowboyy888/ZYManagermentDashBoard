"use server";
// ZYSTEEL HR — Employee Server Actions (extended with HR profile fields).
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "../lib/db";
import { guard } from "../lib/auth/session";
import { writeAudit } from "../lib/audit";

const EmergencyContactSchema = z.object({
  name: z.string().max(100).optional(),
  phone: z.string().max(30).optional(),
  relation: z.string().max(50).optional(),
}).optional().nullable();

const EmployeeInput = z.object({
  nameKh:         z.string().min(1, "Khmer name required").max(120),
  nameZh:         z.string().max(120).optional().nullable(),
  nameEn:         z.string().min(1, "English name required").max(120),
  dailyRateUsd:   z.coerce.number().positive("Rate must be > 0").max(1000),
  departmentId:   z.coerce.number().int().positive().optional().nullable(),
  hireDate:       z.coerce.date(),
  status:         z.enum(["ACTIVE", "TERMINATED"]).default("ACTIVE"),
  note:           z.string().max(500).optional().nullable(),
  // HR profile
  employeeCode:   z.string().max(20).optional().nullable(),
  photoUrl:       z.string().max(500).optional().nullable(),
  gender:         z.enum(["MALE", "FEMALE", "OTHER"]).optional().nullable(),
  birthday:       z.coerce.date().optional().nullable(),
  nationality:    z.string().max(60).optional().nullable(),
  phone:          z.string().max(30).optional().nullable(),
  email:          z.string().email().max(120).optional().nullable().or(z.literal("")),
  address:        z.string().max(300).optional().nullable(),
  emergencyContact: EmergencyContactSchema,
  positionId:     z.coerce.number().int().positive().optional().nullable(),
  factoryAreaId:  z.coerce.number().int().positive().optional().nullable(),
  productionLine: z.string().max(80).optional().nullable(),
  shift:          z.enum(["DAY", "AFTERNOON", "NIGHT"]).optional().nullable(),
  supervisorId:   z.coerce.number().int().positive().optional().nullable(),
  contractExpiry: z.coerce.date().optional().nullable(),
  probationEnd:   z.coerce.date().optional().nullable(),
});

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

// ── List ────────────────────────────────────────────────────────────────────

export async function listEmployees(params?: {
  search?: string;
  status?: "ACTIVE" | "TERMINATED" | "ALL";
  departmentId?: number;
  factoryAreaId?: number;
}): Promise<ActionResult<Awaited<ReturnType<typeof queryEmployees>>>> {
  try {
    await guard("employee.read");
    return { ok: true, data: await queryEmployees(params) };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

async function queryEmployees(params?: {
  search?: string;
  status?: "ACTIVE" | "TERMINATED" | "ALL";
  departmentId?: number;
  factoryAreaId?: number;
}) {
  const search = params?.search?.trim();
  const status = params?.status ?? "ACTIVE";
  return prisma.employee.findMany({
    where: {
      ...(status !== "ALL" ? { status } : {}),
      ...(params?.departmentId ? { departmentId: params.departmentId } : {}),
      ...(params?.factoryAreaId ? { factoryAreaId: params.factoryAreaId } : {}),
      ...(search ? {
        OR: [
          { nameEn: { contains: search, mode: "insensitive" } },
          { nameKh: { contains: search } },
          { nameZh: { contains: search } },
          { employeeCode: { contains: search, mode: "insensitive" } },
          { phone: { contains: search } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      } : {}),
    },
    include: {
      department: true,
      position: true,
      factoryArea: true,
      supervisor: { select: { id: true, nameEn: true } },
    },
    orderBy: { id: "asc" },
  });
}

// ── Get single ──────────────────────────────────────────────────────────────

export async function getEmployee(id: number): Promise<ActionResult<Awaited<ReturnType<typeof querySingle>>>> {
  try {
    await guard("employee.read");
    const emp = await querySingle(id);
    if (!emp) return { ok: false, error: "Employee not found" };
    return { ok: true, data: emp };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

async function querySingle(id: number) {
  return prisma.employee.findUnique({
    where: { id },
    include: {
      department: true,
      position: true,
      factoryArea: true,
      supervisor: { select: { id: true, nameEn: true, nameKh: true } },
      subordinates: { select: { id: true, nameEn: true, nameKh: true, positionId: true, position: { select: { name: true } } } },
      documents: { orderBy: { createdAt: "desc" } },
      attendance: { take: 30, orderBy: { date: "desc" } },
      overtime: { take: 20, orderBy: { date: "desc" } },
    },
  });
}

// ── Create ──────────────────────────────────────────────────────────────────

export async function createEmployee(raw: unknown): Promise<ActionResult<{ id: number }>> {
  try {
    const actor = await guard("employee.create");
    const parsed = EmployeeInput.safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: "Validation failed", fieldErrors: parsed.error.flatten().fieldErrors };
    }
    const d = parsed.data;
    const emp = await prisma.employee.create({
      data: {
        nameKh: d.nameKh, nameEn: d.nameEn, nameZh: d.nameZh ?? null,
        employeeCode: d.employeeCode ?? null,
        photoUrl: d.photoUrl ?? null,
        gender: d.gender ?? null,
        birthday: d.birthday ?? null,
        nationality: d.nationality ?? null,
        phone: d.phone ?? null,
        email: d.email === "" ? null : (d.email ?? null),
        address: d.address ?? null,
        emergencyContact: d.emergencyContact ? (d.emergencyContact as Prisma.InputJsonValue) : Prisma.JsonNull,
        positionId: d.positionId ?? null,
        factoryAreaId: d.factoryAreaId ?? null,
        productionLine: d.productionLine ?? null,
        shift: d.shift ?? null,
        supervisorId: d.supervisorId ?? null,
        departmentId: d.departmentId ?? null,
        dailyRateUsd: d.dailyRateUsd,
        hireDate: d.hireDate,
        contractExpiry: d.contractExpiry ?? null,
        probationEnd: d.probationEnd ?? null,
        status: d.status ?? "ACTIVE",
        note: d.note ?? null,
      } as Prisma.EmployeeUncheckedCreateInput,
    });
    // Auto-generate code if missing
    if (!emp.employeeCode) {
      await prisma.employee.update({
        where: { id: emp.id },
        data: { employeeCode: `EMP-${String(emp.id).padStart(3, "0")}` },
      });
    }
    await writeAudit({ userId: actor.id, action: "employee.create", entityType: "Employee", entityId: emp.id, after: emp });
    revalidatePath("/employees");
    return { ok: true, data: { id: emp.id } };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

// ── Update ──────────────────────────────────────────────────────────────────

export async function updateEmployee(id: number, raw: unknown): Promise<ActionResult> {
  try {
    const actor = await guard("employee.update");
    const parsed = EmployeeInput.partial().safeParse(raw);
    if (!parsed.success) {
      return { ok: false, error: "Validation failed", fieldErrors: parsed.error.flatten().fieldErrors };
    }
    const before = await prisma.employee.findUnique({ where: { id } });
    if (!before) return { ok: false, error: "Employee not found" };
    const d = parsed.data;
    const after = await prisma.employee.update({
      where: { id },
      data: {
        ...(d.nameKh !== undefined && { nameKh: d.nameKh }),
        ...(d.nameEn !== undefined && { nameEn: d.nameEn }),
        ...(d.nameZh !== undefined && { nameZh: d.nameZh ?? null }),
        ...(d.employeeCode !== undefined && { employeeCode: d.employeeCode ?? null }),
        ...(d.photoUrl !== undefined && { photoUrl: d.photoUrl ?? null }),
        ...(d.gender !== undefined && { gender: d.gender ?? null }),
        ...(d.birthday !== undefined && { birthday: d.birthday ?? null }),
        ...(d.nationality !== undefined && { nationality: d.nationality ?? null }),
        ...(d.phone !== undefined && { phone: d.phone ?? null }),
        ...(d.email !== undefined && { email: d.email === "" ? null : (d.email ?? null) }),
        ...(d.address !== undefined && { address: d.address ?? null }),
        ...(d.emergencyContact !== undefined && {
          emergencyContact: d.emergencyContact === null
            ? Prisma.JsonNull
            : (d.emergencyContact as Prisma.InputJsonValue),
        }),
        ...(d.positionId !== undefined && { positionId: d.positionId ?? null }),
        ...(d.factoryAreaId !== undefined && { factoryAreaId: d.factoryAreaId ?? null }),
        ...(d.productionLine !== undefined && { productionLine: d.productionLine ?? null }),
        ...(d.shift !== undefined && { shift: d.shift ?? null }),
        ...(d.supervisorId !== undefined && { supervisorId: d.supervisorId ?? null }),
        ...(d.departmentId !== undefined && { departmentId: d.departmentId ?? null }),
        ...(d.dailyRateUsd !== undefined && { dailyRateUsd: d.dailyRateUsd }),
        ...(d.hireDate !== undefined && { hireDate: d.hireDate }),
        ...(d.contractExpiry !== undefined && { contractExpiry: d.contractExpiry ?? null }),
        ...(d.probationEnd !== undefined && { probationEnd: d.probationEnd ?? null }),
        ...(d.status !== undefined && { status: d.status }),
        ...(d.note !== undefined && { note: d.note ?? null }),
      } as Prisma.EmployeeUncheckedUpdateInput,
    });
    await writeAudit({ userId: actor.id, action: "employee.update", entityType: "Employee", entityId: id, before, after });
    revalidatePath("/employees");
    revalidatePath(`/employees/${id}`);
    return { ok: true, data: undefined };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

// ── Update photo ─────────────────────────────────────────────────────────────

export async function updateEmployeePhoto(id: number, photoUrl: string): Promise<ActionResult> {
  try {
    await guard("employee.update");
    await prisma.employee.update({ where: { id }, data: { photoUrl } });
    revalidatePath(`/employees/${id}`);
    revalidatePath("/employees");
    return { ok: true, data: undefined };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

// ── Deactivate (soft delete) ─────────────────────────────────────────────────

export async function deactivateEmployee(id: number): Promise<ActionResult> {
  try {
    const actor = await guard("employee.delete");
    const before = await prisma.employee.findUnique({ where: { id } });
    if (!before) return { ok: false, error: "Employee not found" };
    const after = await prisma.employee.update({ where: { id }, data: { status: "TERMINATED" } });
    await writeAudit({ userId: actor.id, action: "employee.delete", entityType: "Employee", entityId: id, before, after });
    revalidatePath("/employees");
    return { ok: true, data: undefined };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

// ── Search ───────────────────────────────────────────────────────────────────

export async function searchEmployees(q: string): Promise<ActionResult<Array<{
  id: number; nameEn: string; nameKh: string; employeeCode: string | null;
  photoUrl: string | null; department: { name: string } | null;
  position: { name: string } | null;
}>>> {
  try {
    await guard("employee.read");
    if (!q.trim() || q.length < 2) return { ok: true, data: [] };
    const results = await prisma.employee.findMany({
      where: {
        status: "ACTIVE",
        OR: [
          { nameEn: { contains: q, mode: "insensitive" } },
          { nameKh: { contains: q } },
          { nameZh: { contains: q } },
          { employeeCode: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
        ],
      },
      take: 8,
      select: {
        id: true, nameEn: true, nameKh: true,
        employeeCode: true, photoUrl: true,
        department: { select: { name: true } },
        position: { select: { name: true } },
      },
      orderBy: { nameEn: "asc" },
    });
    return { ok: true, data: results };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function errMsg(e: unknown): string {
  if (e instanceof Error) {
    if (e.name === "ForbiddenError") return "You do not have permission for this action.";
    return e.message;
  }
  return "Unexpected error";
}
