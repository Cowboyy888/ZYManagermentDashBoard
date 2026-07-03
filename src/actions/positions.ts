"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { guard } from "@/lib/auth/session";
import { writeAudit } from "@/lib/audit";

type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

const PosInput = z.object({
  name:        z.string().min(1, "Name is required").max(100).trim(),
  code:        z.string().max(20).trim().toUpperCase().optional().nullable(),
  level:       z.coerce.number().int().min(1).max(4).default(1),
  description: z.string().max(500).trim().optional().nullable(),
});

export type PosRow = {
  id:            number;
  name:          string;
  code:          string | null;
  level:         number;
  description:   string | null;
  active:        boolean;
  employeeCount: number;
  createdAt:     string;
};

export async function listPositionsManage(): Promise<ActionResult<PosRow[]>> {
  try {
    await guard("employee.read");
    const rows = await prisma.position.findMany({
      include: { _count: { select: { employees: true } } },
      orderBy: [{ level: "asc" }, { name: "asc" }],
    });
    return {
      ok: true,
      data: rows.map(p => ({
        id:            p.id,
        name:          p.name,
        code:          p.code,
        level:         p.level,
        description:   p.description,
        active:        p.active,
        employeeCount: p._count.employees,
        createdAt:     p.createdAt.toISOString(),
      })),
    };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

export async function createPosition(raw: unknown): Promise<ActionResult<{ id: number }>> {
  try {
    const actor = await guard("employee.create");
    const p = PosInput.safeParse(raw);
    if (!p.success) return { ok: false, error: p.error.errors[0].message };
    const { name, code, level, description } = p.data;

    const existingName = await prisma.position.findUnique({ where: { name } });
    if (existingName) return { ok: false, error: "A position with this name already exists." };

    if (code) {
      const existingCode = await prisma.position.findUnique({ where: { code } });
      if (existingCode) return { ok: false, error: "A position with this code already exists." };
    }

    const pos = await prisma.position.create({
      data: { name, code: code ?? null, level, description: description ?? null, active: true },
    });
    await writeAudit({ userId: actor.id, action: "position.create", entityType: "Position", entityId: pos.id, after: pos });
    revalidatePath("/positions");
    return { ok: true, data: { id: pos.id } };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

export async function updatePosition(id: number, raw: unknown): Promise<ActionResult> {
  try {
    const actor = await guard("employee.update");
    const p = PosInput.safeParse(raw);
    if (!p.success) return { ok: false, error: p.error.errors[0].message };
    const { name, code, level, description } = p.data;

    const existingName = await prisma.position.findUnique({ where: { name } });
    if (existingName && existingName.id !== id) return { ok: false, error: "A position with this name already exists." };

    if (code) {
      const existingCode = await prisma.position.findUnique({ where: { code } });
      if (existingCode && existingCode.id !== id) return { ok: false, error: "A position with this code already exists." };
    }

    const before = await prisma.position.findUnique({ where: { id } });
    const after = await prisma.position.update({
      where: { id },
      data: { name, code: code ?? null, level, description: description ?? null },
    });
    await writeAudit({ userId: actor.id, action: "position.update", entityType: "Position", entityId: id, before, after });
    revalidatePath("/positions");
    return { ok: true, data: undefined };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

export async function archivePosition(id: number, active: boolean): Promise<ActionResult> {
  try {
    const actor = await guard("employee.update");
    await prisma.position.update({ where: { id }, data: { active } });
    await writeAudit({ userId: actor.id, action: active ? "position.unarchive" : "position.archive", entityType: "Position", entityId: id });
    revalidatePath("/positions");
    return { ok: true, data: undefined };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

export async function deletePosition(id: number): Promise<ActionResult> {
  try {
    const actor = await guard("employee.delete");
    const count = await prisma.employee.count({ where: { positionId: id } });
    if (count > 0) return { ok: false, error: `Cannot delete: ${count} employee${count === 1 ? "" : "s"} hold this position.` };
    await prisma.position.delete({ where: { id } });
    await writeAudit({ userId: actor.id, action: "position.delete", entityType: "Position", entityId: id });
    revalidatePath("/positions");
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
