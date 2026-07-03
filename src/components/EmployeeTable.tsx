"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import {
  useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel,
  getPaginationRowModel, flexRender, type ColumnDef, type SortingState,
} from "@tanstack/react-table";
import { Avatar } from "@/components/Avatar";

export interface EmployeeRow {
  id: number;
  nameEn: string;
  nameKh: string;
  nameZh: string | null;
  employeeCode: string | null;
  photoUrl: string | null;
  dailyRateUsd: number;
  hireDate: string;
  departmentId: number | null;
  department: { id?: number; name: string } | null;
  position: { name: string } | null;
  factoryArea: { name: string; code: string } | null;
  shift: string | null;
  status: "ACTIVE" | "TERMINATED";
}

interface Props {
  data: EmployeeRow[];
  canEdit: boolean;
  onEdit?: (e: EmployeeRow) => void;
  onDeactivate?: (id: number) => void;
}

function StatusBadge({ status }: { status: string }) {
  const active = status === "ACTIVE";
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 20,
      fontSize: 11, fontWeight: 600,
      background: active ? "var(--green-bg)" : "var(--border)",
      color: active ? "var(--green)" : "var(--text-3)",
    }}>
      {active ? "Active" : "Terminated"}
    </span>
  );
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function EmployeeTable({ data, canEdit, onEdit, onDeactivate }: Props) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "nameEn", desc: false }]);
  const [filter, setFilter] = useState("");

  const columns = useMemo<ColumnDef<EmployeeRow>[]>(() => [
    {
      accessorKey: "id", header: "#", size: 52,
      cell: ({ getValue }) => (
        <span style={{ fontSize: 12, color: "var(--text-3)", fontVariantNumeric: "tabular-nums" }}>
          {getValue() as number}
        </span>
      ),
    },
    {
      id: "nameEn", header: "Employee",
      accessorFn: r => `${r.nameEn} ${r.nameKh} ${r.nameZh ?? ""} ${r.employeeCode ?? ""}`,
      sortingFn: (a, b) => a.original.nameEn.localeCompare(b.original.nameEn),
      cell: ({ row: { original: e } }) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar photoUrl={e.photoUrl} name={e.nameEn} size={32} radius={8} />
          <div>
            <Link href={`/employees/${e.id}`}
              style={{ fontWeight: 600, fontSize: 13, color: "var(--text)", textDecoration: "none" }}
              className="hover-link">
              {e.nameEn}
            </Link>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 1 }}>
              {e.nameKh}{e.nameZh ? ` · ${e.nameZh}` : ""}{e.employeeCode ? ` · ${e.employeeCode}` : ""}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "department", header: "Dept / Position",
      accessorFn: r => `${r.department?.name ?? ""} ${r.position?.name ?? ""}`,
      sortingFn: (a, b) => (a.original.department?.name ?? "").localeCompare(b.original.department?.name ?? ""),
      cell: ({ row: { original: e } }) => (
        <div>
          <div style={{ fontSize: 13 }}>{e.department?.name ?? "—"}</div>
          {e.position && <div style={{ fontSize: 11, color: "var(--text-3)" }}>{e.position.name}</div>}
        </div>
      ),
    },
    {
      id: "area", header: "Area / Shift",
      accessorFn: r => `${r.factoryArea?.code ?? ""} ${r.shift ?? ""}`,
      cell: ({ row: { original: e } }) => (
        <div>
          {e.factoryArea ? (
            <span style={{
              display: "inline-block", fontSize: 11, fontWeight: 700,
              padding: "1px 6px", borderRadius: 4,
              background: "var(--blue-bg)", color: "var(--blue)", marginBottom: 2,
            }}>
              {e.factoryArea.code}
            </span>
          ) : <span style={{ color: "var(--text-3)", fontSize: 12 }}>—</span>}
          {e.shift && <div style={{ fontSize: 11, color: "var(--text-3)" }}>{e.shift}</div>}
        </div>
      ),
    },
    {
      accessorKey: "hireDate", header: "Hire Date",
      sortingFn: "alphanumeric",
      cell: ({ getValue }) => (
        <span style={{ fontSize: 12, color: "var(--text-2)", whiteSpace: "nowrap" }}>
          {fmtDate(getValue() as string)}
        </span>
      ),
    },
    {
      accessorKey: "dailyRateUsd", header: "Rate/Day",
      cell: ({ getValue }) => (
        <span style={{ fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
          ${Number(getValue()).toFixed(2)}
        </span>
      ),
    },
    {
      accessorKey: "status", header: "Status",
      cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
    },
    {
      id: "actions", header: "",
      enableSorting: false,
      cell: ({ row: { original: e } }) => (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, whiteSpace: "nowrap" }}>
          <Link href={`/employees/${e.id}`}
            style={{ fontSize: 12, color: "var(--steel)", textDecoration: "none" }}>
            View
          </Link>
          {canEdit && (
            <>
              <button onClick={() => onEdit?.(e)}
                style={{ fontSize: 12, color: "var(--blue)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                Edit
              </button>
              {e.status === "ACTIVE" && (
                <button onClick={() => onDeactivate?.(e.id)}
                  style={{ fontSize: 12, color: "var(--red)", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  Deactivate
                </button>
              )}
            </>
          )}
        </div>
      ),
    },
  ], [canEdit, onEdit, onDeactivate]);

  const table = useReactTable({
    data, columns,
    state: { sorting, globalFilter: filter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageIndex: 0, pageSize: 25 } },
  });

  const { pageIndex, pageSize } = table.getState().pagination;
  const filteredCount = table.getFilteredRowModel().rows.length;
  const start = pageIndex * pageSize + 1;
  const end = Math.min((pageIndex + 1) * pageSize, filteredCount);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input
        value={filter}
        onChange={e => setFilter(e.target.value)}
        placeholder="Search by name, code, department… (English / ខ្មែរ / 中文)"
        style={{
          width: "100%", maxWidth: 420, padding: "8px 12px",
          border: "1px solid var(--border)", borderRadius: 8,
          fontSize: 13, background: "var(--surface)", color: "var(--text)",
        }}
        aria-label="Search employees"
      />

      {filteredCount === 0 ? (
        <div style={{
          borderRadius: 10, border: "1.5px dashed var(--border)",
          padding: "40px 24px", textAlign: "center",
          color: "var(--text-3)", fontSize: 14,
        }}>
          No employees match your search.
        </div>
      ) : (
        <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--border)" }}>
          <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "var(--surface-2)" }}>
                {table.getHeaderGroups()[0].headers.map(h => (
                  <th
                    key={h.id}
                    onClick={h.column.getCanSort() ? h.column.getToggleSortingHandler() : undefined}
                    style={{
                      padding: "9px 12px", textAlign: "left",
                      fontWeight: 600, fontSize: 11,
                      textTransform: "uppercase", letterSpacing: "0.04em",
                      color: "var(--text-3)",
                      cursor: h.column.getCanSort() ? "pointer" : "default",
                      userSelect: "none", whiteSpace: "nowrap",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {{ asc: " ↑", desc: " ↓" }[h.column.getIsSorted() as string] ?? ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.getRowModel().rows.map(row => (
                <tr key={row.id} style={{ borderBottom: "1px solid var(--border)" }} className="table-row-hover">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} style={{ padding: "10px 12px", verticalAlign: "middle" }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination controls */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>Rows per page:</span>
          <select
            value={pageSize}
            onChange={e => table.setPageSize(Number(e.target.value))}
            style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 12, background: "var(--surface)" }}
          >
            {[10, 25, 50].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>
            {filteredCount > 0 ? `${start}–${end} of ${filteredCount}` : "0 results"}
            {filteredCount !== data.length && ` (${data.length} total)`}
          </span>
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            style={{
              padding: "4px 12px", borderRadius: 6, border: "1px solid var(--border)",
              background: "var(--surface)", fontSize: 12, cursor: table.getCanPreviousPage() ? "pointer" : "not-allowed",
              opacity: table.getCanPreviousPage() ? 1 : 0.4,
            }}
          >
            ‹ Prev
          </button>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>
            Page {pageIndex + 1} / {table.getPageCount()}
          </span>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            style={{
              padding: "4px 12px", borderRadius: 6, border: "1px solid var(--border)",
              background: "var(--surface)", fontSize: 12, cursor: table.getCanNextPage() ? "pointer" : "not-allowed",
              opacity: table.getCanNextPage() ? 1 : 0.4,
            }}
          >
            Next ›
          </button>
        </div>
      </div>

      <style jsx>{`
        .table-row-hover:hover { background: var(--surface-2); }
        .hover-link:hover { color: var(--steel) !important; text-decoration: underline !important; }
      `}</style>
    </div>
  );
}
