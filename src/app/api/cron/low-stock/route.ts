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
    const allActive = await prisma.inventoryItem.findMany({
      where: { status: "ACTIVE", minStock: { gt: 0 } },
      select: {
        id: true,
        itemCode: true,
        name: true,
        currentStock: true,
        minStock: true,
        unitOfMeasure: true,
        category: { select: { name: true } },
        warehouse: { select: { name: true } },
      },
    });

    const lowStock = allActive
      .filter((i) => Number(i.currentStock) <= Number(i.minStock))
      .sort((a, b) => Number(a.currentStock) - Number(b.currentStock));

    for (const item of lowStock) {
      const isOut = Number(item.currentStock) === 0;
      await notifyRole(["OWNER", "HR_MANAGER"], {
        title: isOut ? `Out of stock: ${item.name}` : `Low stock: ${item.name}`,
        body: `${item.itemCode} — ${Number(item.currentStock)} ${item.unitOfMeasure} remaining (min: ${Number(item.minStock)}). Warehouse: ${item.warehouse.name}.`,
        level: isOut ? "critical" : "warning",
        module: "inventory",
        href: `/inventory/items`,
      });
    }

    if (lowStock.length > 0) {
      const outOfStock = lowStock.filter((i) => Number(i.currentStock) === 0);
      const lines = [
        `*📦 ZY Steel — Low Stock Alert*`,
        ``,
        `${lowStock.length} item(s) at or below minimum stock level:`,
        ...lowStock.slice(0, 10).map((i) => {
          const icon = Number(i.currentStock) === 0 ? "🔴" : "🟡";
          return `${icon} ${i.name} — ${Number(i.currentStock)}/${Number(i.minStock)} ${i.unitOfMeasure}`;
        }),
        lowStock.length > 10 ? `... and ${lowStock.length - 10} more` : ``,
        ``,
        outOfStock.length > 0 ? `🚨 ${outOfStock.length} item(s) completely out of stock!` : ``,
        `_Sent automatically by ZYSteel HR Bot_`,
      ].filter((l) => l !== undefined);

      await sendTelegramMessage(lines.join("\n"));
    }

    return NextResponse.json({ ok: true, processed: lowStock.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[cron/low-stock]", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}
