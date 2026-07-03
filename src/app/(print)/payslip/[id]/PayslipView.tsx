"use client";
import type { PayslipDetailRow } from "@/actions/payroll";

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}
function fmtUsd(n: number): string { return `$${n.toFixed(2)}`; }
function fmtKhr(n: number): string { return `${n.toLocaleString()}៛`; }

interface LineItem {
  label: string;
  amount: number;
  negative?: boolean;
  bold?: boolean;
  divider?: boolean;
}

export function PayslipView({ slip }: { slip: PayslipDetailRow }) {
  const breakdown = slip.breakdown as {
    base?: { dailyRateUsd: number; daysWorked: number; subtotal: number };
    overtime?: { amountUsd: number };
    bonus?: { amountUsd: number };
    deduction?: { amountUsd: number };
    exchangeRate?: number;
  } | null;

  const lines: LineItem[] = [
    { label: `Basic Pay (${slip.daysWorked} days × ${fmtUsd(slip.dailyRateUsd)}/day)`, amount: slip.baseUsd },
    ...(slip.overtimeUsd > 0 ? [{ label: "Overtime", amount: slip.overtimeUsd }] : []),
    ...(slip.bonusUsd > 0 ? [{ label: "Bonus / Allowance", amount: slip.bonusUsd }] : []),
    { label: "Gross Pay", amount: slip.grossUsd, bold: true, divider: true },
    ...(slip.deductionUsd > 0 ? [{ label: "Deductions", amount: slip.deductionUsd, negative: true }] : []),
    { label: "Net Pay (USD)", amount: slip.netUsd, bold: true, divider: true },
  ];

  return (
    <>
      {/* Screen chrome */}
      <div className="no-print" style={{
        minHeight: "100vh",
        background: "#f5f7f9",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "32px 16px",
        gap: 20,
      }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button
            className="btn btn-primary"
            onClick={() => window.print()}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ marginRight: 6, verticalAlign: "middle" }}>
              <polyline points="6 9 6 2 18 2 18 9"/>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            Print Payslip
          </button>
          <button className="btn" onClick={() => window.history.back()}>← Back</button>
          <span style={{ fontSize: 13, color: "#888" }}>
            {slip.finalized ? "✓ Finalized" : "Draft — not finalized"}
          </span>
        </div>

        <div style={{ width: "100%", maxWidth: 680 }}>
          <PayslipDocument slip={slip} lines={lines} breakdown={breakdown} />
        </div>
      </div>

      {/* Print-only */}
      <div className="print-only" style={{ display: "none" }}>
        <PayslipDocument slip={slip} lines={lines} breakdown={breakdown} />
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          @page { size: A4; margin: 18mm; }
          body { margin: 0; background: white; }
        }
      `}</style>
    </>
  );
}

function PayslipDocument({
  slip, lines, breakdown,
}: {
  slip: PayslipDetailRow;
  lines: LineItem[];
  breakdown: { base?: { dailyRateUsd: number; daysWorked: number; subtotal: number }; overtime?: { amountUsd: number }; bonus?: { amountUsd: number }; deduction?: { amountUsd: number }; exchangeRate?: number } | null;
}) {
  const exchangeRate = breakdown?.exchangeRate ?? slip.exchangeRate;

  return (
    <div style={{
      background: "#fff",
      border: "1px solid #ddd",
      borderRadius: 8,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      fontSize: 13,
      color: "#1c1c1a",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{ background: "#2d4a63", color: "#fff", padding: "20px 28px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 20, letterSpacing: "0.02em" }}>ZY STEEL</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)", marginTop: 2 }}>中粤铁网 (Cambodia) Co., Ltd.</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>PAYSLIP</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", marginTop: 3 }}>{slip.finalized ? "FINALIZED" : "DRAFT"}</div>
        </div>
      </div>

      <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Period + Employee info */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Pay Period</div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{slip.periodLabel}</div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 3 }}>
              {fmtDate(slip.periodStart)} – {fmtDate(slip.periodEnd)}
            </div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
              Exchange rate: {exchangeRate.toLocaleString()} KHR / USD
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Employee</div>
            {slip.employeeCode && (
              <div style={{ fontSize: 11, fontWeight: 700, color: "#2d4a63", letterSpacing: "0.08em", marginBottom: 2 }}>{slip.employeeCode}</div>
            )}
            <div style={{ fontWeight: 700, fontSize: 15 }}>{slip.nameEn}</div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{slip.nameKh}{slip.nameZh ? ` · ${slip.nameZh}` : ""}</div>
            <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>
              {[slip.departmentName, slip.positionName].filter(Boolean).join(" · ") || "—"}
            </div>
          </div>
        </div>

        {/* Line items */}
        <div style={{ borderTop: "1px solid #eee", paddingTop: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "#999", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Pay Breakdown</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              {lines.map((line, i) => (
                <tr key={i} style={{ borderTop: line.divider ? "1px solid #ddd" : undefined }}>
                  <td style={{
                    padding: line.divider ? "10px 0 6px" : "6px 0",
                    fontSize: line.bold ? 14 : 13,
                    fontWeight: line.bold ? 700 : 400,
                    color: line.bold ? "#1c1c1a" : "#444",
                  }}>
                    {line.label}
                  </td>
                  <td style={{
                    padding: line.divider ? "10px 0 6px" : "6px 0",
                    textAlign: "right",
                    fontSize: line.bold ? 14 : 13,
                    fontWeight: line.bold ? 700 : 400,
                    color: line.negative ? "#c0392b" : line.bold ? "#1c1c1a" : "#444",
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    {line.negative ? "-" : ""}{fmtUsd(line.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Net pay highlight */}
        <div style={{ background: "#f0f4f7", borderRadius: 8, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, color: "#666", fontWeight: 600, marginBottom: 4 }}>NET PAY</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#2d4a63" }}>{fmtUsd(slip.netUsd)}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 11, color: "#666", fontWeight: 600, marginBottom: 4 }}>IN RIEL</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#444" }}>{fmtKhr(slip.netKhr)}</div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: "1px solid #eee", paddingTop: 16, display: "flex", justifyContent: "space-between", fontSize: 11, color: "#aaa" }}>
          <div>Generated: {fmtDate(slip.createdAt)}</div>
          <div>Payslip #{slip.id}</div>
        </div>

        {/* Signature line */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 24, marginTop: 8 }}>
          {["Prepared by", "Approved by", "Employee signature"].map((label) => (
            <div key={label} style={{ borderTop: "1px solid #ccc", paddingTop: 6 }}>
              <div style={{ fontSize: 10, color: "#aaa" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
