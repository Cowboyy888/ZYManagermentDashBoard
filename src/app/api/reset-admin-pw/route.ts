import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { scryptAsync } from "@noble/hashes/scrypt";
import { randomUUID } from "node:crypto";

// ONE-TIME route — delete after use. Protected by CRON_SECRET.
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const NEW_EMAIL    = "tempowner@zysteel.local";
  const NEW_PASSWORD = "ZyOwner2025abc";

  // ── Hash password exactly as @better-auth/utils/password does ──────────
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const salt = Buffer.from(saltBytes).toString("hex");
  const key  = await scryptAsync(NEW_PASSWORD.normalize("NFKC"), salt, {
    N: 16384, r: 16, p: 1, dkLen: 64,
    maxmem: 128 * 16384 * 16 * 2,
  });
  const hashed = `${salt}:${Buffer.from(key).toString("hex")}`;

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
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  await prisma.account.create({
    data: {
      id: randomUUID(),
      accountId: userId,
      providerId: "credential",
      userId,
      password: hashed,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });

  return NextResponse.json({
    ok: true,
    email: NEW_EMAIL,
    password: NEW_PASSWORD,
    note: "Login with these credentials, then delete this route.",
  });
}
