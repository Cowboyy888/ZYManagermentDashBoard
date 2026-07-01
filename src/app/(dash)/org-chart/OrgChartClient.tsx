"use client";
import { useState } from "react";
import Link from "next/link";

interface OrgNode {
  id: number;
  nameEn: string;
  nameKh: string;
  employeeCode: string | null;
  photoUrl: string | null;
  position: { name: string } | null;
  department: { name: string } | null;
  factoryArea: { code: string } | null;
  children: OrgNode[];
}

interface Props {
  roots: OrgNode[];
  totalCount: number;
}

function Avatar({ photoUrl, name }: { photoUrl: string | null; name: string }) {
  const initials = name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
  if (photoUrl) {
    return <img src={photoUrl} alt={name} style={{ width: 40, height: 40, borderRadius: 10, objectFit: "cover" }} />;
  }
  return (
    <div style={{
      width: 40, height: 40, borderRadius: 10,
      background: "var(--steel-light)", color: "var(--steel)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 13, fontWeight: 700,
    }}>
      {initials}
    </div>
  );
}

function OrgCard({ node, depth }: { node: OrgNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      {/* Card */}
      <div style={{
        background: "var(--surface)",
        border: depth === 0 ? "2px solid var(--steel)" : "1px solid var(--border)",
        borderRadius: 12,
        padding: "12px 16px",
        minWidth: 180,
        maxWidth: 220,
        cursor: hasChildren ? "pointer" : "default",
        boxShadow: depth === 0 ? "0 2px 12px rgba(45,74,99,0.1)" : "none",
        position: "relative",
      }}
        onClick={hasChildren ? () => setExpanded(v => !v) : undefined}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Avatar photoUrl={node.photoUrl} name={node.nameEn} />
          <div style={{ minWidth: 0 }}>
            <Link href={`/employees/${node.id}`}
              onClick={e => e.stopPropagation()}
              style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", textDecoration: "none", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {node.nameEn}
            </Link>
            <div style={{ fontSize: 11, color: "var(--text-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {node.nameKh}
            </div>
          </div>
        </div>
        {node.position && (
          <div style={{
            marginTop: 8, padding: "2px 8px", borderRadius: 4,
            background: "var(--purple-bg)", color: "var(--purple)",
            fontSize: 11, fontWeight: 600, display: "inline-block",
          }}>
            {node.position.name}
          </div>
        )}
        {(node.department || node.factoryArea) && (
          <div style={{ marginTop: 4, fontSize: 11, color: "var(--text-3)", display: "flex", gap: 6 }}>
            {node.department && <span>{node.department.name}</span>}
            {node.factoryArea && <span style={{ background: "var(--blue-bg)", color: "var(--blue)", padding: "0 4px", borderRadius: 3 }}>{node.factoryArea.code}</span>}
          </div>
        )}
        {hasChildren && (
          <div style={{
            position: "absolute", bottom: -10, left: "50%", transform: "translateX(-50%)",
            width: 20, height: 20, borderRadius: "50%",
            background: "var(--steel)", color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 12, fontWeight: 700, zIndex: 1, border: "2px solid var(--surface)",
          }}>
            {expanded ? "−" : "+"}
          </div>
        )}
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div style={{ marginTop: 24, display: "flex", gap: 20, flexWrap: "wrap", justifyContent: "center", position: "relative" }}>
          {/* Vertical line down */}
          <div style={{
            position: "absolute", top: -24, left: "50%",
            width: 2, height: 24, background: "var(--border)",
            transform: "translateX(-50%)",
          }} />
          {/* Horizontal connector */}
          {node.children.length > 1 && (
            <div style={{
              position: "absolute", top: 0, left: "calc(50% - " + Math.floor(node.children.length * 100) + "px)",
              width: Math.floor(node.children.length * 200) + "px", height: 2,
              background: "var(--border)",
            }} />
          )}
          {node.children.map(child => (
            <div key={child.id} style={{ position: "relative", paddingTop: 20 }}>
              {/* Vertical from connector to card */}
              <div style={{
                position: "absolute", top: 0, left: "50%",
                width: 2, height: 20, background: "var(--border)",
                transform: "translateX(-50%)",
              }} />
              <OrgCard node={child} depth={depth + 1} />
            </div>
          ))}
        </div>
      )}
      {hasChildren && !expanded && (
        <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-3)" }}>
          {node.children.length} report{node.children.length > 1 ? "s" : ""}
        </div>
      )}
    </div>
  );
}

export function OrgChartClient({ roots, totalCount }: Props) {
  return (
    <div>
      <p style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 24 }}>
        {totalCount} active employees · Click cards to expand/collapse
      </p>
      <div style={{ overflowX: "auto", paddingBottom: 32 }}>
        <div style={{ display: "flex", gap: 40, flexWrap: "wrap", justifyContent: "flex-start", minWidth: "max-content", padding: "0 16px" }}>
          {roots.map(root => (
            <OrgCard key={root.id} node={root} depth={0} />
          ))}
        </div>
      </div>
    </div>
  );
}
