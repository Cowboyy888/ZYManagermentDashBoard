"use client";
import { useState, useRef, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { searchEmployees } from "@/actions/employees";
import { Avatar } from "@/components/Avatar";

interface Result {
  id: number;
  nameEn: string;
  nameKh: string;
  employeeCode: string | null;
  photoUrl: string | null;
  department: { name: string } | null;
  position: { name: string } | null;
}

export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    setActiveIdx(0);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (q.length < 2) { setResults([]); return; }
    timeoutRef.current = setTimeout(() => {
      startTransition(async () => {
        const res = await searchEmployees(q);
        if (res.ok) setResults(res.data);
      });
    }, 200);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && results[activeIdx]) {
      router.push(`/employees/${results[activeIdx].id}`);
      setOpen(false);
      setQuery("");
      setResults([]);
    }
  }

  function handleSelect(id: number) {
    router.push(`/employees/${id}`);
    setOpen(false);
    setQuery("");
    setResults([]);
  }

  return (
    <div style={{ position: "relative" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "6px 12px", borderRadius: 8,
        border: "1px solid var(--border)", background: "var(--surface)",
        width: 260,
      }}>
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth={2}>
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          ref={inputRef}
          role="combobox"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search employees… ⌘K"
          style={{
            flex: 1, border: "none", outline: "none",
            fontSize: 13, color: "var(--text)", background: "transparent",
          }}
          aria-label="Search employees"
          aria-autocomplete="list"
          aria-expanded={open && results.length > 0}
          aria-controls="employee-search-listbox"
        />
        {isPending && (
          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth={2}
            style={{ animation: "spin 0.8s linear infinite", flexShrink: 0 }}>
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
          </svg>
        )}
      </div>

      {open && query.length >= 2 && (
        <div style={{
          position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0,
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          zIndex: 9999, overflow: "hidden",
        }}>
          {results.length === 0 && !isPending ? (
            <div style={{ padding: "14px 16px", fontSize: 13, color: "var(--text-3)", textAlign: "center" }}>
              No employees found
            </div>
          ) : (
            <div id="employee-search-listbox" role="listbox">
              {results.map((r, i) => (
                <div
                  key={r.id}
                  onMouseDown={() => handleSelect(r.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 14px", cursor: "pointer",
                    background: i === activeIdx ? "var(--surface-2)" : "transparent",
                    borderBottom: i < results.length - 1 ? "1px solid var(--border)" : "none",
                  }}
                  onMouseEnter={() => setActiveIdx(i)}
                >
                  <Avatar photoUrl={r.photoUrl} name={r.nameEn} size={30} radius={6} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.nameEn}
                      {r.employeeCode && (
                        <span style={{ marginLeft: 8, fontSize: 11, color: "var(--text-3)", fontWeight: 400 }}>
                          {r.employeeCode}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                      {[r.department?.name, r.position?.name].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth={2}>
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
