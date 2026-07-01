"use client";
import { useState, useMemo } from "react";
import Link from "next/link";
import {
  useReactTable, getCoreRowModel, getSortedRowModel, getFilteredRowModel,
  flexRender, type ColumnDef, type SortingState,
} from "@tanstack/react-table";

export interface EmployeeRow {
  id: number;
  nameEn: string;
  nameKh: string;
  nameZh: string | null;
  employeeCode: string | null;
  photoUrl: string | null;
  dailyRateUsd: number;
  department: { name: string } | null;
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

function Avatar({ photoUrl, name }: { photoUrl: string | null; name: string }) {
  const initials = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  if (photoUrl) {
    return (
      <img src={photoUrl} alt={name}
        style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
    );
  }
  return (
    <div style={{
      width: 32, height: 32, borderRadius: 8, flexShrink: 0,
      background: "var(--steel-light)", color: "var(--steel)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 11, fontWeight: 700,
    }}>
      {initials}
    </div>
  );
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

export function EmployeeTable({ data, canEdit, onEdit, onDeactivate }: Props) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "id", desc: false }]);
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
      id: "name", header: "Employee",
      accessorFn: r => `${r.nameEn} ${r.nameKh} ${r.nameZh ?? ""} ${r.employeeCode ?? ""}`,
      cell: ({ row: { original: e } }) => (
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar photoUrl={e.photoUrl} name={e.nameEn} />
          <div>
            <Link href={`/employees/${e.id}`}
              style={{ fontWeight: 600, fontSize: 13, color: "var(--text)", textDecoration: "none" }}
              className="hover-link">
              {e.nameEn}
            </Link>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 1 }}>
              {e.nameKh}{e.nameZh ? ` · ${e.nameZh}` : ""} {e.employeeCode ? `· ${e.employeeCode}` : ""}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "dept", header: "Dept / Position",
      accessorFn: r => `${r.department?.name ?? ""} ${r.position?.name ?? ""}`,
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
      cell: ({ row: { original: e } }) => (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
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
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input
        value={filter}
        onChange={e => setFilter(e.target.value)}
        placeholder="Search by name, code, department… (English / ខ្មែរ / 中文)"
        style={{
          width: "100%", maxWidth: 380, padding: "8px 12px",
          border: "1px solid var(--border)", borderRadius: 8,
          fontSize: 13, background: "var(--surface)", color: "var(--text)",
        }}
        aria-label="Search employees"
      />
      {data.length === 0 ? (
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
                    onClick={h.column.getToggleSortingHandler()}
                    style={{
                      padding: "9px 12px", textAlign: "left",
                      fontWeight: 600, fontSize: 11,
                      textTransform: "uppercase", letterSpacing: "0.04em",
                      color: "var(--text-3)", cursor: "pointer",
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
      <p style={{ fontSize: 12, color: "var(--text-3)" }}>
        {table.getRowModel().rows.length} of {data.length} employees
      </p>

      <style jsx>{`
        .table-row-hover:hover { background: var(--surface-2); }
        .hover-link:hover { color: var(--steel) !important; text-decoration: underline !important; }
      `}</style>
    </div>
  );
}
