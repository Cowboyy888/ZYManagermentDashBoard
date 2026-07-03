"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createMachine, updateMachineStatus } from "@/actions/production";

type Machine = {
  id: number; code: string; name: string; type: string;
  status: string; purchaseDate: string | null; notes: string | null;
  factoryArea: { id: number; name: string; code: string } | null;
  factoryAreaId: number | null; createdAt: string;
};

interface Props {
  machines: Machine[];
  factoryAreas: { id: number; name: string; code: string }[];
  canManage: boolean;
}

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  OPERATIONAL:      { color: "var(--green)", background: "var(--green-bg)" },
  UNDER_MAINTENANCE:{ color: "var(--amber)", background: "var(--amber-bg)" },
  RETIRED:          { color: "var(--text-3)", background: "var(--surface-2)" },
};

const STATUS_LABELS: Record<string, string> = {
  OPERATIONAL: "Operational", UNDER_MAINTENANCE: "Under Maintenance", RETIRED: "Retired",
};

const emptyForm = { code: "", name: "", type: "", factoryAreaId: "", status: "OPERATIONAL", purchaseDate: "", notes: "" };

export function MachinesManager({ machines, factoryAreas, canManage }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [statusChanging, setStatusChanging] = useState<number | null>(null);

  const operational = machines.filter((m) => m.status === "OPERATIONAL").length;
  const underMaint = machines.filter((m) => m.status === "UNDER_MAINTENANCE").length;
  const retired = machines.filter((m) => m.status === "RETIRED").length;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const res = await createMachine({
        code: form.code, name: form.name, type: form.type,
        factoryAreaId: form.factoryAreaId ? Number(form.factoryAreaId) : null,
        status: form.status,
        purchaseDate: form.purchaseDate || null,
        notes: form.notes || null,
      });
      if (res.ok) { setMsg({ ok: true, text: "Machine added." }); setForm(emptyForm); setShowForm(false); router.refresh(); }
      else { setMsg({ ok: false, text: "error" in res ? res.error : "Error" }); }
    });
  }

  async function handleStatus(id: number, status: "OPERATIONAL" | "UNDER_MAINTENANCE" | "RETIRED") {
    setStatusChanging(id);
    const res = await updateMachineStatus(id, status);
    setStatusChanging(null);
    if (res.ok) { router.refresh(); }
    else { setMsg({ ok: false, text: "error" in res ? res.error : "Error" }); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
        {[
          { label: "Operational", count: operational, color: "var(--green)" },
          { label: "Under Maintenance", count: underMaint, color: "var(--amber)" },
          { label: "Retired", count: retired, color: "var(--text-3)" },
        ].map(({ label, count, color }) => (
          <div key={label} className="kpi-card">
            <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500, marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color }}>{count}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 10 }}>
        {canManage && (
          <button className="btn btn-primary" onClick={() => { setShowForm((v) => !v); setMsg(null); }}>
            {showForm ? "Cancel" : "+ Add Machine"}
          </button>
        )}
      </div>

      {msg && (
        <div style={{ padding: "10px 14px", borderRadius: 8, fontSize: 13, background: msg.ok ? "var(--green-bg)" : "var(--red-bg)", color: msg.ok ? "var(--green)" : "var(--red)" }}>
          {msg.text}
        </div>
      )}

      {/* Add form */}
      {showForm && canManage && (
        <div className="panel">
          <div className="panel-head"><span className="panel-title">New Machine</span></div>
          <form onSubmit={handleCreate} className="panel-body">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              {[
                { label: "Machine Code", key: "code", placeholder: "WD-01" },
                { label: "Name", key: "name", placeholder: "Wire Drawing Machine #1" },
                { label: "Type", key: "type", placeholder: "Wire Drawing / Mesh Welding / Other" },
              ].map(({ label, key, placeholder }) => (
                <div key={key} style={{ gridColumn: key === "type" ? "1/-1" : undefined }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>{label}</label>
                  <input
                    className="form-input"
                    required
                    placeholder={placeholder}
                    value={(form as Record<string, string>)[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  />
                </div>
              ))}
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Factory Area</label>
                <select className="form-select" value={form.factoryAreaId} onChange={(e) => setForm((f) => ({ ...f, factoryAreaId: e.target.value }))}>
                  <option value="">— none —</option>
                  {factoryAreas.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Purchase Date</label>
                <input type="date" className="form-input" value={form.purchaseDate} onChange={(e) => setForm((f) => ({ ...f, purchaseDate: e.target.value }))} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Notes</label>
                <textarea className="form-input" style={{ height: 60, paddingTop: 8, resize: "vertical" }} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                {isPending ? <><span className="spinner" /> Saving…</> : "Add Machine"}
              </button>
              <button type="button" className="btn" onClick={() => { setShowForm(false); setForm(emptyForm); }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">All Machines</span>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>{machines.length} total</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          {machines.length === 0 ? (
            <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>No machines registered yet</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th><th>Name</th><th>Type</th><th>Area</th><th>Status</th><th>Purchase Date</th>
                  {canManage && <th>Change Status</th>}
                </tr>
              </thead>
              <tbody>
                {machines.map((m) => (
                  <tr key={m.id}>
                    <td><code style={{ fontSize: 12, fontWeight: 700, color: "var(--steel)" }}>{m.code}</code></td>
                    <td style={{ fontWeight: 500 }}>{m.name}</td>
                    <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{m.type}</td>
                    <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{m.factoryArea ? `${m.factoryArea.code}` : "—"}</td>
                    <td>
                      <span className="tag" style={{ ...STATUS_STYLE[m.status] }}>
                        {STATUS_LABELS[m.status] ?? m.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>
                      {m.purchaseDate ? new Date(m.purchaseDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </td>
                    {canManage && (
                      <td>
                        <select
                          className="form-select"
                          style={{ width: "auto", height: 28, fontSize: 12, padding: "0 6px" }}
                          value={m.status}
                          disabled={statusChanging === m.id}
                          onChange={(e) => handleStatus(m.id, e.target.value as "OPERATIONAL" | "UNDER_MAINTENANCE" | "RETIRED")}
                        >
                          <option value="OPERATIONAL">Operational</option>
                          <option value="UNDER_MAINTENANCE">Under Maintenance</option>
                          <option value="RETIRED">Retired</option>
                        </select>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
