"use client";

import { useState, useTransition } from "react";
import { getAuditLogs, type AuditEntry } from "@/actions/auditLog";

type Props = {
  initialLogs: AuditEntry[];
  total: number;
  page: number;
};

const PAGE_SIZE = 20;

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function JsonPreview({ data }: { data: unknown }) {
  const [open, setOpen] = useState(false);
  if (data == null) return <span className="text-xs text-gray-400">—</span>;
  return (
    <span>
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-indigo-600 underline"
      >
        {open ? "hide" : "view"}
      </button>
      {open && (
        <pre className="mt-1 text-xs bg-gray-50 border border-gray-200 rounded p-2 max-w-xs overflow-auto max-h-32 whitespace-pre-wrap">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </span>
  );
}

export default function AuditLogViewer({ initialLogs, total, page }: Props) {
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [logs, setLogs] = useState<AuditEntry[]>(initialLogs);
  const [filteredTotal, setFilteredTotal] = useState(total);
  const [currentPage, setCurrentPage] = useState(page);
  const [isPending, startTransition] = useTransition();

  const totalPages = Math.ceil(filteredTotal / PAGE_SIZE);

  function loadPage(p: number, q: string, entity: string) {
    startTransition(async () => {
      const result = await getAuditLogs({ page: p, search: q, entityType: entity });
      setLogs(result.logs);
      setFilteredTotal(result.total);
      setCurrentPage(result.page);
    });
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    loadPage(1, search, entityFilter);
  }

  const entityTypes = Array.from(new Set(initialLogs.map((l) => l.entityType))).sort();

  return (
    <div className="panel">
      <div className="panel-head">
        <span>Audit Log</span>
        <span className="text-sm font-normal text-gray-500">{filteredTotal.toLocaleString()} entries</span>
      </div>
      <div className="panel-body">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-2 mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by user, action, entity ID…"
            className="border border-gray-300 rounded px-3 py-1.5 text-sm flex-1 min-w-48"
          />
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm"
          >
            <option value="">All entity types</option>
            {entityTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <button type="submit" className="btn btn-sm" disabled={isPending}>
            {isPending ? "Loading…" : "Search"}
          </button>
          <button
            type="button"
            className="btn btn-sm"
            style={{ background: "#f3f4f6", color: "#374151" }}
            onClick={() => {
              setSearch("");
              setEntityFilter("");
              loadPage(1, "", "");
            }}
          >
            Clear
          </button>
        </form>

        <div className="overflow-x-auto">
          <table className="data-table w-full text-sm">
            <thead>
              <tr>
                <th>Time</th>
                <th>User</th>
                <th>Action</th>
                <th>Entity</th>
                <th>ID</th>
                <th>IP</th>
                <th>Before</th>
                <th>After</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center text-gray-400 py-8">No audit entries found.</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id}>
                    <td>
                      <span title={new Date(log.createdAt).toLocaleString()}>{timeAgo(log.createdAt)}</span>
                    </td>
                    <td>
                      {log.user ? (
                        <div>
                          <div className="font-medium">{log.user.name}</div>
                          <div className="text-xs text-gray-400">{log.user.email}</div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">System</span>
                      )}
                    </td>
                    <td>
                      <span className="tag" style={{ fontSize: "0.7rem" }}>{log.action}</span>
                    </td>
                    <td>{log.entityType}</td>
                    <td className="font-mono text-xs text-gray-500">{log.entityId}</td>
                    <td className="text-xs text-gray-400">{log.ip ?? "—"}</td>
                    <td><JsonPreview data={log.before} /></td>
                    <td><JsonPreview data={log.after} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <span className="text-sm text-gray-500">
              Page {currentPage} of {totalPages}
            </span>
            <div className="flex gap-1">
              <button
                className="btn btn-sm"
                style={{ background: "#f3f4f6", color: "#374151" }}
                disabled={currentPage <= 1 || isPending}
                onClick={() => loadPage(currentPage - 1, search, entityFilter)}
              >
                ← Prev
              </button>
              <button
                className="btn btn-sm"
                style={{ background: "#f3f4f6", color: "#374151" }}
                disabled={currentPage >= totalPages || isPending}
                onClick={() => loadPage(currentPage + 1, search, entityFilter)}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
