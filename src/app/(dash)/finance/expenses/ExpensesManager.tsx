"use client";

import { useState, useTransition } from "react";
import { createExpense, updateExpenseStatus, createExpenseCategory } from "@/actions/finance";

interface Expense {
  id: number;
  expenseNumber: string;
  categoryId: number;
  categoryName: string;
  categoryType: string;
  description: string;
  amountUsd: number;
  expenseDate: string;
  status: string;
  receipt: string | null;
  submittedByName: string;
  approvedByName: string | null;
  approvedAt: string | null;
  notes: string | null;
  createdAt: string;
}

interface ExpenseCategory { id: number; name: string; code: string; type: string; active: boolean }

interface Props {
  expenses: Expense[];
  categories: ExpenseCategory[];
  canWrite: boolean;
  canApprove: boolean;
  canManage: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#f59e0b", APPROVED: "#6366f1", REJECTED: "#ef4444", PAID: "#10b981",
};

const CATEGORY_TYPES = ["OPERATIONAL", "MAINTENANCE", "PAYROLL", "ADMINISTRATIVE", "OTHER"];

function fmtUsd(n: number) { return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }

export function ExpensesManager({ expenses, categories, canWrite, canApprove, canManage }: Props) {
  const [tab, setTab] = useState<"list" | "create" | "category">("list");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const filtered = expenses.filter((e) => {
    const matchSearch = !search || `${e.expenseNumber} ${e.description} ${e.categoryName}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "ALL" || e.status === statusFilter;
    const matchCat = categoryFilter === "ALL" || e.categoryType === categoryFilter;
    return matchSearch && matchStatus && matchCat;
  });

  const totalPending = expenses.filter((e) => e.status === "PENDING").reduce((s, e) => s + e.amountUsd, 0);
  const totalApproved = expenses.filter((e) => ["APPROVED", "PAID"].includes(e.status)).reduce((s, e) => s + e.amountUsd, 0);

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createExpense({
        categoryId: Number(fd.get("categoryId")),
        description: fd.get("description") as string,
        amountUsd: parseFloat(fd.get("amountUsd") as string),
        expenseDate: fd.get("expenseDate") as string,
        notes: fd.get("notes") as string || null,
      });
      if ("error" in res) { setError(res.error); } else { setTab("list"); setError(""); }
    });
  }

  function handleStatusChange(id: number, status: "APPROVED" | "REJECTED" | "PAID") {
    startTransition(async () => {
      const res = await updateExpenseStatus({ id, status });
      if ("error" in res) setError(res.error);
    });
  }

  function handleCreateCategory(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await createExpenseCategory({
        name: fd.get("name") as string,
        code: fd.get("code") as string,
        type: fd.get("type") as string,
      });
      if ("error" in res) { setError(res.error); } else { setTab("list"); setError(""); }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <div className="kpi-card" style={{ borderTop: "3px solid #f59e0b" }}>
          <div className="kpi-label">Pending Approval</div>
          <div className="kpi-value" style={{ color: "#f59e0b" }}>{expenses.filter((e) => e.status === "PENDING").length}</div>
          <div style={{ fontSize: 11, color: "var(--text-3)" }}>{fmtUsd(totalPending)}</div>
        </div>
        <div className="kpi-card" style={{ borderTop: "3px solid #10b981" }}>
          <div className="kpi-label">Approved / Paid</div>
          <div className="kpi-value" style={{ color: "#10b981" }}>{expenses.filter((e) => ["APPROVED", "PAID"].includes(e.status)).length}</div>
          <div style={{ fontSize: 11, color: "var(--text-3)" }}>{fmtUsd(totalApproved)}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total This Period</div>
          <div className="kpi-value">{expenses.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Categories</div>
          <div className="kpi-value">{categories.length}</div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        {tab === "list" && (
          <>
            <input className="input" placeholder="Search expense#, description..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 200 }} />
            <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 150 }}>
              <option value="ALL">All Statuses</option>
              {["PENDING", "APPROVED", "REJECTED", "PAID"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select className="input" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={{ width: 160 }}>
              <option value="ALL">All Types</option>
              {CATEGORY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>{filtered.length} expenses</span>
          </>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {canManage && (
            <button className="btn btn-sm" onClick={() => { setTab(tab === "category" ? "list" : "category"); setError(""); }}>
              {tab === "category" ? "← List" : "Categories"}
            </button>
          )}
          {canWrite && tab !== "category" && (
            <button className="btn btn-primary" onClick={() => { setTab(tab === "list" ? "create" : "list"); setError(""); }}>
              {tab === "list" ? "+ New Expense" : "← Back to List"}
            </button>
          )}
        </div>
      </div>

      {error && <div style={{ padding: "10px 14px", borderRadius: 8, background: "var(--red-bg)", color: "var(--red)", fontSize: 13 }}>{error}</div>}

      {/* Create Expense */}
      {tab === "create" && (
        <div className="panel">
          <div className="panel-head">Submit Expense</div>
          <form className="panel-body" onSubmit={handleCreate} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "span 2" }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Description *</span>
                <input className="input" name="description" required placeholder="Brief description of the expense" />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Category *</span>
                <select className="input" name="categoryId" required>
                  <option value="">Select category</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}
                </select>
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Amount (USD) *</span>
                <input className="input" type="number" name="amountUsd" required step="0.01" min="0.01" placeholder="0.00" />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Expense Date *</span>
                <input className="input" type="date" name="expenseDate" required defaultValue={new Date().toISOString().slice(0, 10)} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Notes</span>
                <input className="input" name="notes" placeholder="Additional details..." />
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" className="btn" onClick={() => { setTab("list"); setError(""); }}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={isPending}>{isPending ? "Submitting…" : "Submit Expense"}</button>
            </div>
          </form>
        </div>
      )}

      {/* Add Category */}
      {tab === "category" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="panel">
            <div className="panel-head">Add Expense Category</div>
            <form className="panel-body" onSubmit={handleCreateCategory} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Name *</span>
                <input className="input" name="name" required placeholder="e.g. Fuel & Transport" />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Code *</span>
                <input className="input" name="code" required placeholder="e.g. FUEL" style={{ textTransform: "uppercase" }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>Type *</span>
                <select className="input" name="type" required>
                  {CATEGORY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="submit" className="btn btn-primary" disabled={isPending}>{isPending ? "Adding…" : "Add Category"}</button>
              </div>
            </form>
          </div>
          <div className="panel">
            <div className="panel-head">Existing Categories</div>
            <div style={{ padding: 0 }}>
              <table className="data-table">
                <thead><tr><th>Name</th><th>Code</th><th>Type</th></tr></thead>
                <tbody>
                  {categories.map((c) => (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td><code style={{ fontSize: 11 }}>{c.code}</code></td>
                      <td style={{ fontSize: 11 }}>{c.type}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {tab === "list" && (
        <div className="panel">
          <div style={{ padding: 0 }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Expense #</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Amount</th>
                  <th>Date</th>
                  <th>Submitted By</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--text-3)", padding: 24 }}>No expenses found</td></tr>
                ) : filtered.map((exp) => (
                  <tr key={exp.id}>
                    <td><code style={{ fontSize: 11 }}>{exp.expenseNumber}</code></td>
                    <td style={{ maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{exp.description}</td>
                    <td style={{ fontSize: 12 }}>{exp.categoryName}</td>
                    <td style={{ fontWeight: 600 }}>{fmtUsd(exp.amountUsd)}</td>
                    <td style={{ fontSize: 12 }}>{fmtDate(exp.expenseDate)}</td>
                    <td style={{ fontSize: 12 }}>{exp.submittedByName}</td>
                    <td>
                      <span className="tag" style={{ background: (STATUS_COLORS[exp.status] ?? "#94a3b8") + "20", color: STATUS_COLORS[exp.status] ?? "#94a3b8", fontSize: 11 }}>
                        {exp.status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        {canApprove && exp.status === "PENDING" && (
                          <>
                            <button className="btn btn-sm btn-primary" style={{ fontSize: 10 }} onClick={() => handleStatusChange(exp.id, "APPROVED")} disabled={isPending}>Approve</button>
                            <button className="btn btn-sm" style={{ fontSize: 10, color: "#ef4444" }} onClick={() => handleStatusChange(exp.id, "REJECTED")} disabled={isPending}>Reject</button>
                          </>
                        )}
                        {canApprove && exp.status === "APPROVED" && (
                          <button className="btn btn-sm" style={{ fontSize: 10, background: "#10b98120", color: "#10b981" }} onClick={() => handleStatusChange(exp.id, "PAID")} disabled={isPending}>Mark Paid</button>
                        )}
                        {exp.notes && (
                          <span style={{ fontSize: 11, color: "var(--text-3)", alignSelf: "center", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={exp.notes}>
                            {exp.notes}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
