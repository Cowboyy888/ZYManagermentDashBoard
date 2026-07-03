"use client";
import { useState, useTransition, useMemo } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { upsertDailyReport } from "@/actions/production";

const ExportMenu = dynamic(() => import("@/components/ExportMenu").then((m) => m.ExportMenu), { ssr: false });

type Report = {
  id: string; reportDate: string; shift: string;
  meshProducedKg: number; wireConsumedKg: number;
  headcount: number; downtimeMinutes: number; notes: string | null;
  factoryArea: { id: number; name: string; code: string } | null;
  supervisor: { id: number; nameEn: string } | null;
  createdAt: string;
};

interface Props {
  reports: Report[];
  factoryAreas: { id: number; name: string; code: string }[];
  supervisors: { id: number; nameEn: string }[];
  canWrite: boolean;
  actorDeptId: number | null;
}

const SHIFTS = ["MORNING", "AFTERNOON", "NIGHT"];

const emptyForm = {
  reportDate: new Date().toISOString().slice(0, 10),
  shift: "MORNING", factoryAreaId: "", supervisorId: "",
  meshProducedKg: "", wireConsumedKg: "", headcount: "", downtimeMinutes: "0", notes: "",
};

export function ReportsManager({ reports, factoryAreas, supervisors, canWrite }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const totalMeshKg = useMemo(() => reports.reduce((s, r) => s + r.meshProducedKg, 0), [reports]);
  const totalWireKg = useMemo(() => reports.reduce((s, r) => s + r.wireConsumedKg, 0), [reports]);
  const totalDowntime = useMemo(() => reports.reduce((s, r) => s + r.downtimeMinutes, 0), [reports]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const res = await upsertDailyReport({
        reportDate: form.reportDate,
        shift: form.shift,
        factoryAreaId: form.factoryAreaId ? Number(form.factoryAreaId) : null,
        supervisorId: form.supervisorId ? Number(form.supervisorId) : null,
        meshProducedKg: Number(form.meshProducedKg),
        wireConsumedKg: Number(form.wireConsumedKg),
        headcount: Number(form.headcount),
        downtimeMinutes: Number(form.downtimeMinutes),
        notes: form.notes || null,
      });
      if (res.ok) {
        setMsg({ ok: true, text: "Report saved." });
        setShowForm(false);
        router.refresh();
      } else {
        setMsg({ ok: false, text: "error" in res ? res.error : "Error saving report" });
      }
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        {[
          { label: "Reports (30d)", value: reports.length.toString(), color: "var(--steel)" },
          { label: "Mesh Produced (kg)", value: totalMeshKg.toLocaleString(undefined, { maximumFractionDigits: 0 }), color: "var(--text)" },
          { label: "Wire Consumed (kg)", value: totalWireKg.toLocaleString(undefined, { maximumFractionDigits: 0 }), color: "var(--text)" },
          { label: "Downtime (min)", value: totalDowntime.toLocaleString(), color: totalDowntime > 0 ? "var(--amber)" : "var(--green)" },
        ].map(({ label, value, color }) => (
          <div key={label} className="kpi-card">
            <div style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 500, marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        {canWrite && (
          <button className="btn btn-primary" onClick={() => { setShowForm((v) => !v); setMsg(null); }}>
            {showForm ? "Cancel" : "+ Log Shift"}
          </button>
        )}
        <ExportMenu
          title="Daily Production Reports"
          filename="production-reports"
          data={reports.map((r) => ({
            Date: new Date(r.reportDate).toLocaleDateString("en-GB"),
            Shift: r.shift,
            Area: r.factoryArea?.name ?? "",
            "Mesh Produced (kg)": r.meshProducedKg,
            "Wire Consumed (kg)": r.wireConsumedKg,
            Headcount: r.headcount,
            "Downtime (min)": r.downtimeMinutes,
            Supervisor: r.supervisor?.nameEn ?? "",
            Notes: r.notes ?? "",
          }))}
          columns={[
            { key: "Date", header: "Date" },
            { key: "Shift", header: "Shift" },
            { key: "Area", header: "Area" },
            { key: "Mesh Produced (kg)", header: "Mesh (kg)" },
            { key: "Wire Consumed (kg)", header: "Wire (kg)" },
            { key: "Headcount", header: "Headcount" },
            { key: "Downtime (min)", header: "Downtime (min)" },
            { key: "Supervisor", header: "Supervisor" },
            { key: "Notes", header: "Notes" },
          ]}
        />
      </div>

      {msg && (
        <div style={{ padding: "10px 14px", borderRadius: 8, fontSize: 13, background: msg.ok ? "var(--green-bg)" : "var(--red-bg)", color: msg.ok ? "var(--green)" : "var(--red)" }}>
          {msg.text}
        </div>
      )}

      {/* Entry form */}
      {showForm && canWrite && (
        <div className="panel">
          <div className="panel-head"><span className="panel-title">Log Shift Report</span></div>
          <form onSubmit={handleSubmit} className="panel-body">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Date</label>
                <input type="date" className="form-input" required value={form.reportDate} onChange={(e) => setForm((f) => ({ ...f, reportDate: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Shift</label>
                <select className="form-select" required value={form.shift} onChange={(e) => setForm((f) => ({ ...f, shift: e.target.value }))}>
                  {SHIFTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Factory Area</label>
                <select className="form-select" value={form.factoryAreaId} onChange={(e) => setForm((f) => ({ ...f, factoryAreaId: e.target.value }))}>
                  <option value="">— all areas —</option>
                  {factoryAreas.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Mesh Produced (kg)</label>
                <input type="number" className="form-input" required min={0} step={0.1} placeholder="0.0" value={form.meshProducedKg} onChange={(e) => setForm((f) => ({ ...f, meshProducedKg: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Wire Consumed (kg)</label>
                <input type="number" className="form-input" required min={0} step={0.1} placeholder="0.0" value={form.wireConsumedKg} onChange={(e) => setForm((f) => ({ ...f, wireConsumedKg: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Headcount</label>
                <input type="number" className="form-input" required min={0} placeholder="0" value={form.headcount} onChange={(e) => setForm((f) => ({ ...f, headcount: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Downtime (min)</label>
                <input type="number" className="form-input" min={0} placeholder="0" value={form.downtimeMinutes} onChange={(e) => setForm((f) => ({ ...f, downtimeMinutes: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Supervisor</label>
                <select className="form-select" value={form.supervisorId} onChange={(e) => setForm((f) => ({ ...f, supervisorId: e.target.value }))}>
                  <option value="">— none —</option>
                  {supervisors.map((s) => <option key={s.id} value={s.id}>{s.nameEn}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Notes</label>
                <input className="form-input" value={form.notes} placeholder="Optional notes…" onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
              <button type="submit" className="btn btn-primary" disabled={isPending}>{isPending ? <><span className="spinner" />Saving…</> : "Save Report"}</button>
              <button type="button" className="btn" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* History */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">Last 30 Days</span>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>{reports.length} entries</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          {reports.length === 0 ? (
            <div style={{ padding: "48px 20px", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>No reports yet</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>Date</th><th>Shift</th><th>Area</th><th>Mesh (kg)</th><th>Wire (kg)</th><th>Headcount</th><th>Downtime</th><th>Supervisor</th></tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: "nowrap", fontWeight: 500 }}>{new Date(r.reportDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</td>
                    <td><span className="tag" style={{ fontSize: 11 }}>{r.shift}</span></td>
                    <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{r.factoryArea?.code ?? "—"}</td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>{r.meshProducedKg.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>{r.wireConsumedKg.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                    <td>{r.headcount}</td>
                    <td style={{ color: r.downtimeMinutes > 0 ? "var(--amber)" : "var(--text-3)" }}>{r.downtimeMinutes > 0 ? `${r.downtimeMinutes} min` : "—"}</td>
                    <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{r.supervisor?.nameEn ?? "—"}</td>
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
