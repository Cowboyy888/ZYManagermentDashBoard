"use client";
import { useState, useTransition } from "react";
import {
  createWarehouse, updateWarehouse, toggleWarehouseActive,
  createCategory, updateCategory,
} from "@/actions/inventory";

type Warehouse = { id: number; code: string; name: string; description: string | null; active: boolean; itemCount: number; createdAt: string };
type Category  = { id: number; name: string; code: string; description: string | null; itemCount: number };

const TABS = ["Warehouses", "Categories"] as const;
type Tab = typeof TABS[number];

const blankWh  = { code: "", name: "", description: "" };
const blankCat = { name: "", code: "", description: "" };

export function WarehousesManager({
  warehouses: initial,
  categories: initialCats,
  canManage,
}: {
  warehouses: Warehouse[];
  categories: Category[];
  canManage: boolean;
}) {
  const [tab, setTab]           = useState<Tab>("Warehouses");
  const [warehouses, setWh]     = useState(initial);
  const [categories, setCats]   = useState(initialCats);

  // warehouse modal
  const [whModal, setWhModal]   = useState<"create" | "edit" | null>(null);
  const [editWh, setEditWh]     = useState<Warehouse | null>(null);
  const [whForm, setWhForm]     = useState(blankWh);
  const [whErr, setWhErr]       = useState("");

  // category modal
  const [catModal, setCatModal] = useState<"create" | "edit" | null>(null);
  const [editCat, setEditCat]   = useState<Category | null>(null);
  const [catForm, setCatForm]   = useState(blankCat);
  const [catErr, setCatErr]     = useState("");

  const [pending, startT]       = useTransition();

  // ── Warehouses ─────────────────────────────────────────────────────────────

  function openCreateWh() { setWhForm(blankWh); setWhErr(""); setEditWh(null); setWhModal("create"); }
  function openEditWh(w: Warehouse) { setWhForm({ code: w.code, name: w.name, description: w.description ?? "" }); setWhErr(""); setEditWh(w); setWhModal("edit"); }
  function closeWhModal() { setWhModal(null); setEditWh(null); }

  function submitWh() {
    setWhErr("");
    startT(async () => {
      if (whModal === "create") {
        const res = await createWarehouse({ code: whForm.code, name: whForm.name, description: whForm.description || undefined });
        if ("error" in res) { setWhErr(res.error); return; }
        setWh((prev) => [...prev, {
          id: res.data.id, code: res.data.code, name: res.data.name,
          description: res.data.description, active: res.data.active,
          itemCount: 0, createdAt: res.data.createdAt.toISOString(),
        }]);
      } else if (editWh) {
        const res = await updateWarehouse({ id: editWh.id, code: whForm.code, name: whForm.name, description: whForm.description || undefined });
        if ("error" in res) { setWhErr(res.error); return; }
        setWh((prev) => prev.map((w) => w.id === editWh.id ? {
          ...w, code: res.data.code, name: res.data.name, description: res.data.description,
        } : w));
      }
      closeWhModal();
    });
  }

  function toggleActive(w: Warehouse) {
    startT(async () => {
      const res = await toggleWarehouseActive({ id: w.id, active: !w.active });
      if (!("error" in res)) setWh((prev) => prev.map((x) => x.id === w.id ? { ...x, active: !w.active } : x));
    });
  }

  // ── Categories ─────────────────────────────────────────────────────────────

  function openCreateCat() { setCatForm(blankCat); setCatErr(""); setEditCat(null); setCatModal("create"); }
  function openEditCat(c: Category) { setCatForm({ name: c.name, code: c.code, description: c.description ?? "" }); setCatErr(""); setEditCat(c); setCatModal("edit"); }
  function closeCatModal() { setCatModal(null); setEditCat(null); }

  function submitCat() {
    setCatErr("");
    startT(async () => {
      if (catModal === "create") {
        const res = await createCategory({ name: catForm.name, code: catForm.code, description: catForm.description || undefined });
        if ("error" in res) { setCatErr(res.error); return; }
        setCats((prev) => [...prev, { ...res.data, itemCount: 0 }]);
      } else if (editCat) {
        const res = await updateCategory({ id: editCat.id, name: catForm.name, code: catForm.code, description: catForm.description || undefined });
        if ("error" in res) { setCatErr(res.error); return; }
        setCats((prev) => prev.map((c) => c.id === editCat.id ? {
          ...c, name: res.data.name, code: res.data.code, description: res.data.description,
        } : c));
      }
      closeCatModal();
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--border)", paddingBottom: 0 }}>
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: "8px 18px", borderRadius: "6px 6px 0 0", border: "none", cursor: "pointer", fontSize: 13.5, fontWeight: tab === t ? 700 : 500, background: tab === t ? "var(--surface)" : "transparent", color: tab === t ? "var(--steel)" : "var(--text-2)", borderBottom: tab === t ? "2px solid var(--steel)" : "2px solid transparent" }}>
            {t}
          </button>
        ))}
      </div>

      {/* ── Warehouses tab ── */}
      {tab === "Warehouses" && (
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">Warehouses ({warehouses.length})</span>
            {canManage && <button className="btn btn-primary" onClick={openCreateWh}>+ Add Warehouse</button>}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr><th>Code</th><th>Name</th><th>Description</th><th>Items</th><th>Status</th>{canManage && <th>Actions</th>}</tr>
              </thead>
              <tbody>
                {warehouses.length === 0 && (
                  <tr><td colSpan={canManage ? 6 : 5} style={{ textAlign: "center", padding: "40px 0", color: "var(--text-3)", fontSize: 13 }}>No warehouses yet</td></tr>
                )}
                {warehouses.map((w) => (
                  <tr key={w.id}>
                    <td><code style={{ fontSize: 12, fontWeight: 700, color: "var(--steel)", background: "var(--steel-light)", padding: "2px 6px", borderRadius: 4 }}>{w.code}</code></td>
                    <td style={{ fontWeight: 600 }}>{w.name}</td>
                    <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{w.description ?? <span style={{ color: "var(--text-3)" }}>—</span>}</td>
                    <td className="num">{w.itemCount}</td>
                    <td>
                      <span className="tag" style={w.active ? { background: "var(--green-bg)", color: "var(--green)" } : { background: "var(--border)", color: "var(--text-3)" }}>
                        {w.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    {canManage && (
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn btn-sm" onClick={() => openEditWh(w)}>Edit</button>
                          <button className="btn btn-sm" onClick={() => toggleActive(w)} disabled={pending}>
                            {w.active ? "Deactivate" : "Activate"}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Categories tab ── */}
      {tab === "Categories" && (
        <div className="panel">
          <div className="panel-head">
            <span className="panel-title">Categories ({categories.length})</span>
            {canManage && <button className="btn btn-primary" onClick={openCreateCat}>+ Add Category</button>}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="data-table">
              <thead>
                <tr><th>Code</th><th>Name</th><th>Description</th><th>Items</th>{canManage && <th>Actions</th>}</tr>
              </thead>
              <tbody>
                {categories.length === 0 && (
                  <tr><td colSpan={canManage ? 5 : 4} style={{ textAlign: "center", padding: "40px 0", color: "var(--text-3)", fontSize: 13 }}>No categories yet</td></tr>
                )}
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td><code style={{ fontSize: 12, fontWeight: 700, color: "var(--steel)", background: "var(--steel-light)", padding: "2px 6px", borderRadius: 4 }}>{c.code}</code></td>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{c.description ?? <span style={{ color: "var(--text-3)" }}>—</span>}</td>
                    <td className="num">{c.itemCount}</td>
                    {canManage && (
                      <td>
                        <button className="btn btn-sm" onClick={() => openEditCat(c)}>Edit</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Warehouse modal ── */}
      {whModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={closeWhModal}>
          <div style={{ background: "var(--surface)", borderRadius: 12, padding: 28, width: 400, maxWidth: "90vw", boxShadow: "0 8px 40px rgba(0,0,0,0.25)" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 20px" }}>{whModal === "create" ? "Add Warehouse" : "Edit Warehouse"}</h2>
            {whErr && <div style={{ marginBottom: 14, padding: "8px 12px", borderRadius: 6, background: "var(--red-bg)", color: "var(--red)", fontSize: 12.5 }}>{whErr}</div>}
            {(["code", "name", "description"] as const).map((f) => (
              <div key={f} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 5, textTransform: "capitalize" }}>{f}</label>
                <input value={whForm[f]} onChange={(e) => setWhForm((p) => ({ ...p, [f]: e.target.value }))} placeholder={f === "code" ? "e.g. WH-A" : ""} style={{ width: "100%", padding: "8px 12px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, boxSizing: "border-box" }} />
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
              <button className="btn" onClick={closeWhModal}>Cancel</button>
              <button className="btn btn-primary" onClick={submitWh} disabled={pending || !whForm.code || !whForm.name}>
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Category modal ── */}
      {catModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={closeCatModal}>
          <div style={{ background: "var(--surface)", borderRadius: 12, padding: 28, width: 400, maxWidth: "90vw", boxShadow: "0 8px 40px rgba(0,0,0,0.25)" }} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 20px" }}>{catModal === "create" ? "Add Category" : "Edit Category"}</h2>
            {catErr && <div style={{ marginBottom: 14, padding: "8px 12px", borderRadius: 6, background: "var(--red-bg)", color: "var(--red)", fontSize: 12.5 }}>{catErr}</div>}
            {(["name", "code", "description"] as const).map((f) => (
              <div key={f} style={{ marginBottom: 14 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-2)", display: "block", marginBottom: 5, textTransform: "capitalize" }}>{f}</label>
                <input value={catForm[f]} onChange={(e) => setCatForm((p) => ({ ...p, [f]: e.target.value }))} placeholder={f === "code" ? "e.g. RM" : ""} style={{ width: "100%", padding: "8px 12px", borderRadius: 7, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", fontSize: 13, boxSizing: "border-box" }} />
              </div>
            ))}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
              <button className="btn" onClick={closeCatModal}>Cancel</button>
              <button className="btn btn-primary" onClick={submitCat} disabled={pending || !catForm.name || !catForm.code}>
                {pending ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
