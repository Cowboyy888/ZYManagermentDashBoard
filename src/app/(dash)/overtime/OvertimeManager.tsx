"use client";
import { useState, useTransition } from "react";
import { createOvertime } from "@/actions/attendance";

type OTBand = "NORMAL_1_5" | "NIGHT_2_0" | "HOLIDAY_2_0";
const BAND_LABEL: Record<OTBand, string> = {
  NORMAL_1_5: "Normal (1.5×) — $1.25/h",
  NIGHT_2_0: "Night (2.0×) — $2.00/h",
  HOLIDAY_2_0: "Holiday (2.0×) — $2.00/h",
};

export interface OTEntry {
  id: string;
  employeeId: number;
  employeeName: string;
  date: string;
  hours: number;
  band: OTBand;
  description: string | null;
  amountUsd: number;
  status: string;
}

interface Props {
  employees: { id: number; nameEn: string }[];
  initial: OTEntry[];
  canCreate: boolean;
}

export function OvertimeManager({ employees, initial, canCreate }: Props) {
  const [entries, setEntries] = useState<OTEntry[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    employeeId: "",
    date: new Date().toISOString().slice(0, 10),
    hours: "",
    band: "NORMAL_1_5" as OTBand,
    description: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createOvertime({
        employeeId: Number(form.employeeId),
        date: form.date,
        hours: Number(form.hours),
        band: form.band,
        description: form.description || null,
      });
      if ('error' in res) { setError(res.error); return; }
      const emp = employees.find((e) => e.id === Number(form.employeeId));
      setEntries((prev) => [{
        id: res.data.id,
        employeeId: Number(form.employeeId),
        employeeName: emp?.nameEn ?? "—",
        date: form.date,
        hours: Number(form.hours),
        band: form.band,
        description: form.description || null,
        amountUsd: res.data.amountUsd,
        status: "APPROVED",
      }, ...prev]);
      setForm({ employeeId: "", date: new Date().toISOString().slice(0, 10), hours: "", band: "NORMAL_1_5", description: "" });
      setShowForm(false);
    });
  }

  const fmtUsd = (n: number) => `$${n.toFixed(2)}`;
  const totalUsd = entries.reduce((a, e) => a + e.amountUsd, 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPI summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        <div className="kpi-card">
          <p style={{ fontSize: 12, color: "var(--text-3)" }}>Total entries</p>
          <p style={{ fontSize: 26, fontWeight: 800, color: "var(--text)", marginTop: 4 }}>{entries.length}</p>
        </div>
        <div className="kpi-card">
          <p style={{ fontSize: 12, color: "var(--text-3)" }}>Total OT pay</p>
          <p style={{ fontSize: 26, fontWeight: 800, color: "var(--text)", marginTop: 4 }}>{fmtUsd(totalUsd)}</p>
        </div>
        <div className="kpi-card">
          <p style={{ fontSize: 12, color: "var(--text-3)" }}>Employees with OT</p>
          <p style={{ fontSize: 26, fontWeight: 800, color: "var(--text)", marginTop: 4 }}>
            {new Set(entries.map((e) => e.employeeId)).size}
          </p>
        </div>
      </div>

      {/* Add form */}
      {canCreate && (
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
          {!showForm ? (
            <button onClick={() => setShowForm(true)} className="btn btn-primary">
              + Log overtime
            </button>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: "var(--text)", margin: 0 }}>New overtime entry</h2>
              {error && (
                <p style={{ background: "var(--red-bg)", color: "var(--red)", borderRadius: 6, padding: "8px 12px", fontSize: 13, margin: 0 }}>
                  {error}
                </p>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-2)" }}>Employee *</span>
                  <select value={form.employeeId} onChange={set("employeeId")} required className="form-select">
                    <option value="">— Select —</option>
                    {employees.map((e) => <option key={e.id} value={e.id}>{e.nameEn}</option>)}
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-2)" }}>Date *</span>
                  <input type="date" value={form.date} onChange={set("date")} className="form-input" />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-2)" }}>Hours *</span>
                  <input type="number" step="0.5" min="0.5" max="12" value={form.hours} onChange={set("hours")}
                    placeholder="e.g. 1.5" className="form-input" />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-2)" }}>Band *</span>
                  <select value={form.band} onChange={set("band")} className="form-select">
                    {(Object.keys(BAND_LABEL) as OTBand[]).map((b) => (
                      <option key={b} value={b}>{BAND_LABEL[b]}</option>
                    ))}
                  </select>
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4, gridColumn: "span 2" }}>
                  <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-2)" }}>Description</span>
                  <input type="text" value={form.description} onChange={set("description")}
                    placeholder="e.g. 安排出货" className="form-input" />
                </label>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button onClick={() => { setShowForm(false); setError(null); }} className="btn">
                  Cancel
                </button>
                <button onClick={submit} disabled={isPending || !form.employeeId || !form.hours}
                  className="btn btn-primary">
                  {isPending ? <><span className="spinner" />Saving…</> : "Save OT"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="panel">
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Date</th>
                <th>Band</th>
                <th style={{ textAlign: "right" }}>Hours</th>
                <th style={{ textAlign: "right" }}>Amount</th>
                <th>Description</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-3)" }}>
                    No overtime logged yet.
                  </td>
                </tr>
              ) : entries.map((e) => (
                <tr key={e.id}>
                  <td style={{ fontWeight: 500 }}>{e.employeeName}</td>
                  <td style={{ color: "var(--text-2)" }}>{new Date(e.date).toLocaleDateString()}</td>
                  <td style={{ color: "var(--text-2)", fontSize: 12 }}>{e.band.replace(/_/g, " ")}</td>
                  <td className="num">{e.hours}h</td>
                  <td className="num" style={{ fontWeight: 600 }}>{fmtUsd(e.amountUsd)}</td>
                  <td style={{ color: "var(--text-2)", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {e.description ?? "—"}
                  </td>
                  <td><span className="tag tag-green">{e.status}</span></td>
                </tr>
              ))}
            </tbody>
            {entries.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={4}>Total</td>
                  <td className="num">{fmtUsd(totalUsd)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
