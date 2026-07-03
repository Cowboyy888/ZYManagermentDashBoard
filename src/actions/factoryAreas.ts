"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { guard } from "@/lib/auth/session";
import { writeAudit } from "@/lib/audit";

const AreaInput = z.object({
  name:        z.string().min(1).max(100),
  code:        z.string().min(1).max(10).toUpperCase(),
  description: z.string().max(300).optional().nullable(),
});

type ActionResult<T = void> = { ok: true; data: T } | { ok: false; error: string };

export async function createFactoryArea(raw: unknown): Promise<ActionResult<{ id: number }>> {
  try {
    const actor = await guard("employee.create");
    const parsed = AreaInput.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
    const { name, code, description } = parsed.data;
    const area = await prisma.factoryArea.create({ data: { name, code, description: description ?? null } });
    await writeAudit({ userId: actor.id, action: "factoryArea.create", entityType: "FactoryArea", entityId: area.id, after: area });
    revalidatePath("/factory-areas");
    return { ok: true, data: { id: area.id } };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

export async function updateFactoryArea(id: number, raw: unknown): Promise<ActionResult> {
  try {
    const actor = await guard("employee.update");
    const parsed = AreaInput.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.errors[0].message };
    const { name, code, description } = parsed.data;
    const before = await prisma.factoryArea.findUnique({ where: { id } });
    const after = await prisma.factoryArea.update({ where: { id }, data: { name, code, description: description ?? null } });
    await writeAudit({ userId: actor.id, action: "factoryArea.update", entityType: "FactoryArea", entityId: id, before, after });
    revalidatePath("/factory-areas");
    return { ok: true, data: undefined };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

export async function deleteFactoryArea(id: number): Promise<ActionResult> {
  try {
    const actor = await guard("employee.delete");
    const count = await prisma.employee.count({ where: { factoryAreaId: id } });
    if (count > 0) return { ok: false, error: `Cannot delete: ${count} employees assigned here.` };
    await prisma.factoryArea.delete({ where: { id } });
    await writeAudit({ userId: actor.id, action: "factoryArea.delete", entityType: "FactoryArea", entityId: id });
    revalidatePath("/factory-areas");
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
