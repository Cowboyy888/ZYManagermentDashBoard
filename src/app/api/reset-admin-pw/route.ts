import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { randomUUID } from "node:crypto";
import { scryptAsync } from "@noble/hashes/scrypt.js";

// ONE-TIME route — delete after use. Protected by CRON_SECRET.
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const NEW_EMAIL    = "tempowner@zysteel.local";
  const NEW_PASSWORD = "ZyOwner2025abc";

  // ?check=1 → show DB state without creating anything
  if (url.searchParams.get("check") === "1") {
    const u = await prisma.user.findUnique({ where: { email: NEW_EMAIL } });
    const accts = u
      ? await prisma.account.findMany({ where: { userId: u.id }, select: { providerId: true, password: true } })
      : [];
    return NextResponse.json({
      user: u ? { id: u.id, email: u.email, role: u.role, emailVerified: u.emailVerified } : null,
      accounts: accts.map(a => ({ providerId: a.providerId, passwordLength: a.password?.length ?? 0, passwordPrefix: a.password?.slice(0, 20) ?? null })),
    });
  }

  // ── Hash exactly as @better-auth/utils/password does ──────────────────
  // Format: <32-char-hex-salt>:<128-char-hex-key>
  const saltBytes = new Uint8Array(16);
  crypto.getRandomValues(saltBytes);
  const toHex = (u8: Uint8Array) =>
    Array.from(u8).map(b => b.toString(16).padStart(2, "0")).join("");
  const salt   = toHex(saltBytes);
  // Pass strings, not Uint8Arrays — matches @better-auth/utils/password exactly
  const keyU8  = await scryptAsync(
    NEW_PASSWORD.normalize("NFKC"),
    salt,
    { N: 16384, r: 16, p: 1, dkLen: 64, maxmem: 128 * 16384 * 16 * 2 },
  );
  const hashed = `${salt}:${toHex(keyU8)}`;

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
    data: {
      id: userId,
      name: "Temp Admin",
      email: NEW_EMAIL,
      emailVerified: true,
      role: "OWNER",
    },
  });

  await prisma.account.create({
    data: {
      id: randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: hashed,
    },
  });

  return NextResponse.json({
    ok: true,
    email: NEW_EMAIL,
    password: NEW_PASSWORD,
    note: "Login with these credentials, then delete this route.",
  });
}
