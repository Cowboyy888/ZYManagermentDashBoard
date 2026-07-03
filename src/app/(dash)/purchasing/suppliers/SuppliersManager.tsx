"use client";
import { useState, useTransition, useMemo } from "react";
import dynamic from "next/dynamic";
import { createSupplier, updateSupplier, setSupplierStatus } from "@/actions/purchasing";

const ExportMenu = dynamic(() => import("@/components/ExportMenu").then((m) => m.ExportMenu), { ssr: false });

type Supplier = {
  id: number; supplierCode: string; name: string;
  contactPerson: string | null; phone: string | null; email: string | null;
  address: string | null; taxId: string | null; paymentTerms: string | null;
  currency: string; status: string; notes: string | null;
  orderCount: number; createdAt: string;
};

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  ACTIVE:      { bg: "var(--green-bg)", color: "var(--green)" },
  INACTIVE:    { bg: "var(--border)",   color: "var(--text-3)" },
  BLACKLISTED: { bg: "var(--red-bg)",   color: "var(--red)" },
};

const blank = {
  supplierCode: "", name: "", contactPerson: "", phone: "", email: "",
  address: "", taxId: "", paymentTerms: "", currency: "USD", notes: "",
};

export function SuppliersManager({ suppliers: initial, canManage }: { suppliers: Supplier[]; canManage: boolean }) {
  const [suppliers, setSuppliers] = useState(initial);
  const [search, setSearch]       = useState("");
  const [filterSt, setFSt]        = useState("");
  const [modal, setModal]         = useState<"create" | "edit" | null>(null);
  const [editItem, setEdit]       = useState<Supplier | null>(null);
  const [form, setForm]           = useState(blank);
  const [err, setErr]             = useState("");
  const [pending, startT]         = useTransition();

  const filtered = useMemo(() => suppliers.filter((s) => {
    if (search && !`${s.supplierCode} ${s.name} ${s.contactPerson ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterSt && s.status !== filterSt) return false;
    return true;
  }), [suppliers, search, filterSt]);

  const exportData = useMemo(() => filtered.map((s) => ({
    "Code": s.supplierCode, "Name": s.name, "Contact": s.contactPerson ?? "",
    "Phone": s.phone ?? "", "Email": s.email ?? "", "Tax ID": s.taxId ?? "",
    "Payment Terms": s.paymentTerms ?? "", "Currency": s.currency,
    "Status": s.status, "Orders": s.orderCount,
  })), [filtered]);

  function openCreate() { setForm(blank); setErr(""); setEdit(null); setModal("create"); }
  function openEdit(s: Supplier) {
    setForm({ supplierCode: s.supplierCode, name: s.name, contactPerson: s.contactPerson ?? "",
              phone: s.phone ?? "", email: s.email ?? "", address: s.address ?? "",
              taxId: s.taxId ?? "", paymentTerms: s.paymentTerms ?? "",
              currency: s.currency, notes: s.notes ?? "" });
    setErr(""); setEdit(s); setModal("edit");
  }
  function closeModal() { setModal(null); setEdit(null); }

  function submit() {
    setErr("");
    const payload = {
      supplierCode: form.supplierCode, name: form.name,
      contactPerson: form.contactPerson || undefined, phone: form.phone || undefined,
      email: form.email || undefined, address: form.address || undefined,
      taxId: form.taxId || undefined, paymentTerms: form.paymentTerms || undefined,
      currency: form.currency || "USD", notes: form.notes || undefined,
    };
    startT(async () => {
      if (modal === "create") {
        const res = await createSupplier(payload);
        if ("error" in res) { setErr(res.error); return; }
        setSuppliers((p) => [...p, {
          id: res.data.id, supplierCode: res.data.supplierCode, name: res.data.name,
          contactPerson: res.data.contactPerson, phone: res.data.phone, email: res.data.email,
          address: res.data.address, taxId: res.data.taxId, paymentTerms: res.data.paymentTerms,
          currency: res.data.currency, status: res.data.status, notes: res.data.notes,
          orderCount: 0, createdAt: res.data.createdAt.toISOString(),
        }]);
      } else if (editItem) {
        const res = await updateSupplier({ id: editItem.id, ...payload });
        if ("error" in res) { setErr(res.error); return; }
        setSuppliers((p) => p.map((s) => s.id === editItem.id ? {
          ...s, supplierCode: res.data.supplierCode, name: res.data.name,
          contactPerson: res.data.contactPerson, phone: res.data.phone, email: res.data.email,
          address: res.data.address, taxId: res.data.taxId, paymentTerms: res.data.paymentTerms,
          currency: res.data.currency, notes: res.data.notes,
        } : s));
      }
      closeModal();
    });
  }

  function setStatus(s: Supplier, status: "ACTIVE" | "INACTIVE" | "BLACKLISTED") {
    startT(async () => {
      const res = await setSupplierStatus({ id: s.id, status });
      if (!("error" in res)) setSuppliers((p) => p.map((x) => x.id === s.id ? { ...x, status } : x));
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search code or name…"
          style={{ padding: "7px 12px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, width: 220 }} />
        <select value={filterSt} onChange={(e) => setFSt(e.target.value)}
          style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13 }}>
          <option value="">All Statuses</option>
          {["ACTIVE", "INACTIVE", "BLACKLISTED"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <ExportMenu title="Suppliers" filename="suppliers" data={exportData} columns={[
            { key: "Code", header: "Code" }, { key: "Name", header: "Name" }, { key: "Contact", header: "Contact" },
            { key: "Phone", header: "Phone" }, { key: "Email", header: "Email" }, { key: "Tax ID", header: "Tax ID" },
            { key: "Payment Terms", header: "Payment Terms" }, { key: "Currency", header: "Currency" },
            { key: "Status", header: "Status" }, { key: "Orders", header: "Orders" },
          ]} />
          {canManage && <button className="btn btn-primary" onClick={openCreate}>+ Add Supplier</button>}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Suppliers ({filtered.length}{filtered.length !== suppliers.length ? ` of ${suppliers.length}` : ""})</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr><th>Code</th><th>Name</th><th>Contact</th><th>Phone</th><th>Email</th><th>Terms</th><th>Orders</th><th>Status</th>{canManage && <th>Actions</th>}</tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={canManage ? 9 : 8} style={{ textAlign: "center", padding: "40px 0", color: "var(--text-3)", fontSize: 13 }}>No suppliers found</td></tr>}
              {filtered.map((s) => {
                const st = STATUS_STYLE[s.status] ?? STATUS_STYLE.INACTIVE;
                return (
                  <tr key={s.id}>
                    <td><code style={{ fontSize: 12, fontWeight: 700, color: "var(--steel)", background: "var(--steel-light)", padding: "2px 6px", borderRadius: 4 }}>{s.supplierCode}</code></td>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{s.contactPerson ?? "—"}</td>
                    <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{s.phone ?? "—"}</td>
                    <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{s.email ?? "—"}</td>
                    <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{s.paymentTerms ?? "—"}</td>
                    <td className="num">{s.orderCount}</td>
                    <td><span className="tag" style={st}>{s.status}</span></td>
                    {canManage && (
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn btn-sm" onClick={() => openEdit(s)}>Edit</button>
                          {s.status === "ACTIVE"
                            ? <button className="btn btn-sm" onClick={() => setStatus(s, "INACTIVE")} disabled={pending}>Archive</button>
                            : <button className="btn btn-sm" onClick={() => setStatus(s, "ACTIVE")} disabled={pending}>Activate</button>}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal ── */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", overflowY: "auto" }} onClick={closeModal}>
          <div style={{ background: "var(--surface)", borderRadius: 12, padding: 28, width: 540, maxWidth: "95vw", boxShadow: "0 8px 40px rgba(0,0,0,0.25)", margin: "auto" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 20px" }}>{modal === "create" ? "Add Supplier" : "Edit Supplier"}</h2>
            {err && <div style={{ marginBottom: 14, padding: "8px 12px", borderRadius: 6, background: "var(--red-bg)", color: "var(--red)", fontSize: 12.5 }}>{err}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px" }}>
              {[
                { f: "supplierCode", label: "Supplier Code *", span: 1 },
                { f: "name",         label: "Company Name *",  span: 1 },
                { f: "contactPerson",label: "Contact Person",  span: 1 },
                { f: "phone",        label: "Phone",           span: 1 },
                { f: "email",        label: "Email",           span: 2 },
                { f: "taxId",        label: "Tax ID",          span: 1 },
                { f: "paymentTerms", label: "Payment Terms",   span: 1 },
                { f: "currency",     label: "Currency",        span: 1 },
              ].map(({ f, label, span }) => (
                <div key={f} style={{ gridColumn: `span ${span}`, display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-2)" }}>{label}</label>
                  <input value={(form as Record<string, string>)[f]} onChange={(e) => setForm((p) => ({ ...p, [f]: e.target.value }))}
                    style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13 }} />
                </div>
              ))}
              <div style={{ gridColumn: "span 2", display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-2)" }}>Address</label>
                <textarea value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} rows={2}
                  style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, resize: "vertical" }} />
              </div>
              <div style={{ gridColumn: "span 2", display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-2)" }}>Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={2}
                  style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, resize: "vertical" }} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
              <button className="btn" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" onClick={submit} disabled={pending || !form.supplierCode || !form.name}>
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
