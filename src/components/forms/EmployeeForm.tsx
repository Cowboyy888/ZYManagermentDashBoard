"use client";
import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { createEmployee, updateEmployee, updateEmployeePhoto } from "@/actions/employees";

interface SelectOption { id: number; name: string }
interface PositionOption { id: number; name: string; level: number }
interface AreaOption { id: number; name: string; code: string }
interface SupervisorOption { id: number; nameEn: string; nameKh: string }

interface EditingEmployee {
  id: number;
  nameKh: string; nameZh: string | null; nameEn: string;
  employeeCode: string | null; photoUrl: string | null;
  gender: string | null; birthday: Date | string | null; nationality: string | null;
  phone: string | null; email: string | null; address: string | null;
  emergencyContact: { name?: string; phone?: string; relation?: string } | null;
  positionId: number | null; factoryAreaId: number | null;
  productionLine: string | null; shift: string | null; supervisorId: number | null;
  departmentId: number | null; dailyRateUsd: number;
  hireDate: Date | string; contractExpiry: Date | string | null; probationEnd: Date | string | null;
  status: string; note: string | null;
}

interface Props {
  departments: SelectOption[];
  positions: PositionOption[];
  factoryAreas: AreaOption[];
  supervisors: SupervisorOption[];
  editing?: EditingEmployee;
  onDone?: () => void;
}

function fmt(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "7px 10px", borderRadius: 6,
  border: "1px solid var(--border)", fontSize: 13,
  background: "var(--surface)", color: "var(--text)",
  outline: "none", boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 500,
  color: "var(--text-2)", marginBottom: 3,
};

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
      <legend style={{
        fontSize: 11, fontWeight: 700, textTransform: "uppercase",
        letterSpacing: "0.06em", color: "var(--text-3)", marginBottom: 12,
        paddingBottom: 6, borderBottom: "1px solid var(--border)", width: "100%", display: "block",
      }}>
        {label}
      </legend>
      {children}
    </fieldset>
  );
}

const PHOTO_ACCEPT = ["image/jpeg", "image/png", "image/webp"];

export function EmployeeForm({ departments, positions, factoryAreas, supervisors, editing, onDone }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [photoPreview, setPhotoPreview] = useState<string | null>(editing?.photoUrl ?? null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  function handlePhotoFile(f: File) {
    if (!PHOTO_ACCEPT.includes(f.type)) {
      setPhotoError("Only JPEG, PNG, or WebP images are allowed.");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setPhotoError("Photo must be under 10 MB.");
      return;
    }
    setPhotoError(null);
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
    setPhotoRemoved(false);
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) handlePhotoFile(f);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setDragging(true);
  }

  function handleDragLeave() {
    setDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handlePhotoFile(f);
  }

  function handleRemovePhoto() {
    setPhotoPreview(null);
    setPhotoFile(null);
    setPhotoRemoved(true);
    if (photoInputRef.current) photoInputRef.current.value = "";
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFieldErrors({});
    setServerError(null);
    setPhotoError(null);
    const fd = new FormData(e.currentTarget);

    const ecName = fd.get("ec_name") as string;
    const ecPhone = fd.get("ec_phone") as string;
    const ecRelation = fd.get("ec_relation") as string;

    const payload: Record<string, unknown> = {
      nameKh: fd.get("nameKh"),
      nameZh: fd.get("nameZh") || null,
      nameEn: fd.get("nameEn"),
      employeeCode: fd.get("employeeCode") || null,
      gender: fd.get("gender") || null,
      birthday: fd.get("birthday") || null,
      nationality: fd.get("nationality") || "Cambodian",
      phone: fd.get("phone") || null,
      email: fd.get("email") || null,
      address: fd.get("address") || null,
      emergencyContact: (ecName || ecPhone || ecRelation)
        ? { name: ecName || undefined, phone: ecPhone || undefined, relation: ecRelation || undefined }
        : null,
      positionId: fd.get("positionId") ? Number(fd.get("positionId")) : null,
      factoryAreaId: fd.get("factoryAreaId") ? Number(fd.get("factoryAreaId")) : null,
      productionLine: fd.get("productionLine") || null,
      shift: fd.get("shift") || null,
      supervisorId: fd.get("supervisorId") ? Number(fd.get("supervisorId")) : null,
      departmentId: fd.get("departmentId") ? Number(fd.get("departmentId")) : null,
      dailyRateUsd: fd.get("dailyRateUsd"),
      hireDate: fd.get("hireDate"),
      contractExpiry: fd.get("contractExpiry") || null,
      probationEnd: fd.get("probationEnd") || null,
      status: fd.get("status") ?? "ACTIVE",
      note: fd.get("note") || null,
      // Clear photo if removed
      ...(photoRemoved && !photoFile ? { photoUrl: null } : {}),
    };

    startTransition(async () => {
      let empId: number | undefined = editing?.id;

      if (editing) {
        const res = await updateEmployee(editing.id, payload);
        if ("error" in res) {
          setServerError(res.error);
          setFieldErrors((res as { ok: false; error: string; fieldErrors?: Record<string, string[]> }).fieldErrors ?? {});
          return;
        }
      } else {
        const res = await createEmployee(payload);
        if ("error" in res) {
          setServerError(res.error);
          setFieldErrors((res as { ok: false; error: string; fieldErrors?: Record<string, string[]> }).fieldErrors ?? {});
          return;
        }
        if (res.ok) empId = res.data.id;
      }

      if (photoFile && empId) {
        setPhotoUploading(true);
        try {
          const pfd = new FormData();
          pfd.append("file", photoFile);
          pfd.append("employeeId", String(empId));
          const photoRes = await fetch("/api/upload/photo", { method: "POST", body: pfd });
          const photoJson = await photoRes.json() as { ok?: boolean; url?: string; error?: string };
          if (photoJson.url) {
            await updateEmployeePhoto(empId, photoJson.url);
          } else {
            setPhotoError(`Photo upload failed: ${photoJson.error ?? "Unknown error"}`);
            // Employee data was saved — still close and refresh so user doesn't lose their work
          }
        } catch (uploadErr) {
          setPhotoError(`Photo upload failed: ${uploadErr instanceof Error ? uploadErr.message : "Network error"}`);
        } finally {
          setPhotoUploading(false);
        }
      } else if (photoRemoved && empId && editing) {
        await updateEmployeePhoto(empId, null);
      }

      router.refresh();
      onDone?.();
    });
  }

  function Field({ name, label, children }: { name: string; label: string; children: React.ReactNode }) {
    return (
      <div>
        <label style={labelStyle}>{label}</label>
        {children}
        {fieldErrors[name] && (
          <p style={{ color: "var(--red)", fontSize: 11, marginTop: 2 }}>{fieldErrors[name].join(", ")}</p>
        )}
      </div>
    );
  }

  const ec = editing?.emergencyContact as { name?: string; phone?: string; relation?: string } | null | undefined;

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {serverError && (
        <div style={{ padding: "10px 14px", background: "var(--red-bg)", color: "var(--red)", borderRadius: 8, fontSize: 13 }}>
          {serverError}
        </div>
      )}

      {/* Photo — drag-and-drop */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
          {/* Drop zone / preview */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !photoUploading && photoInputRef.current?.click()}
            style={{
              width: 90, height: 90, borderRadius: 12, flexShrink: 0,
              background: dragging ? "var(--steel-light)" : "var(--surface-2)",
              border: `2px ${dragging ? "solid var(--steel)" : photoError ? "solid var(--red)" : "dashed var(--border)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: photoUploading ? "wait" : "pointer", overflow: "hidden",
              transition: "border-color 0.15s, background 0.15s", position: "relative",
            }}
          >
            {photoUploading ? (
              <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="var(--steel)" strokeWidth={2}
                style={{ animation: "spin 0.7s linear infinite" }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
            ) : photoPreview ? (
              <img src={photoPreview} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth={1.5}>
                <rect x="3" y="3" width="18" height="18" rx="3"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            )}
          </div>

          {/* Controls */}
          <div style={{ paddingTop: 4, flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 500, color: "var(--text)" }}>Employee Photo</p>
            <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
              Drag & drop or click to browse · JPEG / PNG / WebP · max 10 MB
            </p>
            <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={() => photoInputRef.current?.click()}
                disabled={photoUploading}
                style={{ fontSize: 12, color: "var(--steel)", cursor: photoUploading ? "wait" : "pointer", background: "none", border: "none", padding: 0, fontWeight: 500 }}>
                {photoUploading ? "Uploading…" : photoPreview ? "Change photo" : "Upload photo"}
              </button>
              {photoPreview && !photoUploading && (
                <button type="button" onClick={handleRemovePhoto}
                  style={{ fontSize: 12, color: "var(--red)", cursor: "pointer", background: "none", border: "none", padding: 0 }}>
                  Remove
                </button>
              )}
              {photoFile && !photoUploading && (
                <span style={{ fontSize: 11, color: "var(--text-3)" }}>
                  {photoFile.name} ({(photoFile.size / 1024 / 1024).toFixed(1)} MB)
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Photo-specific error */}
        {photoError && (
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 12px", borderRadius: 8,
            background: "var(--red-bg)", color: "var(--red)", fontSize: 12,
          }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {photoError}
          </div>
        )}
      </div>
      <style jsx>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <input ref={photoInputRef} type="file" accept="image/jpeg,image/png,image/webp"
        onChange={handlePhotoChange} style={{ display: "none" }} />

      {/* Identity */}
      <Section label="Identity">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field name="nameEn" label="Name (English) *">
            <input name="nameEn" required defaultValue={editing?.nameEn} style={inputStyle} placeholder="e.g. Sok Dara" />
          </Field>
          <Field name="nameKh" label="Name (Khmer) *">
            <input name="nameKh" required defaultValue={editing?.nameKh} style={inputStyle} placeholder="ស..." />
          </Field>
          <Field name="nameZh" label="Name (Chinese)">
            <input name="nameZh" defaultValue={editing?.nameZh ?? ""} style={inputStyle} placeholder="e.g. 阿明" />
          </Field>
          <Field name="employeeCode" label="Employee Code">
            <input name="employeeCode" defaultValue={editing?.employeeCode ?? ""} style={inputStyle} placeholder="EMP-001 (auto if blank)" />
          </Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 12 }}>
          <Field name="gender" label="Gender">
            <select name="gender" defaultValue={editing?.gender ?? ""} style={inputStyle}>
              <option value="">— Select —</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
          </Field>
          <Field name="birthday" label="Birthday">
            <input name="birthday" type="date" defaultValue={fmt(editing?.birthday)} style={inputStyle} />
          </Field>
          <Field name="nationality" label="Nationality">
            <input name="nationality" defaultValue={editing?.nationality ?? "Cambodian"} style={inputStyle} />
          </Field>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <Field name="phone" label="Phone">
            <input name="phone" type="tel" defaultValue={editing?.phone ?? ""} style={inputStyle} placeholder="+855 12 345 678" />
          </Field>
          <Field name="email" label="Email">
            <input name="email" type="email" defaultValue={editing?.email ?? ""} style={inputStyle} placeholder="name@example.com" />
          </Field>
        </div>
        <div style={{ marginTop: 12 }}>
          <Field name="address" label="Address">
            <textarea name="address" defaultValue={editing?.address ?? ""}
              style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} placeholder="Street, City, Province" />
          </Field>
        </div>
      </Section>

      {/* Emergency Contact */}
      <Section label="Emergency Contact">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Field name="ec_name" label="Contact Name">
            <input name="ec_name" defaultValue={ec?.name ?? ""} style={inputStyle} placeholder="Parent / Spouse" />
          </Field>
          <Field name="ec_phone" label="Contact Phone">
            <input name="ec_phone" defaultValue={ec?.phone ?? ""} style={inputStyle} placeholder="+855..." />
          </Field>
          <Field name="ec_relation" label="Relation">
            <input name="ec_relation" defaultValue={ec?.relation ?? ""} style={inputStyle} placeholder="Mother / Spouse" />
          </Field>
        </div>
      </Section>

      {/* Work Assignment */}
      <Section label="Work Assignment">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field name="departmentId" label="Department">
            <select name="departmentId" defaultValue={editing?.departmentId ?? ""} style={inputStyle}>
              <option value="">— None —</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field name="positionId" label="Position">
            <select name="positionId" defaultValue={editing?.positionId ?? ""} style={inputStyle}>
              <option value="">— None —</option>
              {positions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
          <Field name="factoryAreaId" label="Factory Area">
            <select name="factoryAreaId" defaultValue={editing?.factoryAreaId ?? ""} style={inputStyle}>
              <option value="">— None —</option>
              {factoryAreas.map(a => <option key={a.id} value={a.id}>[{a.code}] {a.name}</option>)}
            </select>
          </Field>
          <Field name="productionLine" label="Production Line">
            <input name="productionLine" defaultValue={editing?.productionLine ?? ""} style={inputStyle} placeholder="Line A / 甲线" />
          </Field>
          <Field name="shift" label="Shift">
            <select name="shift" defaultValue={editing?.shift ?? "DAY"} style={inputStyle}>
              <option value="DAY">Day</option>
              <option value="AFTERNOON">Afternoon</option>
              <option value="NIGHT">Night</option>
            </select>
          </Field>
          <Field name="supervisorId" label="Supervisor">
            <select name="supervisorId" defaultValue={editing?.supervisorId ?? ""} style={inputStyle}>
              <option value="">— None —</option>
              {supervisors
                .filter(s => !editing || s.id !== editing.id)
                .map(s => <option key={s.id} value={s.id}>{s.nameEn} / {s.nameKh}</option>)}
            </select>
          </Field>
        </div>
      </Section>

      {/* Employment */}
      <Section label="Employment">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          <Field name="hireDate" label="Hire Date *">
            <input name="hireDate" type="date" required
              defaultValue={fmt(editing?.hireDate ?? new Date().toISOString())} style={inputStyle} />
          </Field>
          <Field name="contractExpiry" label="Contract Expiry">
            <input name="contractExpiry" type="date" defaultValue={fmt(editing?.contractExpiry)} style={inputStyle} />
          </Field>
          <Field name="probationEnd" label="Probation End">
            <input name="probationEnd" type="date" defaultValue={fmt(editing?.probationEnd)} style={inputStyle} />
          </Field>
          <Field name="dailyRateUsd" label="Daily Rate (USD) *">
            <input name="dailyRateUsd" type="number" step="0.01" min="0" required
              defaultValue={editing?.dailyRateUsd ?? ""} style={inputStyle} placeholder="8.00" />
          </Field>
          <Field name="status" label="Status">
            <select name="status" defaultValue={editing?.status ?? "ACTIVE"} style={inputStyle}>
              <option value="ACTIVE">Active</option>
              <option value="TERMINATED">Terminated</option>
            </select>
          </Field>
        </div>
        <div style={{ marginTop: 12 }}>
          <Field name="note" label="Notes">
            <textarea name="note" defaultValue={editing?.note ?? ""}
              style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
              placeholder="Optional remarks..." />
          </Field>
        </div>
      </Section>

      {/* Buttons */}
      <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
        <button
          type="submit"
          disabled={pending}
          style={{
            padding: "9px 22px", borderRadius: 8,
            background: "var(--steel)", color: "#fff",
            border: "none", fontWeight: 600, fontSize: 13,
            cursor: pending ? "not-allowed" : "pointer",
            opacity: pending ? 0.7 : 1,
          }}
        >
          {pending ? "Saving…" : editing ? "Save changes" : "Create employee"}
        </button>
        {onDone && (
          <button
            type="button"
            onClick={onDone}
            style={{
              padding: "9px 20px", borderRadius: 8,
              background: "var(--surface-2)", color: "var(--text-2)",
              border: "1px solid var(--border)", fontSize: 13, cursor: "pointer",
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
