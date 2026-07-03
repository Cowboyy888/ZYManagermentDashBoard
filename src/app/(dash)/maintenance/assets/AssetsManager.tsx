"use client";

import { useState, useTransition } from "react";
import { updateAsset } from "@/actions/maintenance";

interface Asset {
  id: number;
  code: string;
  name: string;
  type: string;
  status: string;
  factoryAreaId: number | null;
  factoryAreaName: string | null;
  brand: string | null;
  machineModel: string | null;
  serialNumber: string | null;
  capacityKgPerShift: number | null;
  purchaseDate: string | null;
  installationDate: string | null;
  warrantyExpiry: string | null;
  assignedTechnicianId: number | null;
  assignedTechnicianName: string | null;
  notes: string | null;
  workOrderCount: number;
  scheduleCount: number;
  createdAt: string;
}

interface Employee { id: number; nameEn: string }
interface FactoryArea { id: number; name: string; code: string }

interface Props {
  assets: Asset[];
  employees: Employee[];
  factoryAreas: FactoryArea[];
  canManage: boolean;
  canWrite: boolean;
}

const STATUS_OPTIONS = ["OPERATIONAL", "UNDER_MAINTENANCE", "OFFLINE", "RETIRED"];
const STATUS_COLORS: Record<string, string> = {
  OPERATIONAL: "#10b981",
  UNDER_MAINTENANCE: "#f59e0b",
  OFFLINE: "#6366f1",
  RETIRED: "#94a3b8",
};

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function AssetsManager({ assets, employees, factoryAreas, canManage, canWrite }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [editId, setEditId] = useState<number | null>(null);
  const [viewId, setViewId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const filtered = assets.filter((a) => {
    const matchSearch = !search || `${a.code} ${a.name} ${a.brand ?? ""} ${a.serialNumber ?? ""}`.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "ALL" || a.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const editAsset = editId !== null ? assets.find((a) => a.id === editId) : null;
  const viewAsset = viewId !== null ? assets.find((a) => a.id === viewId) : null;

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editAsset) return;
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateAsset({
        id: editAsset.id,
        brand: fd.get("brand") as string || null,
        machineModel: fd.get("machineModel") as string || null,
        serialNumber: fd.get("serialNumber") as string || null,
        status: fd.get("status") as string,
        assignedTechnicianId: fd.get("assignedTechnicianId") ? Number(fd.get("assignedTechnicianId")) : null,
        installationDate: fd.get("installationDate") as string || null,
        warrantyExpiry: fd.get("warrantyExpiry") as string || null,
        notes: fd.get("notes") as string || null,
      });
      if ("error" in res) { setError(res.error); } else { setEditId(null); setError(""); }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Filters */}
      <div className="panel-head" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: "12px 0", borderBottom: "none" }}>
        <input className="input" placeholder="Search code, name, brand..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 220, maxWidth: 320 }} />
        <select className="input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 180 }}>
          <option value="ALL">All Statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-3)" }}>{filtered.length} machines</span>
      </div>

      {error && <div style={{ padding: "10px 14px", borderRadius: 8, background: "var(--red-bg)", color: "var(--red)", fontSize: 13 }}>{error}</div>}

      {/* Table */}
      <div className="panel">
        <div style={{ padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Type</th>
                <th>Area</th>
                <th>Status</th>
                <th>Brand / Model</th>
                <th>Serial</th>
                <th>Technician</th>
                <th>WOs</th>
                <th>Schedules</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={11} style={{ textAlign: "center", color: "var(--text-3)", padding: 24 }}>No machines found</td></tr>
              ) : filtered.map((a) => (
                <tr key={a.id}>
                  <td><code style={{ fontSize: 11 }}>{a.code}</code></td>
                  <td style={{ fontWeight: 500 }}>{a.name}</td>
                  <td style={{ fontSize: 12, color: "var(--text-2)" }}>{a.type}</td>
                  <td style={{ fontSize: 12 }}>{a.factoryAreaName ?? "—"}</td>
                  <td>
                    <span className="tag" style={{ background: (STATUS_COLORS[a.status] ?? "#94a3b8") + "20", color: STATUS_COLORS[a.status] ?? "#94a3b8", fontSize: 11 }}>
                      {a.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td style={{ fontSize: 12 }}>{a.brand ? `${a.brand}${a.machineModel ? " / " + a.machineModel : ""}` : "—"}</td>
                  <td style={{ fontSize: 11, color: "var(--text-3)" }}>{a.serialNumber ?? "—"}</td>
                  <td style={{ fontSize: 12 }}>{a.assignedTechnicianName ?? "—"}</td>
                  <td style={{ textAlign: "center" }}>{a.workOrderCount}</td>
                  <td style={{ textAlign: "center" }}>{a.scheduleCount}</td>
                  <td>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-sm" onClick={() => setViewId(a.id)}>View</button>
                      {canWrite && <button className="btn btn-sm btn-primary" onClick={() => setEditId(a.id)}>Edit</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* View Modal */}
      {viewAsset && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div className="panel" style={{ width: 520, maxHeight: "80vh", overflowY: "auto" }}>
            <div className="panel-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span>{viewAsset.code} — {viewAsset.name}</span>
              <button className="btn btn-sm" onClick={() => setViewId(null)}>Close</button>
            </div>
            <div className="panel-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                ["Type", viewAsset.type],
                ["Status", viewAsset.status.replace(/_/g, " ")],
                ["Factory Area", viewAsset.factoryAreaName ?? "—"],
                ["Brand", viewAsset.brand ?? "—"],
                ["Model", viewAsset.machineModel ?? "—"],
                ["Serial Number", viewAsset.serialNumber ?? "—"],
                ["Capacity (kg/shift)", viewAsset.capacityKgPerShift ?? "—"],
                ["Purchase Date", fmtDate(viewAsset.purchaseDate)],
                ["Installation Date", fmtDate(viewAsset.installationDate)],
                ["Warranty Expiry", fmtDate(viewAsset.warrantyExpiry)],
                ["Technician", viewAsset.assignedTechnicianName ?? "—"],
                ["Work Orders", viewAsset.workOrderCount],
                ["PM Schedules", viewAsset.scheduleCount],
              ].map(([label, val]) => (
                <div key={String(label)}>
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 2 }}>{label}</div>
                  <div style={{ fontSize: 13 }}>{val}</div>
                </div>
              ))}
              {viewAsset.notes && (
                <div style={{ gridColumn: "span 2" }}>
                  <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 2 }}>Notes</div>
                  <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{viewAsset.notes}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editAsset && canManage && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <div className="panel" style={{ width: 540, maxHeight: "85vh", overflowY: "auto" }}>
            <div className="panel-head">Edit: {editAsset.code} — {editAsset.name}</div>
            <form className="panel-body" onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 12, color: "var(--text-2)" }}>Brand</span>
                  <input className="input" name="brand" defaultValue={editAsset.brand ?? ""} placeholder="e.g. Siemens" />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 12, color: "var(--text-2)" }}>Model</span>
                  <input className="input" name="machineModel" defaultValue={editAsset.machineModel ?? ""} placeholder="e.g. G200" />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 12, color: "var(--text-2)" }}>Serial Number</span>
                  <input className="input" name="serialNumber" defaultValue={editAsset.serialNumber ?? ""} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 12, color: "var(--text-2)" }}>Status</span>
                  <select className="input" name="status" defaultValue={editAsset.status}>
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 12, color: "var(--text-2)" }}>Installation Date</span>
                  <input className="input" type="date" name="installationDate" defaultValue={editAsset.installationDate ? editAsset.installationDate.slice(0, 10) : ""} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 12, color: "var(--text-2)" }}>Warranty Expiry</span>
                  <input className="input" type="date" name="warrantyExpiry" defaultValue={editAsset.warrantyExpiry ? editAsset.warrantyExpiry.slice(0, 10) : ""} />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "span 2" }}>
                  <span style={{ fontSize: 12, color: "var(--text-2)" }}>Assigned Technician</span>
                  <select className="input" name="assignedTechnicianId" defaultValue={editAsset.assignedTechnicianId ?? ""}>
                    <option value="">— None —</option>
                    {employees.map((e) => <option key={e.id} value={e.id}>{e.nameEn}</option>)}
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "span 2" }}>
                  <span style={{ fontSize: 12, color: "var(--text-2)" }}>Notes</span>
                  <textarea className="input" name="notes" rows={3} defaultValue={editAsset.notes ?? ""} />
                </label>
              </div>
              {error && <div style={{ padding: "8px 12px", borderRadius: 6, background: "var(--red-bg)", color: "var(--red)", fontSize: 13 }}>{error}</div>}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" className="btn" onClick={() => { setEditId(null); setError(""); }}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={isPending}>{isPending ? "Saving…" : "Save Changes"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Summary by area */}
      {factoryAreas.length > 0 && (
        <div className="panel">
          <div className="panel-head">Assets by Factory Area</div>
          <div className="panel-body" style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            {factoryAreas.map((area) => {
              const count = assets.filter((a) => a.factoryAreaId === area.id).length;
              const opCount = assets.filter((a) => a.factoryAreaId === area.id && a.status === "OPERATIONAL").length;
              if (count === 0) return null;
              return (
                <div key={area.id} style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid var(--border)", minWidth: 140 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{area.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>{count} machines · {opCount} operational</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
