import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";

// ONE-TIME route — delete after use. Protected by CRON_SECRET.
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const NEW_EMAIL = "tempowner@zysteel.local";
  const NEW_PASSWORD = "ZyOwner2025abc";

  // Delete any previous temp account
  const existing = await prisma.user.findUnique({ where: { email: NEW_EMAIL } });
  if (existing) {
    await prisma.account.deleteMany({ where: { userId: existing.id } });
    await prisma.user.delete({ where: { id: existing.id } });
  }

  // Create via Better Auth's own sign-up — guaranteed correct hash format
  await auth.api.signUpEmail({
    body: { email: NEW_EMAIL, password: NEW_PASSWORD, name: "Temp Admin" },
  });

  // Elevate to OWNER
  await prisma.user.update({
    where: { email: NEW_EMAIL },
    data: { role: "OWNER" },
  });

  return NextResponse.json({
    ok: true,
    email: NEW_EMAIL,
    password: NEW_PASSWORD,
    note: "Log in with these credentials, then delete this route.",
  });
}
