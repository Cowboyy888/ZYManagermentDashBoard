"use client";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useState, type ReactNode } from "react";
import { Pagination } from "./Pagination";

interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  searchable?: boolean;
  searchPlaceholder?: string;
  pageSize?: number;
  toolbar?: ReactNode;
  emptyMessage?: string;
  stickyHeader?: boolean;
  onRowClick?: (row: T) => void;
}

export function DataTable<T>({
  data,
  columns,
  searchable = false,
  searchPlaceholder = "Search…",
  pageSize: defaultPageSize = 25,
  toolbar,
  emptyMessage = "No records found.",
  stickyHeader = false,
  onRowClick,
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: defaultPageSize } },
  });

  // Sync pageSize change
  table.setPageSize(pageSize);

  const rows = table.getRowModel().rows;
  const headerGroups = table.getHeaderGroups();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Toolbar */}
      {(searchable || toolbar) && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {searchable && (
            <input
              value={globalFilter}
              onChange={e => setGlobalFilter(e.target.value)}
              placeholder={searchPlaceholder}
              style={{
                padding: "7px 12px",
                borderRadius: 7,
                border: "1px solid var(--border)",
                fontSize: 13,
                color: "var(--text)",
                background: "var(--surface)",
                outline: "none",
                minWidth: 220,
              }}
            />
          )}
          {toolbar}
        </div>
      )}

      {/* Table */}
      <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--border)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            {headerGroups.map(hg => (
              <tr key={hg.id} style={{ background: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
                {hg.headers.map(header => {
                  const canSort = header.column.getCanSort();
                  const sorted = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      colSpan={header.colSpan}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      style={{
                        padding: "10px 12px",
                        textAlign: "left",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--text-3)",
                        whiteSpace: "nowrap",
                        cursor: canSort ? "pointer" : "default",
                        userSelect: "none",
                        position: stickyHeader ? "sticky" : undefined,
                        top: stickyHeader ? 0 : undefined,
                        background: stickyHeader ? "var(--surface-2)" : undefined,
                        zIndex: stickyHeader ? 1 : undefined,
                      }}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                        {canSort && (
                          <span style={{ opacity: sorted ? 1 : 0.3, fontSize: 10 }}>
                            {sorted === "asc" ? "▲" : sorted === "desc" ? "▼" : "⇅"}
                          </span>
                        )}
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{ padding: 40, textAlign: "center", color: "var(--text-3)", fontSize: 14 }}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map(row => (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  style={{
                    borderBottom: "1px solid var(--border)",
                    cursor: onRowClick ? "pointer" : undefined,
                  }}
                >
                  {row.getVisibleCells().map(cell => (
                    <td
                      key={cell.id}
                      style={{ padding: "11px 12px", fontSize: 13, color: "var(--text)" }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <Pagination
        page={table.getState().pagination.pageIndex + 1}
        totalPages={table.getPageCount()}
        onPageChange={p => table.setPageIndex(p - 1)}
        total={table.getFilteredRowModel().rows.length}
        pageSize={pageSize}
        onPageSizeChange={setPageSize}
      />
    </div>
  );
}
