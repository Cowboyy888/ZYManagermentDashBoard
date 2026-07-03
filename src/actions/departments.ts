"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { guard } from "@/lib/auth/session";
import { writeAudit } from "@/lib/audit";

type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

const DeptInput = z.object({
  name:        z.string().min(1, "Name is required").max(100).trim(),
  nameKh:      z.string().max(120).optional().nullable(),
  nameZh:      z.string().max(120).optional().nullable(),
  code:        z.string().max(20).trim().toUpperCase().optional().nullable(),
  description: z.string().max(500).trim().optional().nullable(),
  managerId:   z.coerce.number().int().positive().optional().nullable(),
});

export type DeptRow = {
  id:           number;
  name:         string;
  nameKh:       string | null;
  nameZh:       string | null;
  code:         string | null;
  description:  string | null;
  active:       boolean;
  managerId:    number | null;
  managerName:  string | null;
  employeeCount: number;
  createdAt:    string;
};

export async function listDepartmentsManage(): Promise<ActionResult<DeptRow[]>> {
  try {
    await guard("employee.read");
    const rows = await prisma.department.findMany({
      include: {
        _count: { select: { employees: true } },
        manager: { select: { id: true, nameEn: true } },
      },
      orderBy: { name: "asc" },
    });
    return {
      ok: true,
      data: rows.map(d => ({
        id:            d.id,
        name:          d.name,
        nameKh:        d.nameKh,
        nameZh:        d.nameZh,
        code:          d.code,
        description:   d.description,
        active:        d.active,
        managerId:     d.managerId,
        managerName:   d.manager?.nameEn ?? null,
        employeeCount: d._count.employees,
        createdAt:     d.createdAt.toISOString(),
      })),
    };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

export async function createDepartment(raw: unknown): Promise<ActionResult<{ id: number }>> {
  try {
    const actor = await guard("employee.create");
    const p = DeptInput.safeParse(raw);
    if (!p.success) return { ok: false, error: p.error.errors[0].message };
    const { name, nameKh, nameZh, code, description, managerId } = p.data;

    const existingName = await prisma.department.findUnique({ where: { name } });
    if (existingName) return { ok: false, error: "A department with this name already exists." };

    if (code) {
      const existingCode = await prisma.department.findUnique({ where: { code } });
      if (existingCode) return { ok: false, error: "A department with this code already exists." };
    }

    const dept = await prisma.department.create({
      data: {
        name,
        nameKh:      nameKh      ?? null,
        nameZh:      nameZh      ?? null,
        code:        code        ?? null,
        description: description ?? null,
        managerId:   managerId   ?? null,
        active: true,
      },
    });
    await writeAudit({ userId: actor.id, action: "department.create", entityType: "Department", entityId: dept.id, after: dept });
    revalidatePath("/departments");
    return { ok: true, data: { id: dept.id } };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

export async function updateDepartment(id: number, raw: unknown): Promise<ActionResult> {
  try {
    const actor = await guard("employee.update");
    const p = DeptInput.safeParse(raw);
    if (!p.success) return { ok: false, error: p.error.errors[0].message };
    const { name, nameKh, nameZh, code, description, managerId } = p.data;

    const existingName = await prisma.department.findUnique({ where: { name } });
    if (existingName && existingName.id !== id) return { ok: false, error: "A department with this name already exists." };

    if (code) {
      const existingCode = await prisma.department.findUnique({ where: { code } });
      if (existingCode && existingCode.id !== id) return { ok: false, error: "A department with this code already exists." };
    }

    const before = await prisma.department.findUnique({ where: { id } });
    const after = await prisma.department.update({
      where: { id },
      data: {
        name,
        nameKh:      nameKh      ?? null,
        nameZh:      nameZh      ?? null,
        code:        code        ?? null,
        description: description ?? null,
        managerId:   managerId   ?? null,
      },
    });
    await writeAudit({ userId: actor.id, action: "department.update", entityType: "Department", entityId: id, before, after });
    revalidatePath("/departments");
    return { ok: true, data: undefined };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

export async function archiveDepartment(id: number, active: boolean): Promise<ActionResult> {
  try {
    const actor = await guard("employee.update");
    await prisma.department.update({ where: { id }, data: { active } });
    await writeAudit({ userId: actor.id, action: active ? "department.unarchive" : "department.archive", entityType: "Department", entityId: id });
    revalidatePath("/departments");
    return { ok: true, data: undefined };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

export async function deleteDepartment(id: number): Promise<ActionResult> {
  try {
    const actor = await guard("employee.delete");
    const count = await prisma.employee.count({ where: { departmentId: id } });
    if (count > 0) return { ok: false, error: `Cannot delete: ${count} employee${count === 1 ? "" : "s"} are assigned to this department.` };
    await prisma.department.delete({ where: { id } });
    await writeAudit({ userId: actor.id, action: "department.delete", entityType: "Department", entityId: id });
    revalidatePath("/departments");
    return { ok: true, data: undefined };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

function errMsg(e: unknown): string {
  if (e instanceof Error) {
    if (e.message === "Not authenticated") redirect("/login");
    return e.message;
  }
  return "Unexpected error";
}
