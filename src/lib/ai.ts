import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "./db";

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const AI_MODEL = "claude-sonnet-4-6";

export type ChatMessage = { role: "user" | "assistant"; content: string };

// ── Context builders ───────────────────────────────────────────────────────────

export async function buildHRContext(): Promise<string> {
  const today = new Date();
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const startOfDay = new Date(today.toDateString());

  const [employees, attendance, leaveRequests, overtime, departments] = await Promise.all([
    prisma.employee.findMany({
      select: { id: true, nameEn: true, status: true, hireDate: true, department: { select: { name: true } }, position: { select: { name: true } } },
      orderBy: { nameEn: "asc" },
    }),
    prisma.attendanceDay.findMany({
      where: { date: { gte: startOfDay } },
      include: { employee: { select: { nameEn: true } } },
    }),
    prisma.leaveRequest.findMany({
      where: { status: "PENDING" },
      include: { employee: { select: { nameEn: true, department: { select: { name: true } } } } },
      orderBy: { startDate: "asc" },
    }),
    prisma.overtimeEntry.findMany({
      where: { status: "PENDING" },
      include: { employee: { select: { nameEn: true } } },
    }),
    prisma.department.findMany({ include: { _count: { select: { employees: { where: { status: "ACTIVE" } } } } } }),
  ]);

  const active = employees.filter((e) => e.status === "ACTIVE");
  const recentHires = active.filter((e) => e.hireDate >= new Date(today.getTime() - 30 * 86400000));

  const deptSummary = departments.map((d) => `${d.name}: ${d._count.employees} staff`).join(", ");

  const todayPresent = attendance.filter((a) => a.am === "PRESENT" && a.pm === "PRESENT").length;
  const todayAbsent = attendance.filter((a) => a.am === "ABSENT" && a.pm === "ABSENT").length;
  const todayHalf = attendance.filter((a) => a.am !== a.pm).length;

  const pendingLeave = leaveRequests.map((l) =>
    `${l.employee.nameEn} (${l.employee.department?.name ?? "—"}) — ${l.type} from ${l.startDate.toDateString()} to ${l.endDate.toDateString()}`
  ).join("\n  ");

  return `You are an HR assistant for ZY Steel Cambodia (中粤铁网), a steel mesh manufacturing company.
Today: ${today.toDateString()}

WORKFORCE SUMMARY:
- Total employees: ${employees.length} (${active.length} active, ${employees.length - active.length} inactive)
- Departments: ${deptSummary}
- New hires (last 30 days): ${recentHires.length} — ${recentHires.map((e) => e.nameEn).join(", ") || "none"}

TODAY'S ATTENDANCE (${attendance.length} records):
- Full day present: ${todayPresent}, Full day absent: ${todayAbsent}, Half day: ${todayHalf}

PENDING LEAVE REQUESTS (${leaveRequests.length}):
${pendingLeave || "  No pending requests"}

PENDING OVERTIME APPROVALS: ${overtime.length}

ALL ACTIVE EMPLOYEES:
${active.map((e) => `${e.nameEn} — ${e.department?.name ?? "—"} / ${e.position?.name ?? "—"}`).join("\n")}

Answer questions about HR operations, help draft communications, assist with HR policy questions, and help analyze workforce data. Be concise and practical. When referencing employees or policies, stick to the data above.`;
}

export async function buildProductionContext(): Promise<string> {
  const today = new Date();
  const since7d = new Date(today.getTime() - 7 * 86400000);

  const [machines, orders, wire, mesh, maintenance, quality, reports] = await Promise.all([
    prisma.machine.findMany({ include: { factoryArea: { select: { code: true } } }, orderBy: { code: "asc" } }),
    prisma.productionOrder.findMany({
      where: { status: { not: "CANCELLED" } },
      include: { machine: { select: { code: true } }, supervisor: { select: { nameEn: true } }, lines: { include: { mesh: { select: { sku: true } } } } },
      orderBy: { plannedDate: "asc" },
      take: 50,
    }),
    prisma.wireInventory.findMany({ orderBy: { wireDiameterMm: "asc" } }),
    prisma.meshInventory.findMany({ orderBy: { sku: "asc" } }),
    prisma.maintenanceLog.findMany({ where: { completedAt: null }, include: { machine: { select: { code: true, name: true } } } }),
    prisma.qualityCheck.findMany({ where: { checkDate: { gte: since7d } }, orderBy: { checkDate: "desc" } }),
    prisma.dailyProductionReport.findMany({ where: { reportDate: { gte: since7d } }, orderBy: { reportDate: "desc" }, take: 20 }),
  ]);

  const operational = machines.filter((m) => m.status === "OPERATIONAL").length;
  const underMaint = machines.filter((m) => m.status === "UNDER_MAINTENANCE").length;

  const wireStr = wire.map((w) =>
    `${w.batchCode} (Ø${w.wireDiameterMm}mm): ${Number(w.remainingKg).toLocaleString()}/${Number(w.weightKg).toLocaleString()} kg remaining`
  ).join("\n  ");

  const meshStr = mesh.map((m) =>
    `${m.sku} (${Number(m.lengthM)}×${Number(m.widthM)}m, Ø${Number(m.wireDiameterMm)}mm, ${m.gridSpacingMm}mm grid): ${m.qtyInStock} pcs in stock`
  ).join("\n  ");

  const openOrders = orders.filter((o) => o.status !== "COMPLETED");
  const ordersStr = openOrders.map((o) =>
    `[${o.status}] ${o.orderCode} — planned ${o.plannedDate.toDateString()} — ${o.lines.length} SKU(s)`
  ).join("\n  ");

  const qcPassRate = quality.length > 0
    ? Math.round((quality.filter((q) => q.result === "PASS").length / quality.length) * 100)
    : 100;

  const totalMeshKg = reports.reduce((s, r) => s + Number(r.meshProducedKg), 0);
  const totalWireKg = reports.reduce((s, r) => s + Number(r.wireConsumedKg), 0);

  return `You are a production assistant for ZY Steel Cambodia (中粤铁网), a steel mesh manufacturing factory.
Today: ${today.toDateString()}

MACHINE FLEET (${machines.length} total):
- Operational: ${operational}, Under Maintenance: ${underMaint}, Retired: ${machines.length - operational - underMaint}
${machines.map((m) => `  ${m.code} [${m.status}] — ${m.name}${m.factoryArea ? ` (${m.factoryArea.code})` : ""}`).join("\n")}

OPEN MAINTENANCE ISSUES (${maintenance.length}):
${maintenance.length > 0 ? maintenance.map((l) => `  ${l.machine?.code} — ${l.type} started ${l.startedAt.toDateString()}: ${l.description.slice(0, 80)}`).join("\n") : "  None"}

PRODUCTION ORDERS (${openOrders.length} open):
${ordersStr || "  No open orders"}

WIRE INVENTORY:
  ${wireStr || "No wire batches"}

MESH FINISHED GOODS:
  ${meshStr || "No SKUs defined"}

QUALITY (last 7 days — ${quality.length} checks): Pass rate ${qcPassRate}%

PRODUCTION OUTPUT (last 7 days — ${reports.length} shifts):
  Mesh produced: ${totalMeshKg.toLocaleString()} kg | Wire consumed: ${totalWireKg.toLocaleString()} kg

Answer questions about production operations, scheduling, inventory management, machine status, and quality. Be concise and data-driven.`;
}

export async function buildSalesContext(): Promise<string> {
  const today = new Date();
  const since30d = new Date(today.getTime() - 30 * 86400000);
  const since7d = new Date(today.getTime() - 7 * 86400000);

  const [mesh, orders, machines, reports] = await Promise.all([
    prisma.meshInventory.findMany({ orderBy: { sku: "asc" } }),
    prisma.productionOrder.findMany({
      where: { status: { in: ["DRAFT", "IN_PROGRESS"] } },
      include: { lines: { include: { mesh: { select: { sku: true } } } } },
      orderBy: { plannedDate: "asc" },
    }),
    prisma.machine.findMany({ where: { status: "OPERATIONAL" }, select: { code: true, name: true } }),
    prisma.dailyProductionReport.findMany({ where: { reportDate: { gte: since7d } }, orderBy: { reportDate: "desc" } }),
  ]);

  const catalogStr = mesh.map((m) =>
    `SKU: ${m.sku} | Size: ${Number(m.lengthM)}m × ${Number(m.widthM)}m | Wire: Ø${Number(m.wireDiameterMm)}mm | Grid: ${m.gridSpacingMm}mm | Unit weight: ${Number(m.unitWeightKg)} kg | IN STOCK: ${m.qtyInStock} pcs${m.qtyInStock === 0 ? " ⚠️ OUT OF STOCK" : m.qtyInStock < 10 ? " ⚠️ LOW" : ""}`
  ).join("\n  ");

  const orderBacklog = orders.map((o) =>
    `${o.orderCode} [${o.status}] — ${o.lines.map((l) => `${l.qtyOrdered - l.qtyProduced} ${l.mesh?.sku ?? "?"} remaining`).join(", ")} — planned ${o.plannedDate.toDateString()}`
  ).join("\n  ");

  const weekOutput = reports.reduce((s, r) => s + Number(r.meshProducedKg), 0);
  const avgDaily = reports.length > 0 ? (weekOutput / reports.length).toFixed(0) : "0";

  return `You are a sales assistant for ZY Steel Cambodia (中粤铁网), helping with customer inquiries and order feasibility.
Today: ${today.toDateString()}
Products: Steel reinforcement mesh (rebar mesh) for construction

PRODUCT CATALOG & CURRENT STOCK:
  ${catalogStr || "No products defined yet"}

OPERATIONAL MACHINES: ${machines.length}
  ${machines.map((m) => `${m.code} — ${m.name}`).join(", ") || "None"}

ACTIVE PRODUCTION BACKLOG:
  ${orderBacklog || "No active orders"}

PRODUCTION CAPACITY (last 7 days):
  Total mesh produced: ${weekOutput.toLocaleString()} kg | Average per shift: ${avgDaily} kg

Help customers with:
- Product availability and specifications
- Delivery lead time estimates based on current stock and production
- Feasibility of large orders given current machine capacity
- Standard mesh grades and dimensions
Be helpful, professional, and honest about availability. If stock is low or machines are at capacity, say so clearly.`;
}
