import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

// ONE-TIME route — delete after use. Protected by CRON_SECRET.
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get("secret") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const NEW_EMAIL    = "tempowner@zysteel.local";
  const NEW_PASSWORD = "ZyOwner2025abc";
  const APP_URL      = process.env.NEXT_PUBLIC_APP_URL
                    ?? process.env.AUTH_URL
                    ?? "https://zysteel-hr-dashboard.vercel.app";

  // Remove any previous temp user
  const existing = await prisma.user.findUnique({ where: { email: NEW_EMAIL } });
  if (existing) {
    await prisma.account.deleteMany({ where: { userId: existing.id } });
    await prisma.session.deleteMany({ where: { userId: existing.id } });
    await prisma.user.delete({ where: { id: existing.id } });
  }

  // Call Better Auth's own HTTP endpoint — guarantees correct hash format
  const signupRes = await fetch(`${APP_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Origin": APP_URL },
    body: JSON.stringify({ email: NEW_EMAIL, password: NEW_PASSWORD, name: "Temp Admin" }),
  });

  if (!signupRes.ok) {
    const body = await signupRes.text();
    return NextResponse.json({ error: "signup failed", detail: body }, { status: 500 });
  }

  // Elevate to OWNER
  await prisma.user.update({
    where: { email: NEW_EMAIL },
    data: { role: "OWNER" },
  });

  return NextResponse.json({
    ok: true,
    email: NEW_EMAIL,
    password: NEW_PASSWORD,
    note: "Login with these, then delete this route from the codebase.",
  });
}
