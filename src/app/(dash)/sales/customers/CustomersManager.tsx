"use client";
import { useState, useMemo } from "react";
import { createCustomer, updateCustomer, setCustomerStatus } from "@/actions/sales";

interface Customer {
  id: number; customerCode: string; name: string;
  contactPerson: string | null; phone: string | null; email: string | null;
  address: string | null; country: string; taxId: string | null;
  paymentTerms: string | null; creditLimitUsd: number | null;
  status: string; notes: string | null;
  quotationCount: number; orderCount: number; createdAt: string;
}

const BLANK: Omit<Customer, "id" | "quotationCount" | "orderCount" | "createdAt"> = {
  customerCode: "", name: "", contactPerson: null, phone: null, email: null,
  address: null, country: "Cambodia", taxId: null, paymentTerms: null,
  creditLimitUsd: null, status: "ACTIVE", notes: null,
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "var(--green)", INACTIVE: "var(--amber)", BLACKLISTED: "var(--red)",
};

function Tag({ v }: { v: string }) {
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 100, fontSize: 11, fontWeight: 600, background: `${STATUS_COLORS[v] ?? "#64748b"}22`, color: STATUS_COLORS[v] ?? "#64748b" }}>{v}</span>
  );
}

export function CustomersManager({ customers: initial, canManage }: { customers: Customer[]; canManage: boolean }) {
  const [customers, setCustomers] = useState(initial);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modal, setModal] = useState<null | { mode: "create" | "edit"; draft: Partial<Customer> & typeof BLANK & { id?: number } }>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return customers.filter((c) => {
      if (statusFilter && c.status !== statusFilter) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || c.customerCode.toLowerCase().includes(q) ||
        (c.contactPerson ?? "").toLowerCase().includes(q) || (c.email ?? "").toLowerCase().includes(q);
    });
  }, [customers, search, statusFilter]);

  function openCreate() {
    setModal({ mode: "create", draft: { ...BLANK } });
    setError("");
  }
  function openEdit(c: Customer) {
    setModal({ mode: "edit", draft: { ...c } });
    setError("");
  }
  function closeModal() { setModal(null); setError(""); }

  function setDraft(field: string, value: unknown) {
    setModal((m) => m ? { ...m, draft: { ...m.draft, [field]: value } } : m);
  }

  async function save() {
    if (!modal) return;
    setSaving(true); setError("");
    const payload = {
      ...modal.draft,
      creditLimitUsd: modal.draft.creditLimitUsd !== null && modal.draft.creditLimitUsd !== undefined && String(modal.draft.creditLimitUsd) !== "" ? Number(modal.draft.creditLimitUsd) : null,
    };
    const res = modal.mode === "create"
      ? await createCustomer(payload)
      : await updateCustomer({ ...payload, id: modal.draft.id });
    setSaving(false);
    if ("error" in res) { setError(res.error); return; }
    const d = res.data;
    const shaped: Customer = {
      id: d.id,
      customerCode: d.customerCode,
      name: d.name,
      contactPerson: d.contactPerson,
      phone: d.phone,
      email: d.email,
      address: d.address,
      country: d.country,
      taxId: d.taxId,
      paymentTerms: d.paymentTerms,
      creditLimitUsd: d.creditLimitUsd !== null && d.creditLimitUsd !== undefined ? Number(d.creditLimitUsd) : null,
      status: d.status as string,
      notes: d.notes,
      quotationCount: modal.mode === "create" ? 0 : (customers.find((c) => c.id === d.id)?.quotationCount ?? 0),
      orderCount: modal.mode === "create" ? 0 : (customers.find((c) => c.id === d.id)?.orderCount ?? 0),
      createdAt: d.createdAt.toISOString(),
    };
    if (modal.mode === "create") {
      setCustomers((prev) => [shaped, ...prev]);
    } else {
      setCustomers((prev) => prev.map((c) => c.id === shaped.id ? shaped : c));
    }
    closeModal();
  }

  async function toggleStatus(c: Customer) {
    const next = c.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const res = await setCustomerStatus({ id: c.id, status: next as "ACTIVE" | "INACTIVE" | "BLACKLISTED" });
    if ("error" in res) return;
    setCustomers((prev) => prev.map((x) => x.id === c.id ? { ...x, status: next } : x));
  }

  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const fmtUsd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 0 })}`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          className="input" placeholder="Search name, code, email..." style={{ flex: 1, minWidth: 200 }}
          value={search} onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input" style={{ width: 160 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="BLACKLISTED">Blacklisted</option>
        </select>
        {canManage && <button className="btn btn-primary btn-sm" onClick={openCreate}>+ New Customer</button>}
      </div>

      {/* Table */}
      <div className="panel">
        <div className="panel-body" style={{ padding: 0 }}>
          <table className="data-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Code</th><th>Name</th><th>Contact</th><th>Phone / Email</th>
                <th>Country</th><th style={{ textAlign: "right" }}>Credit Limit</th>
                <th style={{ textAlign: "center" }}>Orders</th><th>Status</th>
                {canManage && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={9} style={{ textAlign: "center", color: "var(--text-3)", padding: 24 }}>No customers found</td></tr>
              )}
              {filtered.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontFamily: "monospace", fontSize: 12 }}>{c.customerCode}</td>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td style={{ fontSize: 12 }}>{c.contactPerson ?? "—"}</td>
                  <td style={{ fontSize: 12 }}>
                    {c.phone && <div>{c.phone}</div>}
                    {c.email && <div style={{ color: "var(--text-3)" }}>{c.email}</div>}
                    {!c.phone && !c.email && "—"}
                  </td>
                  <td style={{ fontSize: 12 }}>{c.country}</td>
                  <td style={{ textAlign: "right", fontSize: 13, fontWeight: 600 }}>{c.creditLimitUsd !== null ? fmtUsd(c.creditLimitUsd) : "—"}</td>
                  <td style={{ textAlign: "center", fontSize: 13 }}>{c.orderCount}</td>
                  <td><Tag v={c.status} /></td>
                  {canManage && (
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-sm" onClick={() => openEdit(c)}>Edit</button>
                        <button className="btn btn-sm" onClick={() => toggleStatus(c)}>{c.status === "ACTIVE" ? "Deactivate" : "Activate"}</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div style={{ background: "var(--surface)", borderRadius: 12, padding: 24, width: "100%", maxWidth: 640, maxHeight: "90vh", overflowY: "auto" }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 20px" }}>
              {modal.mode === "create" ? "New Customer" : "Edit Customer"}
            </h2>
            {error && <div style={{ padding: "8px 12px", background: "var(--red-bg)", color: "var(--red)", borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{error}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 4 }}>Customer Code *</label>
                <input className="input" value={modal.draft.customerCode} onChange={(e) => setDraft("customerCode", e.target.value)} placeholder="CUST-001" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 4 }}>Name *</label>
                <input className="input" value={modal.draft.name} onChange={(e) => setDraft("name", e.target.value)} placeholder="Company name" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 4 }}>Contact Person</label>
                <input className="input" value={modal.draft.contactPerson ?? ""} onChange={(e) => setDraft("contactPerson", e.target.value || null)} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 4 }}>Phone</label>
                <input className="input" value={modal.draft.phone ?? ""} onChange={(e) => setDraft("phone", e.target.value || null)} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 4 }}>Email</label>
                <input className="input" type="email" value={modal.draft.email ?? ""} onChange={(e) => setDraft("email", e.target.value || null)} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 4 }}>Country</label>
                <input className="input" value={modal.draft.country} onChange={(e) => setDraft("country", e.target.value)} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 4 }}>Address</label>
                <textarea className="input" rows={2} value={modal.draft.address ?? ""} onChange={(e) => setDraft("address", e.target.value || null)} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 4 }}>Tax ID</label>
                <input className="input" value={modal.draft.taxId ?? ""} onChange={(e) => setDraft("taxId", e.target.value || null)} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 4 }}>Payment Terms</label>
                <input className="input" value={modal.draft.paymentTerms ?? ""} onChange={(e) => setDraft("paymentTerms", e.target.value || null)} placeholder="e.g. Net 30" />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 4 }}>Credit Limit (USD)</label>
                <input className="input" type="number" min="0" step="100" value={modal.draft.creditLimitUsd ?? ""} onChange={(e) => setDraft("creditLimitUsd", e.target.value ? Number(e.target.value) : null)} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 4 }}>Status</label>
                <select className="input" value={modal.draft.status} onChange={(e) => setDraft("status", e.target.value)}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                  <option value="BLACKLISTED">Blacklisted</option>
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 4 }}>Notes</label>
                <textarea className="input" rows={2} value={modal.draft.notes ?? ""} onChange={(e) => setDraft("notes", e.target.value || null)} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <button className="btn btn-sm" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
