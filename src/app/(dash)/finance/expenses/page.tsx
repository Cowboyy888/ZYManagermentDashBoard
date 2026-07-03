import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { listExpenses, listExpenseCategories } from "@/actions/finance";
import { ExpensesManager } from "./ExpensesManager";

export const metadata: Metadata = { title: "Expense Management" };

export default async function ExpensesPage() {
  const user = await requireUser();

  const [expensesResult, categoriesResult] = await Promise.all([
    listExpenses({ limit: 400 }),
    listExpenseCategories(),
  ]);

  const expenses = expensesResult.ok ? expensesResult.data.map((e) => ({
    id: e.id, expenseNumber: e.expenseNumber,
    categoryId: e.categoryId, categoryName: e.category.name, categoryType: e.category.type,
    description: e.description, amountUsd: Number(e.amountUsd),
    expenseDate: (e.expenseDate as Date).toISOString(),
    status: e.status, receipt: e.receipt,
    submittedByName: e.submittedBy.name,
    approvedByName: e.approvedBy?.name ?? null,
    approvedAt: e.approvedAt?.toISOString() ?? null,
    notes: e.notes, createdAt: e.createdAt.toISOString(),
  })) : [];

  const categories = categoriesResult.ok ? categoriesResult.data : [];

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Expenses</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Submit, approve and track operational expenses</p>
      </div>
      <ExpensesManager
        expenses={expenses}
        categories={categories}
        canWrite={can(user.role, "finance.write")}
        canApprove={can(user.role, "finance.approve")}
        canManage={can(user.role, "finance.manage")}
      />
    </div>
  );
}
