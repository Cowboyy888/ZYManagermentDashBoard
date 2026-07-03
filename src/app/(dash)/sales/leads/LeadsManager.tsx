"use client";
import { useState, useMemo } from "react";
import { createLead, updateLead, updateLeadStage } from "@/actions/sales";

interface Lead {
  id: number; contactName: string; companyName: string | null;
  phone: string | null; email: string | null;
  source: string; stage: string;
  productInterest: string | null; estimatedValueUsd: number | null;
  assignedToId: string | null; assignedToName: string | null;
  customerId: number | null; customerName: string | null;
  notes: string | null; lostReason: string | null; createdAt: string;
}
interface Customer { id: number; name: string; customerCode: string; }
interface User { id: string; name: string; }

const STAGES = ["NEW", "CONTACTED", "QUALIFIED", "QUOTATION", "WON", "LOST"] as const;
const SOURCES = ["WEBSITE", "FACEBOOK", "WHATSAPP", "EMAIL", "TRADE_SHOW", "REFERRAL", "OTHER"] as const;

const STAGE_COLOR: Record<string, string> = {
  NEW: "#64748b", CONTACTED: "#2563eb", QUALIFIED: "#7c3aed",
  QUOTATION: "#d97706", WON: "#16a34a", LOST: "#dc2626",
};

const BLANK = {
  contactName: "", companyName: "", phone: "", email: "",
  source: "WEBSITE" as string, productInterest: "", estimatedValueUsd: "",
  assignedToId: "", customerId: "", notes: "",
};

function Tag({ s }: { s: string }) {
  const c = STAGE_COLOR[s] ?? "#64748b";
  return <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 100, fontSize: 11, fontWeight: 600, background: `${c}22`, color: c }}>{s.replace(/_/g, " ")}</span>;
}

export function LeadsManager({ leads: initial, customers, users, canWrite }: {
  leads: Lead[]; customers: Customer[]; users: User[]; canWrite: boolean;
}) {
  const [leads, setLeads] = useState(initial);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [draft, setDraftState] = useState({ ...BLANK });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lostReason, setLostReason] = useState("");
  const [lostModal, setLostModal] = useState<Lead | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return leads.filter((l) => {
      if (stageFilter && l.stage !== stageFilter) return false;
      if (!q) return true;
      return l.contactName.toLowerCase().includes(q) || (l.companyName ?? "").toLowerCase().includes(q);
    });
  }, [leads, search, stageFilter]);

  const byStage = useMemo(() => {
    const map: Record<string, Lead[]> = {};
    for (const s of STAGES) map[s] = [];
    for (const l of leads) { if (map[l.stage]) map[l.stage].push(l); }
    return map;
  }, [leads]);

  function setD(k: string, v: string) { setDraftState((d) => ({ ...d, [k]: v })); }

  function openCreate() {
    setDraftState({ ...BLANK }); setError(""); setShowCreate(true); setEditLead(null);
  }
  function openEdit(l: Lead) {
    setDraftState({
      contactName: l.contactName, companyName: l.companyName ?? "",
      phone: l.phone ?? "", email: l.email ?? "", source: l.source,
      productInterest: l.productInterest ?? "",
      estimatedValueUsd: l.estimatedValueUsd !== null ? String(l.estimatedValueUsd) : "",
      assignedToId: l.assignedToId ?? "", customerId: l.customerId !== null ? String(l.customerId) : "",
      notes: l.notes ?? "",
    });
    setError(""); setEditLead(l); setShowCreate(true);
  }

  async function save() {
    setSaving(true); setError("");
    const payload = {
      contactName: draft.contactName,
      companyName: draft.companyName || null,
      phone: draft.phone || null,
      email: draft.email || null,
      source: draft.source,
      productInterest: draft.productInterest || null,
      estimatedValueUsd: draft.estimatedValueUsd ? Number(draft.estimatedValueUsd) : null,
      assignedToId: draft.assignedToId || null,
      customerId: draft.customerId ? Number(draft.customerId) : null,
      notes: draft.notes || null,
    };
    const res = editLead
      ? await updateLead({ ...payload, id: editLead.id })
      : await createLead(payload);
    setSaving(false);
    if ("error" in res) { setError(res.error); return; }
    const d = res.data;
    const assignedUser = users.find((u) => u.id === d.assignedToId);
    const cust = customers.find((c) => c.id === d.customerId);
    const enriched: Lead = {
      id: d.id,
      contactName: d.contactName,
      companyName: d.companyName,
      phone: d.phone,
      email: d.email,
      source: d.source as string,
      stage: d.stage as string,
      productInterest: d.productInterest,
      estimatedValueUsd: d.estimatedValueUsd !== null && d.estimatedValueUsd !== undefined ? Number(d.estimatedValueUsd) : null,
      assignedToId: d.assignedToId,
      assignedToName: assignedUser?.name ?? null,
      customerId: d.customerId,
      customerName: cust?.name ?? null,
      notes: d.notes,
      lostReason: editLead?.lostReason ?? null,
      createdAt: d.createdAt.toISOString(),
    };
    if (editLead) {
      setLeads((prev) => prev.map((l) => l.id === enriched.id ? enriched : l));
    } else {
      setLeads((prev) => [enriched, ...prev]);
    }
    setShowCreate(false); setEditLead(null);
  }

  async function moveStage(lead: Lead, stage: string) {
    if (stage === "LOST") { setLostModal(lead); setLostReason(""); return; }
    const res = await updateLeadStage({ id: lead.id, stage });
    if ("error" in res) return;
    setLeads((prev) => prev.map((l) => l.id === lead.id ? { ...l, stage } : l));
  }

  async function confirmLost() {
    if (!lostModal) return;
    const res = await updateLeadStage({ id: lostModal.id, stage: "LOST", lostReason: lostReason || undefined });
    if ("error" in res) return;
    setLeads((prev) => prev.map((l) => l.id === lostModal.id ? { ...l, stage: "LOST", lostReason } : l));
    setLostModal(null);
  }

  const fmtUsd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 0 })}`;
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input className="input" placeholder="Search contact, company..." style={{ flex: 1, minWidth: 200 }}
          value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="input" style={{ width: 160 }} value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
          <option value="">All Stages</option>
          {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        {canWrite && <button className="btn btn-primary btn-sm" onClick={openCreate}>+ New Lead</button>}
      </div>

      {/* Create/Edit form */}
      {showCreate && (
        <div className="panel">
          <div className="panel-head">
            <h2>{editLead ? "Edit Lead" : "New Lead"}</h2>
            <button className="btn btn-sm" onClick={() => { setShowCreate(false); setEditLead(null); }}>Cancel</button>
          </div>
          <div className="panel-body">
            {error && <div style={{ padding: "8px 12px", background: "var(--red-bg)", color: "var(--red)", borderRadius: 8, marginBottom: 12, fontSize: 13 }}>{error}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 4 }}>Contact Name *</label>
                <input className="input" value={draft.contactName} onChange={(e) => setD("contactName", e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 4 }}>Company Name</label>
                <input className="input" value={draft.companyName} onChange={(e) => setD("companyName", e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 4 }}>Source *</label>
                <select className="input" value={draft.source} onChange={(e) => setD("source", e.target.value)}>
                  {SOURCES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 4 }}>Phone</label>
                <input className="input" value={draft.phone} onChange={(e) => setD("phone", e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 4 }}>Email</label>
                <input className="input" type="email" value={draft.email} onChange={(e) => setD("email", e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 4 }}>Est. Value (USD)</label>
                <input className="input" type="number" min="0" value={draft.estimatedValueUsd} onChange={(e) => setD("estimatedValueUsd", e.target.value)} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 4 }}>Customer (if known)</label>
                <select className="input" value={draft.customerId} onChange={(e) => setD("customerId", e.target.value)}>
                  <option value="">— none —</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 4 }}>Assigned To</label>
                <select className="input" value={draft.assignedToId} onChange={(e) => setD("assignedToId", e.target.value)}>
                  <option value="">— unassigned —</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 4 }}>Product Interest</label>
                <input className="input" value={draft.productInterest} onChange={(e) => setD("productInterest", e.target.value)} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 4 }}>Notes</label>
                <textarea className="input" rows={2} value={draft.notes} onChange={(e) => setD("notes", e.target.value)} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <button className="btn btn-sm" onClick={() => { setShowCreate(false); setEditLead(null); }}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Kanban board */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 10, alignItems: "start" }}>
        {STAGES.map((stage) => {
          const stageLds = stageFilter && stageFilter !== stage ? [] : byStage[stage].filter((l) => {
            if (!search) return true;
            const q = search.toLowerCase();
            return l.contactName.toLowerCase().includes(q) || (l.companyName ?? "").toLowerCase().includes(q);
          });
          const color = STAGE_COLOR[stage];
          return (
            <div key={stage} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)", background: `${color}11` }}>
                <span style={{ fontSize: 11, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.06em" }}>{stage.replace(/_/g, " ")}</span>
                <span style={{ marginLeft: 6, fontSize: 11, color: "var(--text-3)" }}>({stageLds.length})</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 8 }}>
                {stageLds.length === 0 && <p style={{ color: "var(--text-3)", fontSize: 12, padding: "4px 0" }}>—</p>}
                {stageLds.map((l) => (
                  <div key={l.id} style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{l.contactName}</div>
                    {l.companyName && <div style={{ fontSize: 11, color: "var(--text-3)" }}>{l.companyName}</div>}
                    {l.estimatedValueUsd !== null && <div style={{ fontSize: 12, color: "var(--green)", fontWeight: 600, marginTop: 4 }}>{fmtUsd(l.estimatedValueUsd)}</div>}
                    <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 4 }}>{l.source.replace(/_/g, " ")} · {fmtDate(l.createdAt)}</div>
                    {l.assignedToName && <div style={{ fontSize: 11, color: "var(--text-3)" }}>→ {l.assignedToName}</div>}
                    {canWrite && (
                      <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
                        <button className="btn btn-sm" style={{ fontSize: 11, padding: "2px 8px" }} onClick={() => openEdit(l)}>Edit</button>
                        {STAGES.indexOf(stage) < STAGES.length - 1 && stage !== "WON" && (
                          <button className="btn btn-sm" style={{ fontSize: 11, padding: "2px 8px", color: "var(--green)" }}
                            onClick={() => moveStage(l, STAGES[STAGES.indexOf(stage) + 1])}>
                            → {STAGES[STAGES.indexOf(stage) + 1]}
                          </button>
                        )}
                        {stage !== "LOST" && stage !== "WON" && (
                          <button className="btn btn-sm" style={{ fontSize: 11, padding: "2px 8px", color: "var(--red)" }}
                            onClick={() => moveStage(l, "LOST")}>Lost</button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Lost reason modal */}
      {lostModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--surface)", borderRadius: 12, padding: 24, width: 400 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: "0 0 12px" }}>Mark as Lost</h2>
            <label style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", display: "block", marginBottom: 4 }}>Lost Reason (optional)</label>
            <textarea className="input" rows={3} value={lostReason} onChange={(e) => setLostReason(e.target.value)} placeholder="Why was this lead lost?" />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
              <button className="btn btn-sm" onClick={() => setLostModal(null)}>Cancel</button>
              <button className="btn btn-sm" style={{ background: "var(--red)", color: "#fff" }} onClick={confirmLost}>Confirm Lost</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
