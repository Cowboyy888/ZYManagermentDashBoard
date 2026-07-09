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
  if (data == null) return <span style={{ fontSize: "0.75rem", color: "var(--text-3)" }}>—</span>;
  return (
    <span>
      <button
        onClick={() => setOpen(!open)}
        style={{
          fontSize: "0.75rem",
          color: "var(--steel)",
          textDecoration: "underline",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
        }}
      >
        {open ? "hide" : "view"}
      </button>
      {open && (
        <pre
          style={{
            marginTop: 4,
            fontSize: "0.75rem",
            background: "var(--surface-2)",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: 8,
            maxWidth: 280,
            overflow: "auto",
            maxHeight: 128,
            whiteSpace: "pre-wrap",
          }}
        >
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </span>
  );
}

// ── Shared inline-style equivalents of the project CSS classes ────────────────

const panelStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  overflow: "hidden",
};

const panelHeadStyle: React.CSSProperties = {
  padding: "15px 20px",
  borderBottom: "1px solid var(--border)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const panelBodyStyle: React.CSSProperties = {
  padding: "18px 20px",
};

const btnStyle: React.CSSProperties = {
  height: 36,
  padding: "0 16px",
  borderRadius: "var(--radius)",
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 13.5,
  fontWeight: 500,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  whiteSpace: "nowrap",
};

const btnSmStyle: React.CSSProperties = { ...btnStyle, height: 30, padding: "0 12px", fontSize: 13 };

const btnMutedStyle: React.CSSProperties = {
  ...btnSmStyle,
  background: "var(--surface-2)",
  color: "var(--text)",
};

const inputStyle: React.CSSProperties = {
  height: 36,
  padding: "0 12px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 13.5,
  flex: 1,
  minWidth: 192,
};

const selectStyle: React.CSSProperties = {
  height: 36,
  padding: "0 12px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 13.5,
};

// ── Component ─────────────────────────────────────────────────────────────────

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
    <div style={panelStyle}>
      <div style={panelHeadStyle}>
        <span>Audit Log</span>
        <span style={{ fontSize: "0.875rem", fontWeight: 400, color: "var(--text-2)" }}>
          {filteredTotal.toLocaleString()} entries
        </span>
      </div>
      <div style={panelBodyStyle}>
        <form onSubmit={handleSearch} style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by user, action, entity ID…"
            style={inputStyle}
          />
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            style={selectStyle}
          >
            <option value="">All entity types</option>
            {entityTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <button type="submit" style={btnSmStyle} disabled={isPending}>
            {isPending ? "Loading…" : "Search"}
          </button>
          <button
            type="button"
            style={btnMutedStyle}
            onClick={() => {
              setSearch("");
              setEntityFilter("");
              loadPage(1, "", "");
            }}
          >
            Clear
          </button>
        </form>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
            <thead>
              <tr>
                {["Time", "User", "Action", "Entity", "ID", "IP", "Before", "After"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      fontWeight: 600,
                      color: "var(--text-2)",
                      fontSize: 12.5,
                      borderBottom: "1px solid var(--border)",
                      whiteSpace: "nowrap",
                      background: "var(--surface-2)",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    style={{ textAlign: "center", color: "var(--text-3)", padding: "2rem 12px" }}
                  >
                    No audit entries found.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "9px 12px", verticalAlign: "middle" }}>
                      <span title={new Date(log.createdAt).toLocaleString()}>{timeAgo(log.createdAt)}</span>
                    </td>
                    <td style={{ padding: "9px 12px", verticalAlign: "middle" }}>
                      {log.user ? (
                        <div>
                          <div style={{ fontWeight: 500 }}>{log.user.name}</div>
                          <div style={{ fontSize: "0.75rem", color: "var(--text-2)" }}>{log.user.email}</div>
                        </div>
                      ) : (
                        <span style={{ color: "var(--text-2)", fontSize: "0.75rem" }}>System</span>
                      )}
                    </td>
                    <td style={{ padding: "9px 12px", verticalAlign: "middle" }}>
                      <span
                        style={{
                          fontSize: "0.7rem",
                          padding: "2px 8px",
                          borderRadius: 6,
                          fontWeight: 500,
                          display: "inline-block",
                          whiteSpace: "nowrap",
                          background: "var(--surface-2)",
                          color: "var(--text)",
                        }}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td style={{ padding: "9px 12px", verticalAlign: "middle" }}>{log.entityType}</td>
                    <td style={{ padding: "9px 12px", verticalAlign: "middle", fontFamily: "monospace", fontSize: "0.75rem", color: "var(--text-2)" }}>
                      {log.entityId}
                    </td>
                    <td style={{ padding: "9px 12px", verticalAlign: "middle", fontSize: "0.75rem", color: "var(--text-3)" }}>
                      {log.ip ?? "—"}
                    </td>
                    <td style={{ padding: "9px 12px", verticalAlign: "middle" }}><JsonPreview data={log.before} /></td>
                    <td style={{ padding: "9px 12px", verticalAlign: "middle" }}><JsonPreview data={log.after} /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
            <span style={{ fontSize: "0.875rem", color: "var(--text-2)" }}>
              Page {currentPage} of {totalPages}
            </span>
            <div style={{ display: "flex", gap: 4 }}>
              <button
                style={btnMutedStyle}
                disabled={currentPage <= 1 || isPending}
                onClick={() => loadPage(currentPage - 1, search, entityFilter)}
              >
                ← Prev
              </button>
              <button
                style={btnMutedStyle}
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
