"use client";
import { QRCodeSVG } from "qrcode.react";
import Image from "next/image";

type CardEmp = {
  id: number;
  nameEn: string;
  nameKh: string;
  nameZh: string | null;
  employeeCode: string | null;
  photoUrl: string | null;
  hireDate: string;
  phone: string | null;
  shift: string | null;
  department: { name: string } | null;
  position: { name: string } | null;
  factoryArea: { code: string } | null;
};

export function CardView({ emp }: { emp: CardEmp }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const qrValue = `${origin}/employees/${emp.id}`;

  const hireYear = new Date(emp.hireDate).getFullYear();
  const hireFmt = new Date(emp.hireDate).toLocaleDateString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
  });
  const initials = emp.nameEn.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);

  return (
    <>
      {/* Screen chrome — hidden when printing */}
      <div className="no-print" style={{
        minHeight: "100vh",
        background: "var(--bg)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        padding: 32,
      }}>
        <div style={{ textAlign: "center" }}>
          <p style={{ fontSize: 13, color: "var(--text-3)", marginBottom: 6 }}>
            Employee ID Card — {emp.nameEn}
          </p>
          <button
            className="btn btn-primary"
            onClick={() => window.print()}
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <polyline points="6 9 6 2 18 2 18 9"/>
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            Print Card
          </button>
        </div>

        {/* Card preview — scaled up for screen readability */}
        <div style={{ transform: "scale(2.4)", transformOrigin: "top center", marginBottom: 200 }}>
          <CardFace emp={emp} qrValue={qrValue} initials={initials} hireFmt={hireFmt} hireYear={hireYear} />
        </div>
      </div>

      {/* Print-only: just the card */}
      <div className="print-only" style={{ display: "none" }}>
        <CardFace emp={emp} qrValue={qrValue} initials={initials} hireFmt={hireFmt} hireYear={hireYear} />
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          @page { size: 86mm 54mm; margin: 0; }
          body { margin: 0; background: white; }
        }
      `}</style>
    </>
  );
}

function CardFace({
  emp, qrValue, initials, hireFmt, hireYear,
}: {
  emp: CardEmp;
  qrValue: string;
  initials: string;
  hireFmt: string;
  hireYear: number;
}) {
  return (
    <div style={{
      width: "86mm",
      height: "54mm",
      background: "#fff",
      borderRadius: 4,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      boxShadow: "0 2px 16px rgba(0,0,0,0.18)",
    }}>
      {/* Header strip */}
      <div style={{
        background: "#2d4a63",
        color: "#fff",
        padding: "4px 10px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexShrink: 0,
      }}>
        <div style={{ fontWeight: 800, fontSize: 11, letterSpacing: "0.04em" }}>ZY STEEL</div>
        <div style={{ width: 1, height: 10, background: "rgba(255,255,255,0.3)" }} />
        <div style={{ fontSize: 9.5, color: "rgba(255,255,255,0.75)" }}>中粤铁网</div>
        <div style={{ marginLeft: "auto", fontSize: 8.5, background: "rgba(255,255,255,0.18)", padding: "1px 6px", borderRadius: 3, letterSpacing: "0.06em" }}>
          EMPLOYEE ID
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* Photo */}
        <div style={{
          width: 68,
          flexShrink: 0,
          background: "#f0f4f7",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}>
          {emp.photoUrl ? (
            <Image
              src={emp.photoUrl}
              alt={emp.nameEn}
              width={68}
              height={68}
              style={{ objectFit: "cover", width: "100%", height: "100%" }}
            />
          ) : (
            <div style={{
              width: 68, height: 68,
              background: "#dce8f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 22,
              fontWeight: 800,
              color: "#2d4a63",
            }}>
              {initials}
            </div>
          )}
        </div>

        {/* Info block */}
        <div style={{ flex: 1, padding: "7px 9px", display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0 }}>
          <div>
            {emp.employeeCode && (
              <div style={{ fontSize: 8.5, fontWeight: 700, color: "#2d4a63", letterSpacing: "0.08em", marginBottom: 2 }}>
                {emp.employeeCode}
              </div>
            )}
            <div style={{ fontSize: 12.5, fontWeight: 800, color: "#1c1c1a", lineHeight: 1.2, marginBottom: 1 }}>
              {emp.nameEn}
            </div>
            <div style={{ fontSize: 9.5, color: "#6b6b66", lineHeight: 1.3 }}>
              {emp.nameKh}{emp.nameZh ? ` · ${emp.nameZh}` : ""}
            </div>
            <div style={{ marginTop: 5, fontSize: 9.5, color: "#1c1c1a", fontWeight: 500 }}>
              {[emp.department?.name, emp.position?.name].filter(Boolean).join(" · ")}
            </div>
            {emp.factoryArea && (
              <div style={{ marginTop: 2, fontSize: 8.5, color: "#9a9a94" }}>
                Area: {emp.factoryArea.code}{emp.shift ? ` · ${emp.shift}` : ""}
              </div>
            )}
          </div>
          <div style={{ fontSize: 8.5, color: "#9a9a94" }}>
            Since {hireFmt}
          </div>
        </div>

        {/* QR code */}
        <div style={{
          padding: "7px 8px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}>
          <QRCodeSVG value={qrValue || `emp-${emp.id}`} size={52} level="M" />
          <div style={{ fontSize: 7, color: "#9a9a94", marginTop: 3, textAlign: "center" }}>Scan to view</div>
        </div>
      </div>
    </div>
  );
}
