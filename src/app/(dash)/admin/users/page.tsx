import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { listUsers } from "@/actions/users";
import { prisma } from "@/lib/db";
import { UsersManager } from "./UsersManager";

export const metadata: Metadata = { title: "User Management" };

export default async function UsersPage() {
  const actor = await requireUser();
  if (!can(actor.role, "user.manage")) redirect("/");

  const [result, departments] = await Promise.all([
    listUsers(),
    prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  if (!result.ok) {
    return (
      <div style={{ padding: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>User Management</h1>
        <div style={{ marginTop: 12, padding: "12px 16px", borderRadius: 8, background: "var(--red-bg)", color: "var(--red)", fontSize: 13 }}>
          {"error" in result ? result.error : "Failed to load users"}
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>User Management</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>
          Create system accounts, assign roles, and manage access — OWNER only
        </p>
      </div>
      <UsersManager
        users={result.data}
        departments={departments}
        actorId={actor.id}
      />
    </div>
  );
}
