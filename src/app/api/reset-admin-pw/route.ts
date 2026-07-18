import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { randomUUID } from "node:crypto";
// @ts-ignore — @better-auth/utils ships CJS; bundler resolves correctly at runtime
import { hashPassword, verifyPassword } from "@better-auth/utils/password";

const NEW_EMAIL    = "tempowner@zysteel.local";
const NEW_PASSWORD = "ZyOwner2025abc";

// ONE-TIME route — delete after first use.
export async function GET(req: Request) {
  const url = new URL(req.url);

  try {
    // ?check=1 → show current DB state for the temp user
    if (url.searchParams.get("check") === "1") {
      const u = await prisma.user.findUnique({ where: { email: NEW_EMAIL } });
      const accts = u
        ? await prisma.account.findMany({
            where: { userId: u.id },
            select: { providerId: true, password: true },
          })
        : [];
      const credAcct = accts.find(a => a.providerId === "credential");
      let hashOk: boolean | null = null;
      if (credAcct?.password) hashOk = await verifyPassword(credAcct.password, NEW_PASSWORD);
      return NextResponse.json({
        user: u ? { id: u.id, email: u.email, role: u.role, emailVerified: u.emailVerified } : null,
        accounts: accts.map(a => ({ providerId: a.providerId, passwordLength: a.password?.length ?? 0 })),
        hashVerifiesOk: hashOk,
        loginCredentials: hashOk ? { email: NEW_EMAIL, password: NEW_PASSWORD } : null,
      });
    }

    // ── Hash password using the exact same function Better Auth uses ───────
    const hashed: string = await hashPassword(NEW_PASSWORD);
    const selfCheck: boolean = await verifyPassword(hashed, NEW_PASSWORD);
    if (!selfCheck) {
      return NextResponse.json({ error: "Hash self-check failed" }, { status: 500 });
    }

    // ── Remove any previous temp user ──────────────────────────────────────
    const existing = await prisma.user.findUnique({ where: { email: NEW_EMAIL } });
    if (existing) {
      await prisma.account.deleteMany({ where: { userId: existing.id } });
      await prisma.session.deleteMany({ where: { userId: existing.id } });
      await prisma.user.delete({ where: { id: existing.id } });
    }

    // ── Create user + credential account directly in DB ────────────────────
    const userId = randomUUID();
    await prisma.user.create({
      data: { id: userId, name: "Temp Admin", email: NEW_EMAIL, emailVerified: true, role: "OWNER" },
    });
    await prisma.account.create({
      data: { id: randomUUID(), accountId: userId, providerId: "credential", userId, password: hashed },
    });

    return NextResponse.json({
      ok: true,
      email: NEW_EMAIL,
      password: NEW_PASSWORD,
      hashLength: hashed.length,
      selfCheckPassed: true,
      note: "Login with these credentials, then delete this route.",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "Internal error", detail: msg }, { status: 500 });
  }
}
