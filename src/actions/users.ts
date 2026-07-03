"use server";
import { z } from "zod";
// @ts-ignore — @better-auth/utils exports CJS via require condition
import { hashPassword } from "@better-auth/utils/password";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "../lib/db";
import { guard } from "../lib/auth/session";
import type { ActionResult } from "./employees";
import type { Role } from "../lib/rbac";

// ── Types ─────────────────────────────────────────────────────────────────────

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  departmentId: number | null;
  departmentName: string | null;
  createdAt: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const rand = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  return `Zy${new Date().getFullYear()}-${rand}`;
}

function errMsg(e: unknown): string {
  if (e instanceof Error) {
    if (e.message === "Not authenticated") redirect("/login");
    if (e.name === "ForbiddenError") return "You do not have permission for this action.";
    return e.message;
  }
  return "Unexpected error";
}

// ── List ──────────────────────────────────────────────────────────────────────

export async function listUsers(): Promise<ActionResult<UserRow[]>> {
  try {
    await guard("user.manage");
    const users = await prisma.user.findMany({
      include: { department: { select: { name: true } } },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });
    return {
      ok: true,
      data: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        active: u.active,
        departmentId: u.departmentId,
        departmentName: u.department?.name ?? null,
        createdAt: u.createdAt.toISOString(),
      })),
    };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

// ── Create ────────────────────────────────────────────────────────────────────

const CreateUserInput = z.object({
  name: z.string().min(2).max(80).trim(),
  email: z.string().email().toLowerCase().trim(),
  role: z.enum(["OWNER", "HR_MANAGER", "SUPERVISOR", "VIEWER"]),
  departmentId: z.coerce.number().int().positive().optional().nullable(),
});

export async function createUser(raw: unknown): Promise<ActionResult<{ id: string; tempPassword: string }>> {
  try {
    const actor = await guard("user.manage");
    const p = CreateUserInput.safeParse(raw);
    if (!p.success) return { ok: false, error: p.error.errors[0].message };

    const existing = await prisma.user.findUnique({ where: { email: p.data.email } });
    if (existing) return { ok: false, error: "A user with this email already exists." };

    const tempPassword = generateTempPassword();
    const hashedPw = await hashPassword(tempPassword);

    const user = await prisma.user.create({
      data: {
        email: p.data.email,
        name: p.data.name,
        role: p.data.role as Role,
        departmentId: p.data.departmentId ?? null,
        emailVerified: true,
        active: true,
      },
    });

    // Create the credential Account Better Auth uses for login.
    await prisma.account.create({
      data: {
        id: randomUUID(),
        accountId: user.id,
        providerId: "credential",
        userId: user.id,
        password: hashedPw,
      },
    });

    revalidatePath("/admin/users");
    void actor;
    return { ok: true, data: { id: user.id, tempPassword } };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

// ── Update role ───────────────────────────────────────────────────────────────

const UpdateRoleInput = z.object({
  userId: z.string().min(1),
  role: z.enum(["OWNER", "HR_MANAGER", "SUPERVISOR", "VIEWER"]),
  departmentId: z.coerce.number().int().positive().optional().nullable(),
});

export async function updateUserRole(raw: unknown): Promise<ActionResult<undefined>> {
  try {
    const actor = await guard("user.manage");
    const p = UpdateRoleInput.safeParse(raw);
    if (!p.success) return { ok: false, error: p.error.errors[0].message };

    // Cannot demote yourself
    if (p.data.userId === actor.id) return { ok: false, error: "You cannot change your own role." };

    await prisma.user.update({
      where: { id: p.data.userId },
      data: { role: p.data.role as Role, departmentId: p.data.departmentId ?? null },
    });
    revalidatePath("/admin/users");
    return { ok: true, data: undefined };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

// ── Reset password ────────────────────────────────────────────────────────────

export async function resetUserPassword(userId: string): Promise<ActionResult<{ tempPassword: string }>> {
  try {
    const actor = await guard("user.manage");
    if (userId === actor.id) return { ok: false, error: "Use the change-password flow for your own account." };

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, active: true } });
    if (!user) return { ok: false, error: "User not found." };
    if (!user.active) return { ok: false, error: "Cannot reset password for a disabled account." };

    const tempPassword = generateTempPassword();
    const hashedPw = await hashPassword(tempPassword);

    // Update the credential Account Better Auth verifies against.
    await prisma.account.updateMany({
      where: { userId, providerId: "credential" },
      data: { password: hashedPw },
    });

    revalidatePath("/admin/users");
    return { ok: true, data: { tempPassword } };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}

// ── Toggle active ─────────────────────────────────────────────────────────────

export async function setUserActive(userId: string, active: boolean): Promise<ActionResult<undefined>> {
  try {
    const actor = await guard("user.manage");
    if (userId === actor.id) return { ok: false, error: "You cannot disable your own account." };

    await prisma.user.update({ where: { id: userId }, data: { active } });

    // Revoke all sessions when disabling
    if (!active) {
      await prisma.session.deleteMany({ where: { userId } });
    }

    revalidatePath("/admin/users");
    return { ok: true, data: undefined };
  } catch (e) { return { ok: false, error: errMsg(e) }; }
}
