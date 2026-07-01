// ZYSTEEL HR — session + auth glue (arch §4).
// Better Auth provides the session; this wraps it with our Role type and a
// helper that every Server Action uses to get the actor + enforce permissions.

import { redirect } from "next/navigation";
import type { Role, Action, AccessContext } from "../rbac";
import { authorize } from "../rbac";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  departmentId: number | null;
}

// In production this reads the Better Auth session cookie. Kept as a single
// seam so the rest of the app never touches auth internals directly.
import { auth } from "./config";
import { headers } from "next/headers";

export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return null;
  const u = session.user as unknown as SessionUser;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    departmentId: u.departmentId ?? null,
  };
}

/** Require a logged-in user or redirect to login. Use in pages/layouts. */
export async function requireUser(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  return u;
}

/**
 * The standard guard for Server Actions: fetch the actor, then authorize.
 * Throws ForbiddenError (caught by the action's try/catch) if not permitted.
 */
export async function guard(action: Action, ctx: AccessContext = {}): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) throw new Error("Not authenticated");
  authorize(u.role, action, { actorDeptId: u.departmentId, ...ctx });
  return u;
}
