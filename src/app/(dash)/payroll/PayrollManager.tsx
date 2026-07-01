"use client";
import { useState, useTransition } from "react";
import { runPayrollForPeriod, lockPeriod, exportPayrollCsv, getPayslips } from "@/actions/payroll";

interface Period {
  id: number;
  year: number;
  month: number;
  half: number;
  startDate: string;
  endDate: string;
  workingDays: number;
  locked: boolean;
}

interface Payslip {
  employeeId: number;
  nameEn: string;
  nameKh: string;
  daysWorked: number;
  dailyRateUsd: number;
  baseUsd: number;
  overtimeUsd: number;
  bonusUsd: number;
  deductionUsd: number;
  grossUsd: number;
  netUsd: number;
  netKhr: number;
}

interface Props {
  periods: Period[];
  canRun: boolean;
  canLock: boolean;
  canExport: boolean;
}

export function PayrollManager({ periods, canRun, canLock, canExport }: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(periods[0]?.id ?? null);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const period = periods.find((p) => p.id === selectedId);

  function loadPayslips(id: number) {
    startTransition(async () => {
      const rows = await getPayslips(id);
      setPayslips(rows.map((r) => ({
        employeeId: r.employeeId,
        nameEn: r.employee.nameEn,
        nameKh: r.employee.nameKh,
        daysWorked: Number(r.daysWorked),
        dailyRateUsd: Number(r.dailyRateUsd),
        baseUsd: Number(r.baseUsd),
        overtimeUsd: Number(r.overtimeUsd),
        bonusUsd: Number(r.bonusUsd),
        deductionUsd: Number(r.deductionUsd),
        grossUsd: Number(r.grossUsd),
        netUsd: Number(r.netUsd),
        netKhr: Number(r.netKhr),
      })));
      setLoaded(true);
    });
  }

  function selectPeriod(id: number) {
    setSelectedId(id);
    setLoaded(false);
    setPayslips([]);
    setMsg(null);
    loadPayslips(id);
  }

  function runPayroll() {
    if (!selectedId) return;
    setMsg(null);
    startTransition(async () => {
      const res = await runPayrollForPeriod(selectedId);
      if ('error' in res) { setMsg({ type: "err", text: res.error }); return; }
      setMsg({ type: "ok", text: `Payroll run: ${res.data.count} payslips, gross $${res.data.grossUsd.toFixed(2)}` });
      loadPayslips(selectedId);
    });
  }

  function lock() {
    if (!selectedId || !confirm("Lock this period? Payslips will be immutable after locking.")) return;
    startTransition(async () => {
      const res = await lockPeriod(selectedId);
      if ('error' in res) { setMsg({ type: "err", text: res.error }); return; }
      setMsg({ type: "ok", text: "Period locked successfully." });
    });
  }

  function exportCsv() {
    if (!selectedId) return;
    startTransition(async () => {
      const res = await exportPayrollCsv(selectedId);
      if ('error' in res) { setMsg({ type: "err", text: res.error }); return; }
      const blob = new Blob([res.data.csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = res.data.filename; a.click();
      URL.revokeObjectURL(url);
    });
  }

  const fmtUsd = (n: number) => `$${n.toFixed(2)}`;
  const totalGross = payslips.reduce((a, p) => a + p.grossUsd, 0);
  const totalNet = payslips.reduce((a, p) => a + p.netUsd, 0);
  const totalKhr = payslips.reduce((a, p) => a + p.netKhr, 0);

  return (
    <div className="space-y-4">
      {/* Period selector */}
      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Pay periods</h2>
        </div>
        {periods.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-400">No pay periods found. Create one in the database.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {periods.map((p) => {
              const label = `${p.year}-${String(p.month).padStart(2, "0")} H${p.half}`;
              const active = p.id === selectedId;
              return (
                <button key={p.id} onClick={() => selectPeriod(p.id)}
                  className={`flex w-full items-center justify-between px-4 py-3 text-sm transition-colors ${active ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                  <div className="flex items-center gap-3">
                    <div className={`h-2 w-2 rounded-full ${p.locked ? "bg-emerald-500" : "bg-amber-400"}`} />
                    <span className={`font-medium ${active ? "text-blue-700" : "text-gray-800"}`}>{label}</span>
                    <span className="text-xs text-gray-400">{p.startDate.slice(0, 10)} – {p.endDate.slice(0, 10)}</span>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${p.locked ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                    {p.locked ? "Locked" : "Open"}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Action bar */}
      {period && (
        <div className="flex flex-wrap items-center gap-2">
          {canRun && !period.locked && (
            <button onClick={runPayroll} disabled={isPending}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 hover:bg-blue-700 transition-colors">
              {isPending ? "Running…" : "Run payroll"}
            </button>
          )}
          {canLock && !period.locked && payslips.length > 0 && (
            <button onClick={lock} disabled={isPending}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60">
              Lock period
            </button>
          )}
          {canExport && payslips.length > 0 && (
            <button onClick={exportCsv} disabled={isPending}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-60">
              ↓ Export CSV
            </button>
          )}
          {msg && (
            <p className={`text-sm ${msg.type === "ok" ? "text-emerald-700" : "text-rose-600"}`}>{msg.text}</p>
          )}
        </div>
      )}

      {/* Payslip table */}
      {loaded && (
        <div className="rounded-xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-sm font-semibold text-gray-900">
              Payslips{payslips.length > 0 ? ` — ${payslips.length} employees` : ""}
            </h2>
          </div>
          {payslips.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-gray-400">No payslips yet. Run payroll to generate them.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Employee</th>
                    <th className="px-4 py-3 text-right">Days</th>
                    <th className="px-4 py-3 text-right">Rate/day</th>
                    <th className="px-4 py-3 text-right">Base</th>
                    <th className="px-4 py-3 text-right">OT</th>
                    <th className="px-4 py-3 text-right">Bonus</th>
                    <th className="px-4 py-3 text-right">Deduction</th>
                    <th className="px-4 py-3 text-right">Gross</th>
                    <th className="px-4 py-3 text-right font-semibold">Net (USD)</th>
                    <th className="px-4 py-3 text-right font-semibold">Net (KHR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {payslips.map((p) => (
                    <tr key={p.employeeId} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-gray-800">{p.nameEn}</div>
                        <div className="text-xs text-gray-400">{p.nameKh}</div>
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{p.daysWorked}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500">{fmtUsd(p.dailyRateUsd)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{fmtUsd(p.baseUsd)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-700">{fmtUsd(p.overtimeUsd)}</td>
                      <td className="px-4 py-2.5 text-right text-gray-500">{fmtUsd(p.bonusUsd)}</td>
                      <td className="px-4 py-2.5 text-right text-rose-600">{p.deductionUsd > 0 ? `-${fmtUsd(p.deductionUsd)}` : "—"}</td>
                      <td className="px-4 py-2.5 text-right text-gray-800">{fmtUsd(p.grossUsd)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{fmtUsd(p.netUsd)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-gray-900">{p.netKhr.toLocaleString()}&#x17DB;</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-gray-200 bg-gray-50 font-medium">
                  <tr>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-900" colSpan={3}>Total ({payslips.length})</td>
                    <td className="px-4 py-3 text-right text-sm">{fmtUsd(payslips.reduce((a,p) => a+p.baseUsd,0))}</td>
                    <td className="px-4 py-3 text-right text-sm">{fmtUsd(payslips.reduce((a,p) => a+p.overtimeUsd,0))}</td>
                    <td className="px-4 py-3 text-right text-sm">{fmtUsd(payslips.reduce((a,p) => a+p.bonusUsd,0))}</td>
                    <td className="px-4 py-3 text-right text-sm text-rose-600">-{fmtUsd(payslips.reduce((a,p) => a+p.deductionUsd,0))}</td>
                    <td className="px-4 py-3 text-right text-sm">{fmtUsd(totalGross)}</td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">{fmtUsd(totalNet)}</td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">{totalKhr.toLocaleString()}&#x17DB;</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
