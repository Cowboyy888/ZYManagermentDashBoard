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
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Total entries</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{entries.length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Total OT pay</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{fmtUsd(totalUsd)}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs text-gray-500">Employees with OT</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{new Set(entries.map((e) => e.employeeId)).size}</p>
        </div>
      </div>

      {/* Add form */}
      {canCreate && (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          {!showForm ? (
            <button onClick={() => setShowForm(true)}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors">
              + Log overtime
            </button>
          ) : (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold text-gray-900">New overtime entry</h2>
              {error && <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <label className="space-y-1">
                  <span className="block text-xs font-medium text-gray-600">Employee *</span>
                  <select value={form.employeeId} onChange={set("employeeId")} required
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                    <option value="">— Select —</option>
                    {employees.map((e) => <option key={e.id} value={e.id}>{e.nameEn}</option>)}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="block text-xs font-medium text-gray-600">Date *</span>
                  <input type="date" value={form.date} onChange={set("date")}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                </label>
                <label className="space-y-1">
                  <span className="block text-xs font-medium text-gray-600">Hours *</span>
                  <input type="number" step="0.5" min="0.5" max="12" value={form.hours} onChange={set("hours")} placeholder="e.g. 1.5"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                </label>
                <label className="space-y-1">
                  <span className="block text-xs font-medium text-gray-600">Band *</span>
                  <select value={form.band} onChange={set("band")}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                    {(Object.keys(BAND_LABEL) as OTBand[]).map((b) => (
                      <option key={b} value={b}>{BAND_LABEL[b]}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 sm:col-span-2">
                  <span className="block text-xs font-medium text-gray-600">Description</span>
                  <input type="text" value={form.description} onChange={set("description")} placeholder="e.g. 安排出货"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                </label>
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => { setShowForm(false); setError(null); }}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={submit} disabled={isPending || !form.employeeId || !form.hours}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 hover:bg-blue-700">
                  {isPending ? "Saving…" : "Save OT"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Employee</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Band</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Hours</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Description</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {entries.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">No overtime logged yet.</td></tr>
              ) : entries.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5 font-medium text-gray-800">{e.employeeName}</td>
                  <td className="px-4 py-2.5 text-gray-500">{new Date(e.date).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">{e.band.replace(/_/g, " ")}</td>
                  <td className="px-4 py-2.5 text-right text-gray-800">{e.hours}h</td>
                  <td className="px-4 py-2.5 text-right font-medium text-gray-900">{fmtUsd(e.amountUsd)}</td>
                  <td className="px-4 py-2.5 text-gray-500 max-w-xs truncate">{e.description ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">{e.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
            {entries.length > 0 && (
              <tfoot className="border-t border-gray-200 bg-gray-50">
                <tr>
                  <td colSpan={4} className="px-4 py-2.5 text-sm font-medium text-gray-900">Total</td>
                  <td className="px-4 py-2.5 text-right text-sm font-bold text-gray-900">{fmtUsd(totalUsd)}</td>
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
