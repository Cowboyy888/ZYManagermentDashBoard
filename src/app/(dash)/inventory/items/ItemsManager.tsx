"use client";
import { useState, useTransition, useMemo } from "react";
import dynamic from "next/dynamic";
import { createInventoryItem, updateInventoryItem } from "@/actions/inventory";

const ExportMenu = dynamic(() => import("@/components/ExportMenu").then((m) => m.ExportMenu), { ssr: false });

type Item = {
  id: number; itemCode: string; name: string;
  categoryId: number; categoryName: string; categoryCode: string;
  warehouseId: number; warehouseCode: string; warehouseName: string;
  unitOfMeasure: string; specification: string | null;
  minStock: number; maxStock: number | null;
  currentStock: number; unitCostUsd: number | null;
  status: string; notes: string | null; updatedAt: string;
};
type Category  = { id: number; name: string; code: string };
type Warehouse = { id: number; name: string; code: string };

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  ACTIVE:       { bg: "var(--green-bg)",  color: "var(--green)" },
  INACTIVE:     { bg: "var(--border)",    color: "var(--text-3)" },
  DISCONTINUED: { bg: "var(--red-bg)",    color: "var(--red)" },
};

const blank = {
  itemCode: "", name: "", categoryId: "", warehouseId: "",
  unitOfMeasure: "", specification: "", minStock: "0", maxStock: "",
  unitCostUsd: "", status: "ACTIVE", notes: "",
};

function fmtDate(iso: string) { return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
function fmtUsd(n: number | null) { return n === null ? "—" : `$${n.toLocaleString("en-US", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}`; }

export function ItemsManager({
  items: initial,
  categories,
  warehouses,
  canManage,
  canWrite,
}: {
  items: Item[];
  categories: Category[];
  warehouses: Warehouse[];
  canManage: boolean;
  canWrite: boolean;
}) {
  const [items, setItems]     = useState(initial);
  const [search, setSearch]   = useState("");
  const [filterCat, setFCat]  = useState("");
  const [filterWh, setFWh]    = useState("");
  const [filterSt, setFSt]    = useState("");

  const [modal, setModal]     = useState<"create" | "edit" | null>(null);
  const [editItem, setEdit]   = useState<Item | null>(null);
  const [form, setForm]       = useState(blank);
  const [err, setErr]         = useState("");
  const [pending, startT]     = useTransition();

  const filtered = useMemo(() => items.filter((i) => {
    if (search && !`${i.itemCode} ${i.name}`.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCat && i.categoryCode !== filterCat) return false;
    if (filterWh  && i.warehouseCode !== filterWh)  return false;
    if (filterSt  && i.status !== filterSt) return false;
    return true;
  }), [items, search, filterCat, filterWh, filterSt]);

  const exportData = useMemo(() => filtered.map((i) => ({
    "Code": i.itemCode, "Name": i.name, "Category": i.categoryName, "Warehouse": i.warehouseName,
    "UOM": i.unitOfMeasure, "Stock": i.currentStock, "Min": i.minStock, "Max": i.maxStock ?? "",
    "Unit Cost (USD)": i.unitCostUsd ?? "", "Status": i.status,
  })), [filtered]);

  function openCreate() { setForm(blank); setErr(""); setEdit(null); setModal("create"); }
  function openEdit(i: Item) {
    setForm({
      itemCode: i.itemCode, name: i.name, categoryId: String(i.categoryId),
      warehouseId: String(i.warehouseId), unitOfMeasure: i.unitOfMeasure,
      specification: i.specification ?? "", minStock: String(i.minStock),
      maxStock: i.maxStock !== null ? String(i.maxStock) : "",
      unitCostUsd: i.unitCostUsd !== null ? String(i.unitCostUsd) : "",
      status: i.status, notes: i.notes ?? "",
    });
    setErr(""); setEdit(i); setModal("edit");
  }
  function closeModal() { setModal(null); setEdit(null); }

  function submit() {
    setErr("");
    const payload = {
      itemCode: form.itemCode, name: form.name,
      categoryId: Number(form.categoryId), warehouseId: Number(form.warehouseId),
      unitOfMeasure: form.unitOfMeasure,
      specification: form.specification || undefined,
      minStock: Number(form.minStock || "0"),
      maxStock: form.maxStock ? Number(form.maxStock) : undefined,
      unitCostUsd: form.unitCostUsd ? Number(form.unitCostUsd) : undefined,
      status: form.status,
      notes: form.notes || undefined,
    };
    startT(async () => {
      if (modal === "create") {
        const res = await createInventoryItem(payload);
        if ("error" in res) { setErr(res.error); return; }
        const cat = categories.find((c) => c.id === payload.categoryId)!;
        const wh  = warehouses.find((w) => w.id === payload.warehouseId)!;
        const nd  = res.data;
        setItems((p) => [...p, {
          id: nd.id, itemCode: nd.itemCode, name: nd.name,
          categoryId: nd.categoryId, categoryName: cat.name, categoryCode: cat.code,
          warehouseId: nd.warehouseId, warehouseCode: wh.code, warehouseName: wh.name,
          unitOfMeasure: nd.unitOfMeasure, specification: nd.specification,
          minStock: Number(nd.minStock), maxStock: nd.maxStock !== null ? Number(nd.maxStock) : null,
          currentStock: Number(nd.currentStock), unitCostUsd: nd.unitCostUsd !== null ? Number(nd.unitCostUsd) : null,
          status: nd.status, notes: nd.notes, updatedAt: nd.updatedAt.toISOString(),
        }]);
      } else if (editItem) {
        const res = await updateInventoryItem({ id: editItem.id, ...payload });
        if ("error" in res) { setErr(res.error); return; }
        const cat = categories.find((c) => c.id === payload.categoryId)!;
        const wh  = warehouses.find((w) => w.id === payload.warehouseId)!;
        const nd  = res.data;
        setItems((p) => p.map((x) => x.id === editItem.id ? {
          ...x, itemCode: nd.itemCode, name: nd.name,
          categoryId: nd.categoryId, categoryName: cat.name, categoryCode: cat.code,
          warehouseId: nd.warehouseId, warehouseCode: wh.code, warehouseName: wh.name,
          unitOfMeasure: nd.unitOfMeasure, specification: nd.specification,
          minStock: Number(nd.minStock), maxStock: nd.maxStock !== null ? Number(nd.maxStock) : null,
          unitCostUsd: nd.unitCostUsd !== null ? Number(nd.unitCostUsd) : null,
          status: nd.status, notes: nd.notes, updatedAt: nd.updatedAt.toISOString(),
        } : x));
      }
      closeModal();
    });
  }

  const stockLevel = (i: Item) => {
    if (i.currentStock === 0) return { label: "Out of Stock", bg: "var(--red-bg)", color: "var(--red)" };
    if (i.currentStock <= i.minStock) return { label: "Low Stock", bg: "var(--amber-bg)", color: "var(--amber)" };
    return null;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search code or name…" style={{ padding: "7px 12px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, width: 200 }} />
        <select value={filterCat} onChange={(e) => setFCat(e.target.value)} style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13 }}>
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c.id} value={c.code}>{c.code} — {c.name}</option>)}
        </select>
        <select value={filterWh} onChange={(e) => setFWh(e.target.value)} style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13 }}>
          <option value="">All Warehouses</option>
          {warehouses.map((w) => <option key={w.id} value={w.code}>{w.code} — {w.name}</option>)}
        </select>
        <select value={filterSt} onChange={(e) => setFSt(e.target.value)} style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13 }}>
          <option value="">All Statuses</option>
          {["ACTIVE", "INACTIVE", "DISCONTINUED"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <ExportMenu title="Inventory Items" filename="inventory-items" data={exportData} columns={[
            { key: "Code", header: "Code" }, { key: "Name", header: "Name" }, { key: "Category", header: "Category" },
            { key: "Warehouse", header: "Warehouse" }, { key: "UOM", header: "UOM" }, { key: "Stock", header: "Stock" },
            { key: "Min", header: "Min" }, { key: "Max", header: "Max" }, { key: "Unit Cost (USD)", header: "Unit Cost" }, { key: "Status", header: "Status" },
          ]} />
          {canWrite && <button className="btn btn-primary" onClick={openCreate}>+ Add Item</button>}
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Items ({filtered.length}{filtered.length !== items.length ? ` of ${items.length}` : ""})</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr><th>Code</th><th>Name</th><th>Category</th><th>Warehouse</th><th>UOM</th><th>Stock</th><th>Min / Max</th><th>Unit Cost</th><th>Status</th><th>Updated</th>{canWrite && <th>Actions</th>}</tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={canWrite ? 11 : 10} style={{ textAlign: "center", padding: "40px 0", color: "var(--text-3)", fontSize: 13 }}>No items match filters</td></tr>
              )}
              {filtered.map((i) => {
                const lvl = stockLevel(i);
                const st  = STATUS_COLORS[i.status] ?? STATUS_COLORS.INACTIVE;
                return (
                  <tr key={i.id}>
                    <td><code style={{ fontSize: 12, fontWeight: 700, color: "var(--steel)", background: "var(--steel-light)", padding: "2px 6px", borderRadius: 4 }}>{i.itemCode}</code></td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{i.name}</div>
                      {i.specification && <div style={{ fontSize: 11, color: "var(--text-3)" }}>{i.specification}</div>}
                    </td>
                    <td style={{ fontSize: 12.5 }}><span className="tag">{i.categoryCode}</span></td>
                    <td style={{ fontSize: 12.5 }}><code style={{ fontSize: 11, color: "var(--text-2)" }}>{i.warehouseCode}</code></td>
                    <td style={{ fontSize: 12, color: "var(--text-2)" }}>{i.unitOfMeasure}</td>
                    <td className="num">
                      <div style={{ fontWeight: 700, color: lvl ? lvl.color : "var(--text)" }}>{i.currentStock}</div>
                      {lvl && <span className="tag" style={{ background: lvl.bg, color: lvl.color, fontSize: 10.5 }}>{lvl.label}</span>}
                    </td>
                    <td className="num" style={{ fontSize: 12.5, color: "var(--text-2)" }}>{i.minStock} / {i.maxStock ?? "∞"}</td>
                    <td className="num" style={{ fontSize: 12.5 }}>{fmtUsd(i.unitCostUsd)}</td>
                    <td><span className="tag" style={st}>{i.status}</span></td>
                    <td style={{ fontSize: 11.5, color: "var(--text-3)" }}>{fmtDate(i.updatedAt)}</td>
                    {canWrite && (
                      <td><button className="btn btn-sm" onClick={() => openEdit(i)}>Edit</button></td>
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
          <div style={{ background: "var(--surface)", borderRadius: 12, padding: 28, width: 520, maxWidth: "95vw", boxShadow: "0 8px 40px rgba(0,0,0,0.25)", margin: "auto" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 20px" }}>{modal === "create" ? "Add Inventory Item" : "Edit Item"}</h2>
            {err && <div style={{ marginBottom: 14, padding: "8px 12px", borderRadius: 6, background: "var(--red-bg)", color: "var(--red)", fontSize: 12.5 }}>{err}</div>}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 16px" }}>
              {[
                { f: "itemCode",      label: "Item Code *",      type: "text",   placeholder: "e.g. RM-WR-001" },
                { f: "name",          label: "Name *",           type: "text",   placeholder: "Item name" },
                { f: "unitOfMeasure", label: "Unit of Measure *", type: "text",   placeholder: "kg / pcs / m" },
                { f: "specification", label: "Specification",     type: "text",   placeholder: "Technical spec" },
                { f: "minStock",      label: "Min Stock",         type: "number", placeholder: "0" },
                { f: "maxStock",      label: "Max Stock",         type: "number", placeholder: "optional" },
                { f: "unitCostUsd",   label: "Unit Cost (USD)",   type: "number", placeholder: "0.0000" },
              ].map(({ f, label, type, placeholder }) => (
                <div key={f} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-2)" }}>{label}</label>
                  <input type={type} step={type === "number" ? "any" : undefined} value={(form as Record<string, string>)[f]} onChange={(e) => setForm((p) => ({ ...p, [f]: e.target.value }))} placeholder={placeholder} style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13 }} />
                </div>
              ))}

              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-2)" }}>Category *</label>
                <select value={form.categoryId} onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value }))} style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13 }}>
                  <option value="">Select category</option>
                  {categories.map((c) => <option key={c.id} value={String(c.id)}>{c.code} — {c.name}</option>)}
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-2)" }}>Warehouse *</label>
                <select value={form.warehouseId} onChange={(e) => setForm((p) => ({ ...p, warehouseId: e.target.value }))} style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13 }}>
                  <option value="">Select warehouse</option>
                  {warehouses.map((w) => <option key={w.id} value={String(w.id)}>{w.code} — {w.name}</option>)}
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-2)" }}>Status</label>
                <select value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))} style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13 }}>
                  {["ACTIVE", "INACTIVE", "DISCONTINUED"].map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>

              <div style={{ gridColumn: "span 2", display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 11.5, fontWeight: 600, color: "var(--text-2)" }}>Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} rows={2} style={{ padding: "7px 10px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, resize: "vertical" }} />
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
              <button className="btn" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" onClick={submit} disabled={pending || !form.itemCode || !form.name || !form.unitOfMeasure || !form.categoryId || !form.warehouseId}>
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
