import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron";
import { prisma } from "@/lib/db";
import { notifyRole } from "@/lib/notify";
import { sendTelegramMessage } from "@/lib/telegram";

export const maxDuration = 30;

export async function POST(request: Request) {
  
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const today = new Date();
    const in30Days = new Date(today);
    in30Days.setDate(in30Days.getDate() + 30);

    const expiring = await prisma.employee.findMany({
      where: {
        status: "ACTIVE",
        contractExpiry: {
          gte: today,
          lte: in30Days,
        },
      },
      select: {
        id: true,
        nameEn: true,
        employeeCode: true,
        contractExpiry: true,
      },
      orderBy: { contractExpiry: "asc" },
    });

    for (const emp of expiring) {
      const expiry = emp.contractExpiry!;
      const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / 86_400_000);
      const level = daysLeft <= 7 ? "critical" : "warning";

      await notifyRole(["OWNER", "HR_MANAGER"], {
        title: `Contract expiring: ${emp.nameEn}`,
        body: `${emp.nameEn} (${emp.employeeCode ?? "—"}) contract expires in ${daysLeft} day${daysLeft === 1 ? "" : "s"} on ${expiry.toLocaleDateString("en-GB")}.`,
        level,
        module: "hr",
        href: `/employees/${emp.id}`,
      });
    }

    if (expiring.length > 0) {
      const critical = expiring.filter((e) => {
        const days = Math.ceil((e.contractExpiry!.getTime() - today.getTime()) / 86_400_000);
        return days <= 7;
      });

      const lines = [
        `*⚠️ ZY Steel — Contract Expiry Alert*`,
        ``,
        `${expiring.length} employee contract(s) expiring within 30 days:`,
        ...expiring.map((e) => {
          const days = Math.ceil((e.contractExpiry!.getTime() - today.getTime()) / 86_400_000);
          const icon = days <= 7 ? "🔴" : "🟡";
          return `${icon} ${e.nameEn} — ${days}d (${e.contractExpiry!.toLocaleDateString("en-GB")})`;
        }),
        ``,
        critical.length > 0 ? `🚨 ${critical.length} expiring within 7 days — action required!` : ``,
        `_Sent automatically by ZYSteel HR Bot_`,
      ].filter((l) => l !== undefined);

      await sendTelegramMessage(lines.join("\n"));
    }

    return NextResponse.json({ ok: true, processed: expiring.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[cron/contract-expiry]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
