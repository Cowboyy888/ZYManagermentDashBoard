import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";

const scryptAsync = promisify(scrypt);

const NEW_EMAIL    = "tempowner@zysteel.local";
const NEW_PASSWORD = "ZyOwner2025abc";

async function hashPw(password: string): Promise<string> {
  // Same algorithm as @better-auth/utils/password:
  // salt = 32-char hex string, key = scrypt(N=16384,r=16,p=1,dkLen=64), stored as hex
  const salt = randomBytes(16).toString("hex");
  const key = await scryptAsync(
    password.normalize("NFKC"),
    salt,
    64,
    { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 },
  ) as Buffer;
  return `${salt}:${key.toString("hex")}`;
}

async function verifyPw(hash: string, password: string): Promise<boolean> {
  const [salt, storedKey] = hash.split(":");
  if (!salt || !storedKey) return false;
  const key = await scryptAsync(
    password.normalize("NFKC"),
    salt,
    64,
    { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 },
  ) as Buffer;
  return key.toString("hex") === storedKey;
}

// ONE-TIME route — delete after use. Protected by CRON_SECRET.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret");

  // Allow if secret matches CRON_SECRET, OR if CRON_SECRET is unset (use "reset" as fallback)
  const expectedSecret = process.env.CRON_SECRET ?? "reset";
  if (secret !== expectedSecret) {
    return NextResponse.json({ error: "Unauthorized — pass ?secret=YOUR_CRON_SECRET" }, { status: 401 });
  }

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
    if (credAcct?.password) {
      hashOk = await verifyPw(credAcct.password, NEW_PASSWORD);
    }
    return NextResponse.json({
      user: u ? { id: u.id, email: u.email, role: u.role, emailVerified: u.emailVerified } : null,
      accounts: accts.map(a => ({
        providerId: a.providerId,
        passwordLength: a.password?.length ?? 0,
      })),
      hashVerifiesOk: hashOk,
      loginCredentials: hashOk ? { email: NEW_EMAIL, password: NEW_PASSWORD } : null,
    });
  }

  // ── Hash password ──────────────────────────────────────────────────────
  const hashed = await hashPw(NEW_PASSWORD);

  // Sanity-check our own hash before writing to DB
  const selfCheck = await verifyPw(hashed, NEW_PASSWORD);
  if (!selfCheck) {
    return NextResponse.json({ error: "Hash self-check failed — do not proceed" }, { status: 500 });
  }

  // ── Remove any previous temp user ──────────────────────────────────────
  const existing = await prisma.user.findUnique({ where: { email: NEW_EMAIL } });
  if (existing) {
    await prisma.account.deleteMany({ where: { userId: existing.id } });
    await prisma.session.deleteMany({ where: { userId: existing.id } });
    await prisma.user.delete({ where: { id: existing.id } });
  }

  // ── Create user + credential account ──────────────────────────────────
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
    hashLength: hashed.length,
    selfCheckPassed: true,
    note: "Hash self-check passed. Login with the credentials above, then delete this route.",
  });
}
