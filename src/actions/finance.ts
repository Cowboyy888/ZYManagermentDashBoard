"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "../lib/db";
import { guard } from "../lib/auth/session";

function errMsg(e: unknown): string {
  if (e instanceof Error) {
    if (e.message === "Not authenticated") redirect("/login");
    if (e.name === "ForbiddenError") return "You do not have permission.";
    return e.message;
  }
  return "Unexpected error";
}
function ok<T>(data: T) { return { ok: true as const, data }; }
function err(error: string) { return { ok: false as const, error }; }

// ── Auto-number helpers ───────────────────────────────────────────────────────

async function nextInvoiceNumber(): Promise<string> {
  const now = new Date();
  const prefix = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-`;
  const last = await prisma.invoice.findFirst({
    where: { invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true },
  });
  const seq = last ? parseInt(last.invoiceNumber.slice(-4)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

async function nextBillNumber(): Promise<string> {
  const now = new Date();
  const prefix = `BILL-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-`;
  const last = await prisma.supplierBill.findFirst({
    where: { billNumber: { startsWith: prefix } },
    orderBy: { billNumber: "desc" },
    select: { billNumber: true },
  });
  const seq = last ? parseInt(last.billNumber.slice(-4)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

async function nextPaymentNumber(): Promise<string> {
  const now = new Date();
  const prefix = `PAY-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-`;
  const last = await prisma.payment.findFirst({
    where: { paymentNumber: { startsWith: prefix } },
    orderBy: { paymentNumber: "desc" },
    select: { paymentNumber: true },
  });
  const seq = last ? parseInt(last.paymentNumber.slice(-4)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

async function nextExpenseNumber(): Promise<string> {
  const now = new Date();
  const prefix = `EXP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}-`;
  const last = await prisma.expense.findFirst({
    where: { expenseNumber: { startsWith: prefix } },
    orderBy: { expenseNumber: "desc" },
    select: { expenseNumber: true },
  });
  const seq = last ? parseInt(last.expenseNumber.slice(-4)) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

// ── Finance Summary (Dashboard) ───────────────────────────────────────────────

export async function getFinanceSummary() {
  try {
    await guard("finance.read");
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const last6mo = new Date(today.getFullYear(), today.getMonth() - 5, 1);

    const [
      arTotal,
      apTotal,
      arOverdue,
      apOverdue,
      monthRevAgg,
      monthExpAgg,
      monthPayrollAgg,
      last6moInvoices,
      last6moBills,
      last6moExpenses,
      recentInvoices,
      recentBills,
    ] = await Promise.all([
      // Total outstanding AR (invoices not fully paid)
      prisma.invoice.aggregate({
        where: { status: { notIn: ["VOID", "PAID"] } },
        _sum: { totalUsd: true, paidUsd: true },
      }),
      // Total outstanding AP (bills not fully paid)
      prisma.supplierBill.aggregate({
        where: { status: { notIn: ["VOID", "PAID"] } },
        _sum: { totalUsd: true, paidUsd: true },
      }),
      // Overdue AR
      prisma.invoice.count({
        where: { status: { notIn: ["VOID", "PAID"] }, dueDate: { lt: today } },
      }),
      // Overdue AP
      prisma.supplierBill.count({
        where: { status: { notIn: ["VOID", "PAID"] }, dueDate: { lt: today } },
      }),
      // Revenue this month (paid/partial invoices)
      prisma.invoice.aggregate({
        where: { status: { notIn: ["VOID", "DRAFT"] }, invoiceDate: { gte: monthStart } },
        _sum: { totalUsd: true },
      }),
      // Approved/paid expenses this month
      prisma.expense.aggregate({
        where: { status: { in: ["APPROVED", "PAID"] }, expenseDate: { gte: monthStart } },
        _sum: { amountUsd: true },
      }),
      // Payroll costs this month (sum from payslips)
      prisma.payslip.aggregate({
        where: { createdAt: { gte: monthStart } },
        _sum: { grossUsd: true },
      }),
      // Last 6 months invoices for trend
      prisma.invoice.findMany({
        where: { status: { notIn: ["VOID", "DRAFT"] }, invoiceDate: { gte: last6mo } },
        select: { invoiceDate: true, totalUsd: true },
      }),
      // Last 6 months bills for trend
      prisma.supplierBill.findMany({
        where: { status: { not: "VOID" }, billDate: { gte: last6mo } },
        select: { billDate: true, totalUsd: true },
      }),
      // Last 6 months expenses for trend
      prisma.expense.findMany({
        where: { status: { in: ["APPROVED", "PAID"] }, expenseDate: { gte: last6mo } },
        select: { expenseDate: true, amountUsd: true },
      }),
      // Recent invoices
      prisma.invoice.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { customer: { select: { name: true } } },
      }),
      // Recent bills
      prisma.supplierBill.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { supplier: { select: { name: true } } },
      }),
    ]);

    const arBalance = Number(arTotal._sum.totalUsd ?? 0) - Number(arTotal._sum.paidUsd ?? 0);
    const apBalance = Number(apTotal._sum.totalUsd ?? 0) - Number(apTotal._sum.paidUsd ?? 0);
    const monthRevenue = Number(monthRevAgg._sum.totalUsd ?? 0);
    const monthExpenses = Number(monthExpAgg._sum.amountUsd ?? 0) + Number(monthPayrollAgg._sum.grossUsd ?? 0);
    const monthProfit = monthRevenue - monthExpenses;

    // Monthly trend buckets
    const trendBuckets: Record<string, { month: string; revenue: number; expenses: number }> = {};
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      trendBuckets[k] = { month: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }), revenue: 0, expenses: 0 };
    }
    for (const inv of last6moInvoices) {
      const d = inv.invoiceDate as Date;
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (k in trendBuckets) trendBuckets[k].revenue += Number(inv.totalUsd);
    }
    for (const b of last6moBills) {
      const d = b.billDate as Date;
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (k in trendBuckets) trendBuckets[k].expenses += Number(b.totalUsd);
    }
    for (const e of last6moExpenses) {
      const d = e.expenseDate as Date;
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (k in trendBuckets) trendBuckets[k].expenses += Number(e.amountUsd);
    }
    const monthlyTrend = Object.values(trendBuckets);

    return ok({
      monthRevenue,
      monthExpenses,
      monthProfit,
      arBalance,
      apBalance,
      arOverdue,
      apOverdue,
      cashBalance: arBalance - apBalance,
      monthlyTrend,
      recentInvoices: recentInvoices.map((i) => ({
        id: i.id, invoiceNumber: i.invoiceNumber, customerName: i.customer.name,
        invoiceDate: (i.invoiceDate as Date).toISOString(),
        dueDate: (i.dueDate as Date).toISOString(),
        status: i.status, totalUsd: Number(i.totalUsd), paidUsd: Number(i.paidUsd),
      })),
      recentBills: recentBills.map((b) => ({
        id: b.id, billNumber: b.billNumber, supplierName: b.supplier.name,
        billDate: (b.billDate as Date).toISOString(),
        dueDate: (b.dueDate as Date).toISOString(),
        status: b.status, totalUsd: Number(b.totalUsd), paidUsd: Number(b.paidUsd),
      })),
    });
  } catch (e) { return err(errMsg(e)); }
}

// ── Executive Summary ─────────────────────────────────────────────────────────

export async function getFinanceExecutiveSummary() {
  try {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const [revAgg, expAgg, payrollAgg, arAgg, apAgg] = await Promise.all([
      prisma.invoice.aggregate({
        where: { status: { notIn: ["VOID", "DRAFT"] }, invoiceDate: { gte: monthStart } },
        _sum: { totalUsd: true },
      }),
      prisma.expense.aggregate({
        where: { status: { in: ["APPROVED", "PAID"] }, expenseDate: { gte: monthStart } },
        _sum: { amountUsd: true },
      }),
      prisma.payslip.aggregate({
        where: { createdAt: { gte: monthStart } },
        _sum: { grossUsd: true },
      }),
      prisma.invoice.aggregate({
        where: { status: { notIn: ["VOID", "PAID"] } },
        _sum: { totalUsd: true, paidUsd: true },
      }),
      prisma.supplierBill.aggregate({
        where: { status: { notIn: ["VOID", "PAID"] } },
        _sum: { totalUsd: true, paidUsd: true },
      }),
    ]);

    const revenue = Number(revAgg._sum.totalUsd ?? 0);
    const expenses = Number(expAgg._sum.amountUsd ?? 0) + Number(payrollAgg._sum.grossUsd ?? 0);
    const arBalance = Number(arAgg._sum.totalUsd ?? 0) - Number(arAgg._sum.paidUsd ?? 0);
    const apBalance = Number(apAgg._sum.totalUsd ?? 0) - Number(apAgg._sum.paidUsd ?? 0);

    return ok({ revenue, expenses, profit: revenue - expenses, cashBalance: arBalance - apBalance, arBalance, apBalance });
  } catch (e) { return err(errMsg(e)); }
}

// ── Invoices ──────────────────────────────────────────────────────────────────

export async function listInvoices(opts?: { status?: string; customerId?: number; days?: number; limit?: number }) {
  try {
    await guard("finance.read");
    const where: Record<string, unknown> = {};
    if (opts?.status && opts.status !== "ALL") where.status = opts.status;
    if (opts?.customerId) where.customerId = opts.customerId;
    if (opts?.days) {
      const since = new Date(); since.setDate(since.getDate() - opts.days);
      where.createdAt = { gte: since };
    }
    const data = await prisma.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: opts?.limit ?? 200,
      include: {
        customer: { select: { name: true, customerCode: true } },
        salesOrder: { select: { orderNumber: true } },
        items: true,
        _count: { select: { payments: true } },
      },
    });
    return ok(data);
  } catch (e) { return err(errMsg(e)); }
}

export async function createInvoice(raw: {
  customerId: number;
  salesOrderId?: number | null;
  invoiceDate: string;
  dueDate: string;
  taxUsd?: number;
  discountUsd?: number;
  notes?: string | null;
  items: { description: string; quantity: number; unitPriceUsd: number }[];
}) {
  try {
    const session = await guard("finance.write");
    const invoiceNumber = await nextInvoiceNumber();
    const subtotal = raw.items.reduce((s, i) => s + i.quantity * i.unitPriceUsd, 0);
    const taxUsd = raw.taxUsd ?? 0;
    const discountUsd = raw.discountUsd ?? 0;
    const totalUsd = subtotal + taxUsd - discountUsd;

    const inv = await prisma.invoice.create({
      data: {
        invoiceNumber,
        customerId: raw.customerId,
        salesOrderId: raw.salesOrderId ?? null,
        invoiceDate: new Date(raw.invoiceDate),
        dueDate: new Date(raw.dueDate),
        status: "DRAFT",
        subtotalUsd: subtotal,
        taxUsd,
        discountUsd,
        totalUsd,
        paidUsd: 0,
        notes: raw.notes ?? null,
        createdById: session.id,
        items: {
          create: raw.items.map((i) => ({
            description: i.description,
            quantity: i.quantity,
            unitPriceUsd: i.unitPriceUsd,
            totalUsd: i.quantity * i.unitPriceUsd,
          })),
        },
      },
    });
    revalidatePath("/finance/invoices");
    return ok(inv);
  } catch (e) { return err(errMsg(e)); }
}

export async function updateInvoiceStatus(raw: { id: number; status: string }) {
  try {
    await guard("finance.write");
    const inv = await prisma.invoice.update({
      where: { id: raw.id },
      data: { status: raw.status },
    });
    revalidatePath("/finance/invoices");
    return ok(inv);
  } catch (e) { return err(errMsg(e)); }
}

export async function voidInvoice(id: number) {
  try {
    await guard("finance.manage");
    const inv = await prisma.invoice.update({
      where: { id },
      data: { status: "VOID" },
    });
    revalidatePath("/finance/invoices");
    return ok(inv);
  } catch (e) { return err(errMsg(e)); }
}

// ── Supplier Bills ────────────────────────────────────────────────────────────

export async function listBills(opts?: { status?: string; supplierId?: number; days?: number; limit?: number }) {
  try {
    await guard("finance.read");
    const where: Record<string, unknown> = {};
    if (opts?.status && opts.status !== "ALL") where.status = opts.status;
    if (opts?.supplierId) where.supplierId = opts.supplierId;
    if (opts?.days) {
      const since = new Date(); since.setDate(since.getDate() - opts.days);
      where.createdAt = { gte: since };
    }
    const data = await prisma.supplierBill.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: opts?.limit ?? 200,
      include: {
        supplier: { select: { name: true, supplierCode: true } },
        purchaseOrder: { select: { poNumber: true } },
        _count: { select: { payments: true } },
      },
    });
    return ok(data);
  } catch (e) { return err(errMsg(e)); }
}

export async function createBill(raw: {
  supplierId: number;
  purchaseOrderId?: number | null;
  billDate: string;
  dueDate: string;
  subtotalUsd: number;
  taxUsd?: number;
  notes?: string | null;
}) {
  try {
    const session = await guard("finance.write");
    const billNumber = await nextBillNumber();
    const taxUsd = raw.taxUsd ?? 0;
    const totalUsd = raw.subtotalUsd + taxUsd;

    const bill = await prisma.supplierBill.create({
      data: {
        billNumber,
        supplierId: raw.supplierId,
        purchaseOrderId: raw.purchaseOrderId ?? null,
        billDate: new Date(raw.billDate),
        dueDate: new Date(raw.dueDate),
        status: "PENDING",
        subtotalUsd: raw.subtotalUsd,
        taxUsd,
        totalUsd,
        paidUsd: 0,
        notes: raw.notes ?? null,
        createdById: session.id,
      },
    });
    revalidatePath("/finance/bills");
    return ok(bill);
  } catch (e) { return err(errMsg(e)); }
}

export async function voidBill(id: number) {
  try {
    await guard("finance.manage");
    const bill = await prisma.supplierBill.update({
      where: { id },
      data: { status: "VOID" },
    });
    revalidatePath("/finance/bills");
    return ok(bill);
  } catch (e) { return err(errMsg(e)); }
}

// ── Payments ──────────────────────────────────────────────────────────────────

export async function recordPayment(raw: {
  type: "RECEIVED" | "PAID";
  method: string;
  invoiceId?: number | null;
  billId?: number | null;
  amountUsd: number;
  paymentDate: string;
  reference?: string | null;
  notes?: string | null;
}) {
  try {
    const session = await guard("finance.write");
    const paymentNumber = await nextPaymentNumber();

    await prisma.$transaction(async (tx) => {
      await tx.payment.create({
        data: {
          paymentNumber,
          type: raw.type,
          method: raw.method,
          invoiceId: raw.invoiceId ?? null,
          billId: raw.billId ?? null,
          amountUsd: raw.amountUsd,
          paymentDate: new Date(raw.paymentDate),
          reference: raw.reference ?? null,
          notes: raw.notes ?? null,
          createdById: session.id,
        },
      });

      if (raw.invoiceId) {
        const inv = await tx.invoice.findUnique({ where: { id: raw.invoiceId } });
        if (inv) {
          const newPaid = Number(inv.paidUsd) + raw.amountUsd;
          const total = Number(inv.totalUsd);
          const newStatus = newPaid >= total ? "PAID" : newPaid > 0 ? "PARTIAL" : inv.status;
          await tx.invoice.update({
            where: { id: raw.invoiceId },
            data: { paidUsd: newPaid, status: newStatus },
          });
        }
      }

      if (raw.billId) {
        const bill = await tx.supplierBill.findUnique({ where: { id: raw.billId } });
        if (bill) {
          const newPaid = Number(bill.paidUsd) + raw.amountUsd;
          const total = Number(bill.totalUsd);
          const newStatus = newPaid >= total ? "PAID" : newPaid > 0 ? "PARTIAL" : bill.status;
          await tx.supplierBill.update({
            where: { id: raw.billId },
            data: { paidUsd: newPaid, status: newStatus },
          });
        }
      }
    });

    revalidatePath("/finance/payments");
    revalidatePath("/finance/invoices");
    revalidatePath("/finance/bills");
    return ok({ paymentNumber });
  } catch (e) { return err(errMsg(e)); }
}

export async function listPayments(opts?: { type?: string; days?: number; limit?: number }) {
  try {
    await guard("finance.read");
    const where: Record<string, unknown> = {};
    if (opts?.type && opts.type !== "ALL") where.type = opts.type;
    if (opts?.days) {
      const since = new Date(); since.setDate(since.getDate() - opts.days);
      where.paymentDate = { gte: since };
    }
    const data = await prisma.payment.findMany({
      where,
      orderBy: { paymentDate: "desc" },
      take: opts?.limit ?? 300,
      include: {
        invoice: { select: { invoiceNumber: true, customer: { select: { name: true } } } },
        bill: { select: { billNumber: true, supplier: { select: { name: true } } } },
        createdBy: { select: { name: true } },
      },
    });
    return ok(data);
  } catch (e) { return err(errMsg(e)); }
}

// ── Expenses ──────────────────────────────────────────────────────────────────

export async function listExpenseCategories() {
  try {
    await guard("finance.read");
    const data = await prisma.expenseCategory.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    });
    return ok(data);
  } catch (e) { return err(errMsg(e)); }
}

export async function createExpenseCategory(raw: { name: string; code: string; type: string }) {
  try {
    await guard("finance.manage");
    const cat = await prisma.expenseCategory.create({ data: raw });
    revalidatePath("/finance/expenses");
    return ok(cat);
  } catch (e) { return err(errMsg(e)); }
}

export async function listExpenses(opts?: { status?: string; categoryId?: number; days?: number; limit?: number }) {
  try {
    await guard("finance.read");
    const where: Record<string, unknown> = {};
    if (opts?.status && opts.status !== "ALL") where.status = opts.status;
    if (opts?.categoryId) where.categoryId = opts.categoryId;
    if (opts?.days) {
      const since = new Date(); since.setDate(since.getDate() - opts.days);
      where.expenseDate = { gte: since };
    }
    const data = await prisma.expense.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: opts?.limit ?? 300,
      include: {
        category: { select: { name: true, code: true, type: true } },
        submittedBy: { select: { name: true } },
        approvedBy: { select: { name: true } },
      },
    });
    return ok(data);
  } catch (e) { return err(errMsg(e)); }
}

export async function createExpense(raw: {
  categoryId: number;
  description: string;
  amountUsd: number;
  expenseDate: string;
  notes?: string | null;
}) {
  try {
    const session = await guard("finance.write");
    const expenseNumber = await nextExpenseNumber();
    const expense = await prisma.expense.create({
      data: {
        expenseNumber,
        categoryId: raw.categoryId,
        description: raw.description,
        amountUsd: raw.amountUsd,
        expenseDate: new Date(raw.expenseDate),
        status: "PENDING",
        submittedById: session.id,
        notes: raw.notes ?? null,
      },
    });
    revalidatePath("/finance/expenses");
    return ok(expense);
  } catch (e) { return err(errMsg(e)); }
}

export async function updateExpenseStatus(raw: {
  id: number;
  status: "APPROVED" | "REJECTED" | "PAID";
}) {
  try {
    const session = await guard("finance.approve");
    const update: Record<string, unknown> = { status: raw.status };
    if (raw.status === "APPROVED") {
      update.approvedById = session.id;
      update.approvedAt = new Date();
    }
    const expense = await prisma.expense.update({ where: { id: raw.id }, data: update });
    revalidatePath("/finance/expenses");
    return ok(expense);
  } catch (e) { return err(errMsg(e)); }
}

// ── Financial Report Data ─────────────────────────────────────────────────────

export async function getFinancialReportData(opts?: { days?: number }) {
  try {
    await guard("finance.read");
    const days = opts?.days ?? 180;
    const since = new Date(); since.setDate(since.getDate() - days);
    const today = new Date();

    const [invoices, bills, expenses, payrollRuns] = await Promise.all([
      prisma.invoice.findMany({
        where: { status: { notIn: ["VOID"] }, invoiceDate: { gte: since } },
        include: { customer: { select: { name: true, customerCode: true } } },
        orderBy: { invoiceDate: "desc" },
      }),
      prisma.supplierBill.findMany({
        where: { status: { not: "VOID" }, billDate: { gte: since } },
        include: { supplier: { select: { name: true, supplierCode: true } } },
        orderBy: { billDate: "desc" },
      }),
      prisma.expense.findMany({
        where: { status: { in: ["APPROVED", "PAID"] }, expenseDate: { gte: since } },
        include: { category: { select: { name: true, type: true } } },
        orderBy: { expenseDate: "desc" },
      }),
      prisma.payPeriod.findMany({
        where: { endDate: { gte: since } },
        include: {
          payslips: { select: { grossUsd: true, netUsd: true } },
          runs: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
        },
        orderBy: { endDate: "desc" },
      }),
    ]);

    // AR Aging: 0-30, 31-60, 61-90, 90+
    const arAging = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 };
    for (const inv of invoices) {
      if (inv.status === "PAID") continue;
      const outstanding = Number(inv.totalUsd) - Number(inv.paidUsd);
      if (outstanding <= 0) continue;
      const daysOver = Math.floor((today.getTime() - (inv.dueDate as Date).getTime()) / 86400000);
      if (daysOver <= 0) arAging.current += outstanding;
      else if (daysOver <= 30) arAging.days30 += outstanding;
      else if (daysOver <= 60) arAging.days60 += outstanding;
      else if (daysOver <= 90) arAging.days90 += outstanding;
      else arAging.over90 += outstanding;
    }

    // AP Aging
    const apAging = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 };
    for (const bill of bills) {
      if (bill.status === "PAID") continue;
      const outstanding = Number(bill.totalUsd) - Number(bill.paidUsd);
      if (outstanding <= 0) continue;
      const daysOver = Math.floor((today.getTime() - (bill.dueDate as Date).getTime()) / 86400000);
      if (daysOver <= 0) apAging.current += outstanding;
      else if (daysOver <= 30) apAging.days30 += outstanding;
      else if (daysOver <= 60) apAging.days60 += outstanding;
      else if (daysOver <= 90) apAging.days90 += outstanding;
      else apAging.over90 += outstanding;
    }

    return ok({
      invoices: invoices.map((i) => ({
        id: i.id, invoiceNumber: i.invoiceNumber, customerName: i.customer.name, customerCode: i.customer.customerCode,
        invoiceDate: (i.invoiceDate as Date).toISOString(),
        dueDate: (i.dueDate as Date).toISOString(),
        status: i.status, totalUsd: Number(i.totalUsd), paidUsd: Number(i.paidUsd),
        outstanding: Number(i.totalUsd) - Number(i.paidUsd),
      })),
      bills: bills.map((b) => ({
        id: b.id, billNumber: b.billNumber, supplierName: b.supplier.name, supplierCode: b.supplier.supplierCode,
        billDate: (b.billDate as Date).toISOString(),
        dueDate: (b.dueDate as Date).toISOString(),
        status: b.status, totalUsd: Number(b.totalUsd), paidUsd: Number(b.paidUsd),
        outstanding: Number(b.totalUsd) - Number(b.paidUsd),
      })),
      expenses: expenses.map((e) => ({
        id: e.id, expenseNumber: e.expenseNumber, categoryName: e.category.name, categoryType: e.category.type,
        description: e.description, amountUsd: Number(e.amountUsd),
        expenseDate: (e.expenseDate as Date).toISOString(), status: e.status,
      })),
      payrollRuns: payrollRuns.map((p) => ({
        id: p.id,
        periodLabel: p.name ?? `${p.year}-${String(p.month).padStart(2, "0")} ${p.half === 1 ? "1st" : "2nd"}`,
        grossUsd: p.payslips.reduce((s, sl) => s + Number(sl.grossUsd), 0),
        netUsd: p.payslips.reduce((s, sl) => s + Number(sl.netUsd), 0),
        createdAt: (p.runs[0]?.createdAt ?? p.endDate).toISOString(),
      })),
      arAging,
      apAging,
    });
  } catch (e) { return err(errMsg(e)); }
}
