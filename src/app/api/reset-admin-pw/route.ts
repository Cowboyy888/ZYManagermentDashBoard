import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
// @ts-ignore
import { hashPassword } from "@better-auth/utils/password";
import { randomUUID } from "crypto";

// ONE-TIME password reset route. Delete this file after use.
// Protected by CRON_SECRET — never accessible without it.
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: { email: string; ok: boolean; password: string }[] = [];

  const pairs: [string, string][] = [
    ["admin@zysteel.local",      "ZyAdmin2025!@#"],
    ["spikeshelbyy@gmail.com",   "ZySteel2025!@#"],
  ];

  for (const [email, password] of pairs) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) { results.push({ email, ok: false, password: "" }); continue; }

    const hashed = await hashPassword(password);
    await prisma.account.deleteMany({ where: { userId: user.id, providerId: "credential" } });
    await prisma.account.create({
      data: {
        id: randomUUID(),
        accountId: user.id,
        providerId: "credential",
        userId: user.id,
        password: hashed,
      },
    });
    results.push({ email, ok: true, password });
  }

  return NextResponse.json({ results });
}
