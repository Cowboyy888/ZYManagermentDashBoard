"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
const BLOB_SUFFIX = ".blob.vercel-storage.com";
function resolvePhotoUrl(url: string) {
  return url.includes(BLOB_SUFFIX) ? `/api/employee-photo?url=${encodeURIComponent(url)}` : url;
}
import { QRCodeSVG } from "qrcode.react";
import { EmployeeForm } from "@/components/forms/EmployeeForm";
import { updateEmployeePhoto } from "@/actions/employees";

interface Document {
  id: number; type: string; filename: string; url: string;
  fileSize: number | null; mimeType: string | null;
  expiryDate: string | null; notes: string | null;
  createdAt: string;
}

interface AttendanceEntry {
  id: number; date: string; am: string; pm: string;
}

interface OvertimeEntry {
  id: number; date: string; hours: number; band: string;
  description: string | null; amountUsd: number;
}

interface Emp {
  id: number;
  nameEn: string; nameKh: string; nameZh: string | null;
  employeeCode: string | null; photoUrl: string | null;
  gender: string | null; birthday: string | null;
  nationality: string | null; phone: string | null;
  email: string | null; address: string | null;
  emergencyContact: { name?: string; phone?: string; relation?: string } | null;
  positionId: number | null; position: { id: number; name: string } | null;
  factoryAreaId: number | null; factoryArea: { id: number; name: string; code: string } | null;
  productionLine: string | null; shift: string | null;
  supervisorId: number | null;
  supervisor: { id: number; nameEn: string; nameKh: string } | null;
  subordinates: { id: number; nameEn: string; nameKh: string; positionId: number | null; position: { name: string } | null }[];
  departmentId: number | null; department: { id: number; name: string } | null;
  dailyRateUsd: number;
  hireDate: string; contractExpiry: string | null; probationEnd: string | null;
  status: string; note: string | null;
  documents: Document[];
  attendance: AttendanceEntry[];
  overtime: OvertimeEntry[];
}

interface Props {
  emp: Emp;
  canEdit: boolean;
  positions: { id: number; name: string; level: number }[];
  factoryAreas: { id: number; name: string; code: string }[];
  departments: { id: number; name: string }[];
  supervisors: { id: number; nameEn: string; nameKh: string }[];
}

function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
}

const CardStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 12,
  padding: 20,
};

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 12, paddingBottom: 10, borderBottom: "1px solid var(--border)" }}>
      <span style={{ minWidth: 140, fontSize: 12, fontWeight: 500, color: "var(--text-3)" }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--text)" }}>{value || "—"}</span>
    </div>
  );
}

const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_PHOTO_SIZE = 10 * 1024 * 1024;

export function EmployeeProfileClient({ emp, canEdit, positions, factoryAreas, departments, supervisors }: Props) {
  const router = useRouter();
  const [showEdit, setShowEdit] = useState(false);
  const [showDocUpload, setShowDocUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"info" | "attendance" | "overtime" | "documents">("info");

  const daysToExpiry = daysUntil(emp.contractExpiry);
  const contractAlert = daysToExpiry !== null && daysToExpiry <= 30;

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhotoError(null);
    if (!ALLOWED_PHOTO_TYPES.includes(f.type)) {
      setPhotoError("Only JPEG, PNG, or WebP images are allowed.");
      return;
    }
    if (f.size > MAX_PHOTO_SIZE) {
      setPhotoError("Photo must be under 10 MB.");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("employeeId", String(emp.id));
      const res = await fetch("/api/upload/photo", { method: "POST", body: fd });
      let json: { ok?: boolean; url?: string; error?: string };
      try {
        json = await res.json();
      } catch {
        throw new Error(`Server error (${res.status})`);
      }
      if (json.url) {
        await updateEmployeePhoto(emp.id, json.url);
        router.refresh();
      } else {
        setPhotoError(json.error ?? "Upload failed — please try again.");
      }
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Upload failed — please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function handleDocUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUploading(true);
    const fd = new FormData(e.currentTarget);
    fd.append("employeeId", String(emp.id));
    await fetch("/api/upload/document", { method: "POST", body: fd });
    setUploading(false);
    setShowDocUpload(false);
    router.refresh();
  }

  const qrValue = `${typeof window !== "undefined" ? window.location.origin : ""}/employees/${emp.id}`;

  const tabStyle = (t: string): React.CSSProperties => ({
    padding: "8px 16px", borderRadius: 8, border: "none",
    background: activeTab === t ? "var(--steel)" : "transparent",
    color: activeTab === t ? "#fff" : "var(--text-2)",
    fontWeight: activeTab === t ? 600 : 400,
    fontSize: 13, cursor: "pointer",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Contract expiry alert */}
      {contractAlert && (
        <div style={{
          padding: "12px 16px", borderRadius: 8,
          background: daysToExpiry! <= 7 ? "var(--red-bg)" : "var(--amber-bg)",
          color: daysToExpiry! <= 7 ? "var(--red)" : "var(--amber)",
          fontSize: 13, fontWeight: 500,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          ⚠ Contract expires {daysToExpiry! <= 0 ? "today" : `in ${daysToExpiry} days`} — {fmt(emp.contractExpiry)}
        </div>
      )}

      {/* Header card */}
      <div style={{ ...CardStyle, display: "flex", gap: 24, flexWrap: "wrap" }}>
        {/* Photo */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <div style={{
            width: 100, height: 100, borderRadius: 16, overflow: "hidden",
            background: "var(--surface-2)", border: "2px solid var(--border)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {emp.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={resolvePhotoUrl(emp.photoUrl)}
                alt={emp.nameEn}
                width={100}
                height={100}
                style={{ objectFit: "cover", display: "block", width: 100, height: 100 }}
              />
            ) : (
              <svg aria-hidden="true" width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth={1.5}>
                <circle cx="12" cy="8" r="3"/><path d="M20 21a8 8 0 0 0-16 0"/>
              </svg>
            )}
          </div>
          {canEdit && (
            <label style={{
              position: "absolute", bottom: -6, right: -6, width: 24, height: 24,
              background: "var(--steel)", borderRadius: "50%", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              border: "2px solid var(--surface)",
            }}>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2.5}>
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>
              </svg>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePhotoChange} style={{ display: "none" }} />
            </label>
          )}
          {photoError && (
            <div style={{
              position: "absolute", top: "calc(100% + 6px)", left: "50%",
              transform: "translateX(-50%)",
              padding: "5px 8px", borderRadius: 6, zIndex: 10,
              background: "var(--red-bg)", color: "var(--red)", fontSize: 11,
              whiteSpace: "nowrap",
            }}>
              {photoError}
            </div>
          )}
        </div>

        {/* Name + meta */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", marginBottom: 2 }}>{emp.nameEn}</h1>
              <p style={{ fontSize: 14, color: "var(--text-2)" }}>{emp.nameKh}{emp.nameZh ? ` · ${emp.nameZh}` : ""}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                {emp.employeeCode && (
                  <span style={{
                    padding: "2px 10px", borderRadius: 6, fontSize: 12, fontWeight: 700,
                    background: "var(--steel-light)", color: "var(--steel)",
                    letterSpacing: "0.05em",
                  }}>
                    {emp.employeeCode}
                  </span>
                )}
                {emp.position && (
                  <span style={{ padding: "2px 10px", borderRadius: 6, fontSize: 12, background: "var(--purple-bg)", color: "var(--purple)" }}>
                    {emp.position.name}
                  </span>
                )}
                {emp.department && (
                  <span style={{ padding: "2px 10px", borderRadius: 6, fontSize: 12, background: "var(--blue-bg)", color: "var(--blue)" }}>
                    {emp.department.name}
                  </span>
                )}
                <span style={{
                  padding: "2px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600,
                  background: emp.status === "ACTIVE" ? "var(--green-bg)" : "var(--border)",
                  color: emp.status === "ACTIVE" ? "var(--green)" : "var(--text-3)",
                }}>
                  {emp.status}
                </span>
              </div>
            </div>

            {/* QR code + card link */}
            <div style={{ textAlign: "center" }}>
              <QRCodeSVG value={qrValue} size={80} level="M" />
              <p style={{ fontSize: 10, color: "var(--text-3)", marginTop: 4 }}>Employee QR</p>
              <a
                href={`/employees/${emp.id}/card`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-block",
                  marginTop: 6,
                  fontSize: 11,
                  color: "var(--steel)",
                  textDecoration: "none",
                  fontWeight: 500,
                }}
              >
                Print ID Card →
              </a>
            </div>
          </div>

          <div style={{ display: "flex", gap: 20, marginTop: 14, flexWrap: "wrap" }}>
            {emp.phone && (
              <a href={`tel:${emp.phone}`} style={{ fontSize: 13, color: "var(--steel)", textDecoration: "none", display: "flex", alignItems: "center", gap: 5 }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 2.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 5.91 5.91l.75-.75a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 17l.19-.08z"/>
                </svg>
                {emp.phone}
              </a>
            )}
            {emp.email && (
              <a href={`mailto:${emp.email}`} style={{ fontSize: 13, color: "var(--steel)", textDecoration: "none", display: "flex", alignItems: "center", gap: 5 }}>
                <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                </svg>
                {emp.email}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      {canEdit && (
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setShowEdit(v => !v)}
            style={{
              padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
              background: showEdit ? "var(--surface-2)" : "var(--steel)",
              color: showEdit ? "var(--text-2)" : "#fff",
              border: showEdit ? "1px solid var(--border)" : "none", cursor: "pointer",
            }}>
            {showEdit ? "Cancel editing" : "Edit profile"}
          </button>
          <button onClick={() => setShowDocUpload(v => !v)}
            style={{
              padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500,
              background: "var(--surface-2)", color: "var(--text-2)",
              border: "1px solid var(--border)", cursor: "pointer",
            }}>
            + Upload document
          </button>
        </div>
      )}

      {/* Edit form */}
      {showEdit && (
        <div style={{ ...CardStyle }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20, color: "var(--text)" }}>Edit Employee</h3>
          <EmployeeForm
            departments={departments}
            positions={positions}
            factoryAreas={factoryAreas}
            supervisors={supervisors}
            editing={{
              id: emp.id,
              nameEn: emp.nameEn, nameKh: emp.nameKh, nameZh: emp.nameZh,
              employeeCode: emp.employeeCode, photoUrl: emp.photoUrl,
              gender: emp.gender, birthday: emp.birthday ? new Date(emp.birthday) : null,
              nationality: emp.nationality, phone: emp.phone,
              email: emp.email, address: emp.address,
              emergencyContact: emp.emergencyContact,
              positionId: emp.positionId, factoryAreaId: emp.factoryAreaId,
              productionLine: emp.productionLine, shift: emp.shift,
              supervisorId: emp.supervisorId, departmentId: emp.departmentId,
              dailyRateUsd: emp.dailyRateUsd, hireDate: emp.hireDate,
              contractExpiry: emp.contractExpiry ? new Date(emp.contractExpiry) : null,
              probationEnd: emp.probationEnd ? new Date(emp.probationEnd) : null,
              status: emp.status, note: emp.note,
            }}
            onDone={() => { setShowEdit(false); router.refresh(); }}
          />
        </div>
      )}

      {/* Document upload form */}
      {showDocUpload && (
        <div style={CardStyle}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, color: "var(--text)" }}>Upload Document</h3>
          <form onSubmit={handleDocUpload} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 4 }}>Document Type</label>
              <select name="type" required style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 13 }}>
                <option value="CONTRACT">Contract</option>
                <option value="ID_CARD">ID Card</option>
                <option value="PASSPORT">Passport</option>
                <option value="VISA">Visa</option>
                <option value="WORK_PERMIT">Work Permit</option>
                <option value="RESUME">Resume / CV</option>
                <option value="CERTIFICATE">Certificate</option>
                <option value="MEDICAL">Medical</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 4 }}>Expiry Date</label>
              <input name="expiryDate" type="date" style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 13 }} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 4 }}>File *</label>
              <input name="file" type="file" required style={{ fontSize: 13 }} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 4 }}>Notes</label>
              <input name="notes" type="text" style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid var(--border)", fontSize: 13 }} />
            </div>
            <div style={{ gridColumn: "1 / -1", display: "flex", gap: 10 }}>
              <button type="submit" disabled={uploading}
                style={{ padding: "8px 18px", borderRadius: 8, background: "var(--steel)", color: "#fff", border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                {uploading ? "Uploading…" : "Upload"}
              </button>
              <button type="button" onClick={() => setShowDocUpload(false)}
                style={{ padding: "8px 16px", borderRadius: 8, background: "var(--surface-2)", color: "var(--text-2)", border: "1px solid var(--border)", fontSize: 13, cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, background: "var(--surface-2)", padding: 4, borderRadius: 10, width: "fit-content" }}>
        {(["info", "attendance", "overtime", "documents"] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={tabStyle(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
            {t === "documents" && emp.documents.length > 0 && (
              <span style={{ marginLeft: 6, background: "rgba(255,255,255,0.3)", borderRadius: 10, padding: "0 5px", fontSize: 11 }}>
                {emp.documents.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "info" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ ...CardStyle, display: "flex", flexDirection: "column", gap: 10 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-3)", marginBottom: 4 }}>Personal</h3>
            <InfoRow label="Gender" value={emp.gender} />
            <InfoRow label="Birthday" value={fmt(emp.birthday)} />
            <InfoRow label="Nationality" value={emp.nationality} />
            <InfoRow label="Phone" value={emp.phone} />
            <InfoRow label="Email" value={emp.email} />
            <InfoRow label="Address" value={emp.address} />
          </div>
          <div style={{ ...CardStyle, display: "flex", flexDirection: "column", gap: 10 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-3)", marginBottom: 4 }}>Employment</h3>
            <InfoRow label="Hire Date" value={fmt(emp.hireDate)} />
            <InfoRow label="Contract Expiry" value={
              <span style={{ color: contractAlert ? "var(--red)" : "var(--text)" }}>{fmt(emp.contractExpiry)}</span>
            } />
            <InfoRow label="Probation End" value={fmt(emp.probationEnd)} />
            <InfoRow label="Daily Rate" value={`$${emp.dailyRateUsd.toFixed(2)}`} />
            <InfoRow label="Shift" value={emp.shift} />
            <InfoRow label="Production Line" value={emp.productionLine} />
            <InfoRow label="Supervisor" value={emp.supervisor ? `${emp.supervisor.nameEn} / ${emp.supervisor.nameKh}` : null} />
          </div>
          {emp.emergencyContact && (
            <div style={CardStyle}>
              <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-3)", marginBottom: 12 }}>Emergency Contact</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <InfoRow label="Name" value={(emp.emergencyContact as { name?: string }).name} />
                <InfoRow label="Phone" value={(emp.emergencyContact as { phone?: string }).phone} />
                <InfoRow label="Relation" value={(emp.emergencyContact as { relation?: string }).relation} />
              </div>
            </div>
          )}
          {emp.subordinates.length > 0 && (
            <div style={CardStyle}>
              <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-3)", marginBottom: 12 }}>
                Direct Reports ({emp.subordinates.length})
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {emp.subordinates.map(s => (
                  <a key={s.id} href={`/employees/${s.id}`} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "8px 0", borderBottom: "1px solid var(--border)",
                    textDecoration: "none", color: "var(--text)",
                  }}>
                    <span style={{ fontSize: 13 }}>{s.nameEn} / {s.nameKh}</span>
                    {s.position && <span style={{ fontSize: 11, color: "var(--text-3)" }}>{s.position.name}</span>}
                  </a>
                ))}
              </div>
            </div>
          )}
          {emp.note && (
            <div style={{ ...CardStyle, gridColumn: "1 / -1" }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--text-3)", marginBottom: 8 }}>Notes</h3>
              <p style={{ fontSize: 13, color: "var(--text)", whiteSpace: "pre-wrap" }}>{emp.note}</p>
            </div>
          )}
        </div>
      )}

      {activeTab === "attendance" && (
        <div style={CardStyle}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>Recent Attendance (last 30 records)</h3>
          {emp.attendance.length === 0 ? (
            <p style={{ color: "var(--text-3)", fontSize: 13 }}>No attendance records found.</p>
          ) : (
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-2)" }}>
                  {["Date", "AM", "PM"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-3)", borderBottom: "1px solid var(--border)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {emp.attendance.map(a => (
                  <tr key={a.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px 12px" }}>{fmt(a.date)}</td>
                    <td style={{ padding: "8px 12px" }}><MarkBadge mark={a.am} /></td>
                    <td style={{ padding: "8px 12px" }}><MarkBadge mark={a.pm} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === "overtime" && (
        <div style={CardStyle}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>Recent Overtime (last 20 records)</h3>
          {emp.overtime.length === 0 ? (
            <p style={{ color: "var(--text-3)", fontSize: 13 }}>No overtime records found.</p>
          ) : (
            <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--surface-2)" }}>
                  {["Date", "Hours", "Band", "Amount", "Description"].map(h => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-3)", borderBottom: "1px solid var(--border)" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {emp.overtime.map(o => (
                  <tr key={o.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px 12px" }}>{fmt(o.date)}</td>
                    <td style={{ padding: "8px 12px" }}>{o.hours}h</td>
                    <td style={{ padding: "8px 12px", fontSize: 11 }}>{o.band.replace(/_/g, " ")}</td>
                    <td style={{ padding: "8px 12px", fontVariantNumeric: "tabular-nums" }}>${o.amountUsd.toFixed(2)}</td>
                    <td style={{ padding: "8px 12px", color: "var(--text-2)" }}>{o.description ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === "documents" && (
        <div style={CardStyle}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 16 }}>Documents ({emp.documents.length})</h3>
          {emp.documents.length === 0 ? (
            <p style={{ color: "var(--text-3)", fontSize: 13 }}>No documents uploaded yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {emp.documents.map(doc => {
                const expDays = daysUntil(doc.expiryDate);
                return (
                  <div key={doc.id} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "12px 16px", borderRadius: 8, border: "1px solid var(--border)",
                    background: expDays !== null && expDays <= 30 ? "var(--amber-bg)" : "var(--surface)",
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>
                        {doc.type.replace(/_/g, " ")}
                        {expDays !== null && expDays <= 30 && (
                          <span style={{ marginLeft: 8, fontSize: 11, color: "var(--amber)", fontWeight: 700 }}>
                            Expires in {expDays}d
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
                        {doc.filename}
                        {doc.expiryDate && ` · expires ${fmt(doc.expiryDate)}`}
                      </div>
                    </div>
                    <a href={doc.url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: 12, color: "var(--steel)", textDecoration: "none", fontWeight: 600 }}>
                      View ↗
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MarkBadge({ mark }: { mark: string }) {
  const cfg: Record<string, { label: string; bg: string; color: string }> = {
    PRESENT: { label: "Present", bg: "var(--green-bg)", color: "var(--green)" },
    LEAVE:   { label: "Leave",   bg: "var(--amber-bg)", color: "var(--amber)" },
    ABSENT:  { label: "Absent",  bg: "var(--red-bg)",   color: "var(--red)" },
  };
  const c = cfg[mark] ?? { label: mark, bg: "var(--border)", color: "var(--text-3)" };
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 20,
      fontSize: 11, fontWeight: 600, background: c.bg, color: c.color,
    }}>
      {c.label}
    </span>
  );
}
