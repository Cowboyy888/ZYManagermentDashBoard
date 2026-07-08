import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron";
import { prisma } from "@/lib/db";
import { notifyRole } from "@/lib/notify";
import { sendTelegramMessage } from "@/lib/telegram";
import { nowICT } from "@/lib/utils/date";

export const maxDuration = 30;

export async function POST(request: Request) {
  
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const today = nowICT();
    const in3Days = new Date(today);
    in3Days.setDate(in3Days.getDate() + 3);

    // Find open pay periods whose payrollDate is approaching or past
    const upcomingPeriods = await prisma.payPeriod.findMany({
      where: {
        locked: false,
        payrollDate: { lte: in3Days },
      },
      select: {
        id: true,
        year: true,
        month: true,
        half: true,
        name: true,
        payrollDate: true,
        startDate: true,
        endDate: true,
        runs: { select: { id: true }, take: 1 },
      },
      orderBy: { payrollDate: "asc" },
    });

    let processed = 0;

    for (const period of upcomingPeriods) {
      const hasRun = period.runs.length > 0;
      const payDate = period.payrollDate!;
      const daysUntilPay = Math.ceil((payDate.getTime() - today.getTime()) / 86_400_000);
      const isOverdue = daysUntilPay < 0;
      const periodLabel = period.name ?? `${period.year}-${String(period.month).padStart(2, "0")} H${period.half}`;

      if (!hasRun) {
        // Payroll not processed yet — send reminder
        const level = isOverdue || daysUntilPay <= 1 ? "critical" : "warning";
        await notifyRole(["OWNER", "HR_MANAGER"], {
          title: isOverdue
            ? `Payroll overdue: ${periodLabel}`
            : `Payroll reminder: ${periodLabel}`,
          body: `${periodLabel} payroll has not been processed. Pay date: ${payDate.toLocaleDateString("en-GB")} (${
            isOverdue ? `${Math.abs(daysUntilPay)} day(s) past due` : daysUntilPay === 0 ? "today" : `in ${daysUntilPay} day(s)`
          }).`,
          level,
          module: "payroll",
          href: `/payroll`,
        });

        processed++;

        // Telegram notification for overdue
        if (isOverdue || daysUntilPay <= 1) {
          await sendTelegramMessage(
            [
              `*💰 ZY Steel — Payroll Alert*`,
              ``,
              isOverdue ? `🔴 Payroll OVERDUE: ${periodLabel}` : `🟠 Payroll due soon: ${periodLabel}`,
              `Pay date: ${payDate.toLocaleDateString("en-GB")}`,
              isOverdue
                ? `⚠️ Payroll is ${Math.abs(daysUntilPay)} day(s) past due and has not been processed.`
                : `⚠️ Payroll due ${daysUntilPay === 0 ? "TODAY" : "tomorrow"} and has not been processed.`,
              ``,
              `Please process payroll at: /payroll`,
              `_Sent automatically by ZYSteel HR Bot_`,
            ].join("\n")
          );
        }
      }
    }

    return NextResponse.json({ ok: true, processed });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[cron/payroll-reminder]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
