"use client";

import { useState } from "react";

interface SparePartUsage {
  id: number;
  workOrderId: number;
  woNumber: string;
  woTitle: string;
  machineCode: string;
  machineName: string;
  itemId: number;
  itemCode: string;
  itemName: string;
  uom: string;
  quantityUsed: number;
  unitCostUsd: number | null;
  totalCostUsd: number | null;
  notes: string | null;
  createdAt: string;
}

interface InventoryItem {
  id: number;
  itemCode: string;
  name: string;
  unitOfMeasure: string;
  currentStock: number;
  minStock: number;
  unitCostUsd: number | null;
  warehouseName: string;
  warehouseCode: string;
  usageCount: number;
  isLowStock: boolean;
}

interface Props {
  usages: SparePartUsage[];
  inventoryItems: InventoryItem[];
  canWrite: boolean;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtCost(n: number | null) {
  if (n === null) return "—";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function SparePartsManager({ usages, inventoryItems }: Props) {
  const [tab, setTab] = useState<"inventory" | "history">("inventory");
  const [search, setSearch] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [historySearch, setHistorySearch] = useState("");

  const filteredItems = inventoryItems.filter((i) => {
    const matchSearch = !search || `${i.itemCode} ${i.name}`.toLowerCase().includes(search.toLowerCase());
    const matchLow = !lowStockOnly || i.isLowStock;
    return matchSearch && matchLow;
  });

  const filteredUsages = usages.filter((u) => {
    return !historySearch || `${u.woNumber} ${u.itemCode} ${u.itemName} ${u.machineCode}`.toLowerCase().includes(historySearch.toLowerCase());
  });

  const totalCost = usages.reduce((sum, u) => sum + (u.totalCostUsd ?? 0), 0);
  const lowStockCount = inventoryItems.filter((i) => i.isLowStock).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Summary KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
        <div className="kpi-card">
          <div className="kpi-label">Tracked Items</div>
          <div className="kpi-value">{inventoryItems.length}</div>
        </div>
        <div className="kpi-card" style={{ borderTop: lowStockCount > 0 ? "3px solid #ef4444" : undefined }}>
          <div className="kpi-label">Low Stock Items</div>
          <div className="kpi-value" style={{ color: lowStockCount > 0 ? "#ef4444" : "var(--text)" }}>{lowStockCount}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Usage Events</div>
          <div className="kpi-value">{usages.length}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Total Parts Cost</div>
          <div className="kpi-value">{fmtCost(totalCost)}</div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)" }}>
        {(["inventory", "history"] as const).map((t) => (
          <button
            key={t}
            className="btn"
            onClick={() => setTab(t)}
            style={{
              borderRadius: 0, borderBottom: tab === t ? "2px solid var(--primary)" : "none",
              fontWeight: tab === t ? 600 : 400, color: tab === t ? "var(--primary)" : "var(--text-2)",
              background: "transparent",
            }}
          >
            {t === "inventory" ? "Inventory Items" : "Usage History"}
          </button>
        ))}
      </div>

      {/* Inventory Tab */}
      {tab === "inventory" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <input className="input" placeholder="Search code, name..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 220 }} />
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
              <input type="checkbox" checked={lowStockOnly} onChange={(e) => setLowStockOnly(e.target.checked)} />
              Low stock only
            </label>
            <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-3)" }}>{filteredItems.length} items</span>
          </div>
          <div className="panel">
            <div style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Warehouse</th>
                    <th>Current Stock</th>
                    <th>Min Stock</th>
                    <th>UoM</th>
                    <th>Unit Cost</th>
                    <th>Stock Value</th>
                    <th>Times Used</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.length === 0 ? (
                    <tr><td colSpan={10} style={{ textAlign: "center", color: "var(--text-3)", padding: 24 }}>No items found</td></tr>
                  ) : filteredItems.map((i) => (
                    <tr key={i.id}>
                      <td><code style={{ fontSize: 11 }}>{i.itemCode}</code></td>
                      <td style={{ fontWeight: 500 }}>{i.name}</td>
                      <td style={{ fontSize: 12 }}>{i.warehouseName}</td>
                      <td style={{ fontWeight: 600, color: i.isLowStock ? "#ef4444" : undefined }}>{i.currentStock.toLocaleString()}</td>
                      <td style={{ fontSize: 12 }}>{i.minStock.toLocaleString()}</td>
                      <td style={{ fontSize: 12, color: "var(--text-3)" }}>{i.unitOfMeasure}</td>
                      <td style={{ fontSize: 12 }}>{fmtCost(i.unitCostUsd)}</td>
                      <td style={{ fontSize: 12 }}>{i.unitCostUsd !== null ? fmtCost(i.currentStock * i.unitCostUsd) : "—"}</td>
                      <td style={{ textAlign: "center" }}>{i.usageCount}</td>
                      <td>
                        {i.isLowStock ? (
                          <span className="tag" style={{ background: "#ef444420", color: "#ef4444", fontSize: 11 }}>Low Stock</span>
                        ) : (
                          <span className="tag" style={{ background: "#10b98120", color: "#10b981", fontSize: 11 }}>OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Usage History Tab */}
      {tab === "history" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <input className="input" placeholder="Search WO#, item, machine..." value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} style={{ minWidth: 260 }} />
            <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--text-3)" }}>{filteredUsages.length} records</span>
          </div>
          <div className="panel">
            <div style={{ padding: 0 }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>WO #</th>
                    <th>Machine</th>
                    <th>Item</th>
                    <th>Qty Used</th>
                    <th>UoM</th>
                    <th>Unit Cost</th>
                    <th>Total Cost</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsages.length === 0 ? (
                    <tr><td colSpan={9} style={{ textAlign: "center", color: "var(--text-3)", padding: 24 }}>No usage records</td></tr>
                  ) : filteredUsages.map((u) => (
                    <tr key={u.id}>
                      <td style={{ fontSize: 12 }}>{fmtDate(u.createdAt)}</td>
                      <td><code style={{ fontSize: 11 }}>{u.woNumber}</code></td>
                      <td style={{ fontSize: 12 }}>{u.machineCode} — {u.machineName}</td>
                      <td style={{ fontSize: 12, fontWeight: 500 }}>{u.itemName}</td>
                      <td style={{ fontWeight: 600 }}>{u.quantityUsed.toLocaleString()}</td>
                      <td style={{ fontSize: 12, color: "var(--text-3)" }}>{u.uom}</td>
                      <td style={{ fontSize: 12 }}>{fmtCost(u.unitCostUsd)}</td>
                      <td style={{ fontSize: 12, fontWeight: 600 }}>{fmtCost(u.totalCostUsd)}</td>
                      <td style={{ fontSize: 12, color: "var(--text-3)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.notes ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
