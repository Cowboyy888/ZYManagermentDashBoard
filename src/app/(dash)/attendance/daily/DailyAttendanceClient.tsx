"use client";
import { useState, useMemo, useTransition, useEffect } from "react";
import {
  getDailyAttendance,
  saveDailyRecord,
  bulkSaveDailyAttendance,
  DAILY_STATUS_LABEL,
  type DailyAttendanceRow,
  type DailyStatusValue,
} from "@/actions/attendance";

// ── Constants ──────────────────────────────────────────────────

const BLOB_SUFFIX = ".blob.vercel-storage.com";
function resolvePhotoUrl(url: string) {
  return url.includes(BLOB_SUFFIX)
    ? `/api/employee-photo?url=${encodeURIComponent(url)}`
    : url;
}

const STATUS_LIST: DailyStatusValue[] = [
  "PRESENT", "LATE", "ABSENT", "SICK_LEAVE", "ANNUAL_LEAVE",
  "PERSONAL_LEAVE", "BUSINESS_TRIP", "WORK_FROM_HOME", "HALF_DAY", "HOLIDAY",
];

const STATUS_COLORS: Record<DailyStatusValue, { color: string; bg: string }> = {
  PRESENT:       { color: "var(--green)",  bg: "var(--green-bg)"  },
  LATE:          { color: "var(--amber)",  bg: "var(--amber-bg)"  },
  ABSENT:        { color: "var(--red)",    bg: "var(--red-bg)"    },
  SICK_LEAVE:    { color: "var(--red)",    bg: "var(--red-bg)"    },
  ANNUAL_LEAVE:  { color: "var(--amber)",  bg: "var(--amber-bg)"  },
  PERSONAL_LEAVE:{ color: "var(--amber)",  bg: "var(--amber-bg)"  },
  BUSINESS_TRIP: { color: "var(--steel)",  bg: "var(--steel-light)" },
  WORK_FROM_HOME:{ color: "var(--steel)",  bg: "var(--steel-light)" },
  HALF_DAY:      { color: "var(--amber)",  bg: "var(--amber-bg)"  },
  HOLIDAY:       { color: "var(--text-3)", bg: "var(--surface-2)" },
};

const SHIFT_OPTIONS = ["", "DAY", "AFTERNOON", "NIGHT"] as const;

// ── Types ──────────────────────────────────────────────────────

type RowEdit = {
  dailyStatus: DailyStatusValue;
  checkIn: string;
  checkOut: string;
  note: string;
  shiftType: string;
  dirty: boolean;
};

type Props = {
  departments: { id: number; name: string }[];
  positions:   { id: number; name: string }[];
  canWrite:    boolean;
  defaultDeptId: number | null;
};

// ── Calculation helpers ────────────────────────────────────────

function toDateTime(dateStr: string, timeStr: string): Date | null {
  if (!timeStr) return null;
  const d = new Date(`${dateStr}T${timeStr}:00`);
  return isNaN(d.getTime()) ? null : d;
}

function calcHours(dateStr: string, inTime: string, outTime: string): { working: number; overtime: number } | null {
  const ci = toDateTime(dateStr, inTime);
  const co = toDateTime(dateStr, outTime);
  if (!ci || !co || co <= ci) return null;
  const working = Math.max(0, Math.round(((co.getTime() - ci.getTime()) / 3_600_000) * 100) / 100);
  const otStart = new Date(co);
  otStart.setHours(17, 0, 0, 0);
  const overtime = co > otStart
    ? Math.round(((co.getTime() - otStart.getTime()) / 3_600_000) * 100) / 100
    : 0;
  return { working, overtime };
}

function calcLateMin(dateStr: string, checkInTime: string): number {
  if (!checkInTime) return 0;
  const ci = toDateTime(dateStr, checkInTime);
  if (!ci) return 0;
  const grace = new Date(`${dateStr}T08:15:00`);
  if (isNaN(grace.getTime()) || ci <= grace) return 0;
  return Math.round((ci.getTime() - grace.getTime()) / 60_000);
}

function timeFromISO(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ── Styles ─────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  height: 32, padding: "0 8px",
  border: "1px solid var(--border)", borderRadius: 6,
  background: "var(--surface)", color: "var(--text)", fontSize: 12,
};

const selectStyle: React.CSSProperties = {
  ...inputStyle, cursor: "pointer",
};

const thStyle: React.CSSProperties = {
  padding: "9px 12px", textAlign: "left", fontWeight: 600, fontSize: 11,
  textTransform: "uppercase", letterSpacing: "0.04em",
  color: "var(--text-3)", borderBottom: "1px solid var(--border)",
  whiteSpace: "nowrap", background: "var(--surface-2)",
};

// ── Main component ─────────────────────────────────────────────

export function DailyAttendanceClient({ departments, positions, canWrite, defaultDeptId }: Props) {
  const [date,    setDate]    = useState(todayStr());
  const [deptId,  setDeptId]  = useState<number | "">(defaultDeptId ?? "");
  const [posId,   setPosId]   = useState<number | "">("");
  const [shift,   setShift]   = useState("");
  const [status,  setStatus]  = useState<DailyStatusValue | "">("");
  const [search,  setSearch]  = useState("");

  const [rows,    setRows]    = useState<DailyAttendanceRow[]>([]);
  const [edits,   setEdits]   = useState<Map<number, RowEdit>>(new Map());
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loaded,  setLoaded]  = useState(false);
  const [loadErr, setLoadErr] = useState("");
  const [toast,   setToast]   = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const [saving,  setSaving]  = useState<Set<number>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);

  const [isPending, startTransition] = useTransition();

  // ── Derived ─────────────────────────────────────────────────

  const filteredRows = useMemo(() => {
    let r = rows;
    if (deptId)  r = r.filter(e => e.departmentId === Number(deptId));
    if (posId)   r = r.filter(e => e.positionId   === Number(posId));
    if (shift)   r = r.filter(e => e.shift === shift);
    if (status)  r = r.filter(e => {
      const edit = edits.get(e.employeeId);
      const s = edit ? edit.dailyStatus : e.dailyStatus;
      return s === status;
    });
    if (search) {
      const q = search.toLowerCase();
      r = r.filter(e =>
        e.nameEn.toLowerCase().includes(q) ||
        e.nameKh.includes(q) ||
        (e.employeeCode ?? "").toLowerCase().includes(q)
      );
    }
    return r;
  }, [rows, edits, deptId, posId, shift, status, search]);

  const stats = useMemo(() => {
    let present = 0, late = 0, absent = 0, onLeave = 0, otHours = 0;
    for (const r of rows) {
      const edit = edits.get(r.employeeId);
      const s = edit ? edit.dailyStatus : r.dailyStatus;
      if (s === "PRESENT") present++;
      else if (s === "LATE") late++;
      else if (s === "ABSENT") absent++;
      else if (s) onLeave++;
      const co = edit ? edit.checkOut : timeFromISO(r.checkOut);
      const ci = edit ? edit.checkIn  : timeFromISO(r.checkIn);
      if (ci && co) {
        const h = calcHours(date, ci, co);
        if (h) otHours += h.overtime;
      }
    }
    const recorded = present + late + absent + onLeave;
    const rate = rows.length > 0 ? Math.round(((present + late) / rows.length) * 100) : null;
    return { present, late, absent, onLeave, rate, otHours: Math.round(otHours * 10) / 10, recorded };
  }, [rows, edits, date]);

  const allSelected = filteredRows.length > 0 && filteredRows.every(r => selected.has(r.employeeId));

  // ── Helpers ──────────────────────────────────────────────────

  function showToast(type: "ok" | "err", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }

  function getEdit(row: DailyAttendanceRow): RowEdit {
    const e = edits.get(row.employeeId);
    if (e) return e;
    return {
      dailyStatus: (row.dailyStatus ?? "PRESENT") as DailyStatusValue,
      checkIn:     timeFromISO(row.checkIn),
      checkOut:    timeFromISO(row.checkOut),
      note:        row.note ?? "",
      shiftType:   row.shiftType ?? row.shift ?? "",
      dirty:       false,
    };
  }

  function setEdit(employeeId: number, patch: Partial<RowEdit>) {
    setEdits(prev => {
      const current = prev.get(employeeId) ?? getEdit(rows.find(r => r.employeeId === employeeId)!);
      const next = { ...current, ...patch, dirty: true };
      const m = new Map(prev);
      m.set(employeeId, next);
      return m;
    });
  }

  // ── Load ─────────────────────────────────────────────────────

  function load(targetDate?: string) {
    const d = targetDate ?? date;
    if (targetDate) setDate(targetDate);
    setLoadErr("");
    setEdits(new Map());
    setSelected(new Set());
    startTransition(async () => {
      const res = await getDailyAttendance({
        date: new Date(d + "T00:00:00"),
        departmentId: deptId ? Number(deptId) : undefined,
        positionId:   posId  ? Number(posId)  : undefined,
        statusFilter: "",
        search: "",
      });
      if (!res.ok) {
        setLoadErr("error" in res ? res.error : "Failed to load");
        setLoaded(true);
        return;
      }
      setRows(res.data);
      setLoaded(true);
    });
  }

  // Auto-load today on mount
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function prevDay() {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() - 1);
    load(d.toISOString().slice(0, 10));
  }

  function nextDay() {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + 1);
    load(d.toISOString().slice(0, 10));
  }

  // ── Save single ──────────────────────────────────────────────

  async function saveRow(row: DailyAttendanceRow) {
    const edit = getEdit(row);
    setSaving(s => new Set(s).add(row.employeeId));
    try {
      const res = await saveDailyRecord({
        employeeId:  row.employeeId,
        date:        new Date(date + "T00:00:00"),
        dailyStatus: edit.dailyStatus,
        checkIn:     edit.checkIn  ? `${date}T${edit.checkIn}:00`  : null,
        checkOut:    edit.checkOut ? `${date}T${edit.checkOut}:00` : null,
        shiftType:   edit.shiftType || null,
        note:        edit.note || null,
      });
      if (!res.ok) {
        showToast("err", "error" in res ? res.error : "Save failed");
      } else {
        setEdits(prev => {
          const m = new Map(prev);
          const cur = m.get(row.employeeId);
          if (cur) m.set(row.employeeId, { ...cur, dirty: false });
          return m;
        });
        setRows(prev => prev.map(r =>
          r.employeeId === row.employeeId
            ? {
                ...r,
                recordId:    res.data?.id ?? r.recordId,
                dailyStatus: edit.dailyStatus,
                checkIn:     edit.checkIn  ? new Date(`${date}T${edit.checkIn}:00`).toISOString()  : null,
                checkOut:    edit.checkOut ? new Date(`${date}T${edit.checkOut}:00`).toISOString() : null,
                shiftType:   edit.shiftType || null,
                note:        edit.note || null,
              }
            : r
        ));
        showToast("ok", `Saved: ${row.nameEn}`);
      }
    } finally {
      setSaving(s => { const n = new Set(s); n.delete(row.employeeId); return n; });
    }
  }

  // ── Bulk mark ────────────────────────────────────────────────

  function markAll(statusValue: DailyStatusValue) {
    const targets = selected.size > 0
      ? filteredRows.filter(r => selected.has(r.employeeId))
      : filteredRows;
    setEdits(prev => {
      const m = new Map(prev);
      for (const r of targets) {
        const cur = prev.get(r.employeeId) ?? getEdit(r);
        m.set(r.employeeId, { ...cur, dailyStatus: statusValue, dirty: true });
      }
      return m;
    });
  }

  // ── Bulk save ────────────────────────────────────────────────

  async function bulkSave() {
    const targets = selected.size > 0
      ? filteredRows.filter(r => selected.has(r.employeeId))
      : filteredRows;

    setBulkSaving(true);
    try {
      const payload = targets.map(r => {
        const edit = getEdit(r);
        return {
          employeeId:  r.employeeId,
          date:        new Date(date + "T00:00:00"),
          dailyStatus: edit.dailyStatus,
          checkIn:     edit.checkIn  ? `${date}T${edit.checkIn}:00`  : null,
          checkOut:    edit.checkOut ? `${date}T${edit.checkOut}:00` : null,
          shiftType:   edit.shiftType || null,
          note:        edit.note || null,
        };
      });

      const res = await bulkSaveDailyAttendance({ rows: payload });
      if (!res.ok) {
        showToast("err", "error" in res ? res.error : "Bulk save failed");
      } else {
        setEdits(prev => {
          const m = new Map(prev);
          for (const r of targets) {
            const cur = m.get(r.employeeId);
            if (cur) m.set(r.employeeId, { ...cur, dirty: false });
          }
          return m;
        });
        setRows(prev => prev.map(r => {
          const target = targets.find(t => t.employeeId === r.employeeId);
          if (!target) return r;
          const edit = getEdit(r);
          return {
            ...r,
            dailyStatus: edit.dailyStatus,
            checkIn:     edit.checkIn  ? new Date(`${date}T${edit.checkIn}:00`).toISOString()  : null,
            checkOut:    edit.checkOut ? new Date(`${date}T${edit.checkOut}:00`).toISOString() : null,
            shiftType:   edit.shiftType || null,
            note:        edit.note || null,
          };
        }));
        const count = "data" in res && res.data ? res.data.count : targets.length;
        showToast("ok", `Saved ${count} records`);
      }
    } finally {
      setBulkSaving(false);
    }
  }

  // ── Export ───────────────────────────────────────────────────

  async function handleExport(fmt: "excel" | "pdf") {
    const { exportToExcel, exportToPDF } = await import("@/lib/export");
    const data = filteredRows.map(r => {
      const edit = edits.get(r.employeeId);
      const s = edit ? edit.dailyStatus : r.dailyStatus;
      const ci = edit ? edit.checkIn  : timeFromISO(r.checkIn);
      const co = edit ? edit.checkOut : timeFromISO(r.checkOut);
      const hrs = ci && co ? calcHours(date, ci, co) : null;
      return {
        id:         r.employeeCode ?? r.employeeId,
        name:       r.nameEn,
        nameKh:     r.nameKh,
        department: r.departmentName ?? "—",
        position:   r.positionName   ?? "—",
        shift:      r.shift           ?? "—",
        status:     s ? DAILY_STATUS_LABEL[s] : "—",
        checkIn:    ci || "—",
        checkOut:   co || "—",
        working:    hrs ? `${hrs.working}h` : "—",
        overtime:   hrs ? `${hrs.overtime}h` : "—",
        note:       (edit ? edit.note : r.note) ?? "",
      };
    });
    const cols = [
      { header: "Employee ID",     key: "id",         width: 12 },
      { header: "Name (EN)",       key: "name",       width: 22 },
      { header: "Name (KH)",       key: "nameKh",     width: 22 },
      { header: "Department",      key: "department", width: 18 },
      { header: "Position",        key: "position",   width: 18 },
      { header: "Shift",           key: "shift",      width: 12 },
      { header: "Status",          key: "status",     width: 16 },
      { header: "Check-in",        key: "checkIn",    width: 10 },
      { header: "Check-out",       key: "checkOut",   width: 10 },
      { header: "Working Hrs",     key: "working",    width: 12 },
      { header: "Overtime Hrs",    key: "overtime",   width: 12 },
      { header: "Remarks",         key: "note",       width: 24 },
    ];
    const fn = `daily-attendance-${date}`;
    if (fmt === "excel") {
      await exportToExcel(data, cols, fn);
    } else {
      await exportToPDF(`ZY Steel — Daily Attendance`, `Date: ${date}`, data, cols, fn);
    }
  }

  // ── Selection ────────────────────────────────────────────────

  function toggleSelect(id: number) {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredRows.map(r => r.employeeId)));
    }
  }

  // ── Render ───────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* ── Toast ── */}
      {toast && (
        <div style={{
          position: "fixed", top: 20, right: 20, zIndex: 1000,
          padding: "12px 20px", borderRadius: 10, fontSize: 13, fontWeight: 600,
          background: toast.type === "ok" ? "var(--green-bg)" : "var(--red-bg)",
          color: toast.type === "ok" ? "var(--green)" : "var(--red)",
          border: `1px solid ${toast.type === "ok" ? "var(--green)" : "var(--red)"}`,
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
        }}>
          {toast.msg}
        </div>
      )}

      {/* ── Filter bar ── */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end",
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 12, padding: 16,
      }}>
        <Field label="Date">
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              onClick={prevDay}
              disabled={isPending}
              title="Previous day"
              style={{
                height: 32, width: 28, borderRadius: 6, border: "1px solid var(--border)",
                background: "var(--surface)", color: "var(--text-2)", cursor: "pointer",
                fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >‹</button>
            <input
              type="date"
              value={date}
              onChange={e => { if (e.target.value) load(e.target.value); }}
              style={{ ...inputStyle, width: 140 }}
            />
            <button
              onClick={nextDay}
              disabled={isPending}
              title="Next day"
              style={{
                height: 32, width: 28, borderRadius: 6, border: "1px solid var(--border)",
                background: "var(--surface)", color: "var(--text-2)", cursor: "pointer",
                fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >›</button>
            <button
              onClick={() => load(todayStr())}
              disabled={isPending || date === todayStr()}
              style={{
                height: 32, padding: "0 10px", borderRadius: 6, border: "1px solid var(--border)",
                background: "var(--surface)", color: "var(--steel)", cursor: "pointer",
                fontSize: 11, fontWeight: 600,
                opacity: date === todayStr() ? 0.45 : 1,
              }}
            >Today</button>
          </div>
        </Field>
        {departments.length > 0 && (
          <Field label="Department">
            <select value={deptId} onChange={e => { setDeptId(e.target.value ? Number(e.target.value) : ""); setLoaded(false); }} style={{ ...selectStyle, width: 160 }}>
              <option value="">All</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
        )}
        <Field label="Position">
          <select value={posId} onChange={e => { setPosId(e.target.value ? Number(e.target.value) : ""); }} style={{ ...selectStyle, width: 140 }}>
            <option value="">All</option>
            {positions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Shift">
          <select value={shift} onChange={e => setShift(e.target.value)} style={{ ...selectStyle, width: 120 }}>
            <option value="">All</option>
            <option value="DAY">Day</option>
            <option value="AFTERNOON">Afternoon</option>
            <option value="NIGHT">Night</option>
          </select>
        </Field>
        <Field label="Status">
          <select value={status} onChange={e => setStatus(e.target.value as DailyStatusValue | "")} style={{ ...selectStyle, width: 150 }}>
            <option value="">All</option>
            {STATUS_LIST.map(s => (
              <option key={s} value={s}>{DAILY_STATUS_LABEL[s]}</option>
            ))}
          </select>
        </Field>
        <Field label="Search">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Name or ID…"
            style={{ ...inputStyle, width: 160 }}
          />
        </Field>
        <button onClick={() => load()} disabled={isPending} className="btn btn-primary" style={{ alignSelf: "flex-end" }}>
          {isPending ? <><span className="spinner" />Loading…</> : "Reload"}
        </button>
      </div>

      {/* ── Not loaded placeholder ── */}
      {!loaded && (
        <div style={{
          borderRadius: 12, border: "1.5px dashed var(--border)",
          background: "var(--surface)", padding: "48px 24px",
          textAlign: "center", fontSize: 13, color: "var(--text-3)",
        }}>
          {isPending ? `Loading attendance for ${date}…` : "Use the date picker above to load attendance records."}
        </div>
      )}

      {/* ── Loaded content ── */}
      {loaded && (
        <>
          {loadErr && (
            <div style={{ padding: "10px 16px", borderRadius: 8, background: "var(--red-bg)", color: "var(--red)", fontSize: 13 }}>
              {loadErr}
            </div>
          )}

          {/* ── Stats bar ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 10 }}>
            {[
              { label: "Total",          value: rows.length,                    color: "var(--text)",   bg: "var(--surface-2)" },
              { label: "Present",        value: stats.present,                  color: "var(--green)",  bg: "var(--green-bg)"  },
              { label: "Late",           value: stats.late,                     color: "var(--amber)",  bg: "var(--amber-bg)"  },
              { label: "Absent",         value: stats.absent,                   color: "var(--red)",    bg: "var(--red-bg)"    },
              { label: "On Leave",       value: stats.onLeave,                  color: "var(--amber)",  bg: "var(--amber-bg)"  },
              { label: "Rate",           value: stats.rate !== null ? `${stats.rate}%` : "—", color: "var(--steel)", bg: "var(--steel-light)" },
              { label: "OT Hours",       value: `${stats.otHours}h`,            color: "var(--text-2)", bg: "var(--surface-2)" },
            ].map(({ label, value, color, bg }) => (
              <div key={label} style={{
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: 10, padding: "10px 14px",
              }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
              </div>
            ))}
          </div>

          {/* ── No-records banner ── */}
          {rows.length > 0 && stats.recorded === 0 && (
            <div style={{
              padding: "10px 16px", borderRadius: 8, fontSize: 13,
              background: "var(--amber-bg)", color: "var(--amber)",
              border: "1px solid var(--amber)",
            }}>
              No attendance records yet for {date}. All active employees are listed below — mark their attendance and save.
            </div>
          )}

          {/* ── Bulk action toolbar ── */}
          {canWrite && (
            <div style={{
              display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center",
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 10, padding: "10px 14px",
            }}>
              <span style={{ fontSize: 12, color: "var(--text-3)", marginRight: 4 }}>
                Bulk ({selected.size > 0 ? `${selected.size} selected` : "all visible"}):
              </span>
              {[
                { label: "Mark Present",  status: "PRESENT"  as DailyStatusValue },
                { label: "Mark Absent",   status: "ABSENT"   as DailyStatusValue },
                { label: "Mark Holiday",  status: "HOLIDAY"  as DailyStatusValue },
              ].map(({ label, status: s }) => (
                <button
                  key={s}
                  onClick={() => markAll(s)}
                  style={{
                    padding: "5px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer",
                    border: "1px solid var(--border)", background: "var(--surface)",
                    color: "var(--text-2)", fontWeight: 500,
                  }}
                >
                  {label}
                </button>
              ))}
              <div style={{ flex: 1 }} />
              <ExportDropdown onExcel={() => handleExport("excel")} onPDF={() => handleExport("pdf")} />
              <button
                onClick={bulkSave}
                disabled={bulkSaving}
                className="btn btn-primary"
                style={{ fontSize: 12 }}
              >
                {bulkSaving ? <><span className="spinner" />Saving…</> : "Save All"}
              </button>
            </div>
          )}

          {/* ── Table ── */}
          <AttendanceTable
            rows={filteredRows}
            edits={edits}
            selected={selected}
            allSelected={allSelected}
            date={date}
            canWrite={canWrite}
            saving={saving}
            onToggleSelect={toggleSelect}
            onToggleAll={toggleAll}
            onEdit={setEdit}
            onSave={saveRow}
            getEdit={getEdit}
          />
        </>
      )}
    </div>
  );
}

// ── Field wrapper ──────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

// ── Export dropdown ────────────────────────────────────────────

function ExportDropdown({ onExcel, onPDF }: { onExcel: () => void; onPDF: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          padding: "5px 12px", borderRadius: 6, fontSize: 12, cursor: "pointer",
          border: "1px solid var(--border)", background: "var(--surface)",
          color: "var(--text-2)", fontWeight: 500,
        }}
      >
        Export ▾
      </button>
      {open && (
        <div
          onMouseLeave={() => setOpen(false)}
          style={{
            position: "absolute", bottom: "calc(100% + 4px)", right: 0, zIndex: 20,
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            minWidth: 140, overflow: "hidden",
          }}
        >
          {[
            { label: "Excel (.xlsx)", action: onExcel },
            { label: "PDF (.pdf)",    action: onPDF   },
          ].map(item => (
            <button
              key={item.label}
              onClick={() => { setOpen(false); item.action(); }}
              style={{
                display: "block", width: "100%", padding: "9px 14px",
                textAlign: "left", border: "none", background: "none",
                fontSize: 13, color: "var(--text)", cursor: "pointer",
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Attendance table ───────────────────────────────────────────

type TableProps = {
  rows:           DailyAttendanceRow[];
  edits:          Map<number, RowEdit>;
  selected:       Set<number>;
  allSelected:    boolean;
  date:           string;
  canWrite:       boolean;
  saving:         Set<number>;
  onToggleSelect: (id: number) => void;
  onToggleAll:    () => void;
  onEdit:         (id: number, patch: Partial<RowEdit>) => void;
  onSave:         (row: DailyAttendanceRow) => void;
  getEdit:        (row: DailyAttendanceRow) => RowEdit;
};

function AttendanceTable({
  rows, edits, selected, allSelected, date, canWrite, saving,
  onToggleSelect, onToggleAll, onEdit, onSave, getEdit,
}: TableProps) {
  if (rows.length === 0) {
    return (
      <div style={{
        borderRadius: 10, border: "1.5px dashed var(--border)",
        padding: "40px 24px", textAlign: "center", color: "var(--text-3)", fontSize: 14,
      }}>
        No employees match the current filters.
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid var(--border)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr>
            {canWrite && (
              <th style={{ ...thStyle, width: 40, textAlign: "center" }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleAll}
                  style={{ cursor: "pointer" }}
                />
              </th>
            )}
            <th style={{ ...thStyle, width: 56 }}>Photo</th>
            <th style={thStyle}>ID</th>
            <th style={thStyle}>Employee</th>
            <th style={thStyle}>Department</th>
            <th style={thStyle}>Position</th>
            <th style={{ ...thStyle, width: 90 }}>Shift</th>
            <th style={{ ...thStyle, width: 160 }}>Status</th>
            <th style={{ ...thStyle, width: 90 }}>Check-in</th>
            <th style={{ ...thStyle, width: 90 }}>Check-out</th>
            <th style={{ ...thStyle, width: 80, textAlign: "center" }}>Work Hrs</th>
            <th style={{ ...thStyle, width: 80, textAlign: "center" }}>OT Hrs</th>
            <th style={{ ...thStyle, width: 70, textAlign: "center" }}>Late Min</th>
            <th style={{ ...thStyle, width: 180 }}>Remarks</th>
            {canWrite && <th style={{ ...thStyle, width: 70, textAlign: "center" }}>Save</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <AttendanceRow
              key={row.employeeId}
              row={row}
              edit={getEdit(row)}
              isDirty={edits.get(row.employeeId)?.dirty ?? false}
              isSelected={selected.has(row.employeeId)}
              date={date}
              canWrite={canWrite}
              isSaving={saving.has(row.employeeId)}
              onToggleSelect={() => onToggleSelect(row.employeeId)}
              onEdit={patch => onEdit(row.employeeId, patch)}
              onSave={() => onSave(row)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Single attendance row ──────────────────────────────────────

type RowProps = {
  row:            DailyAttendanceRow;
  edit:           RowEdit;
  isDirty:        boolean;
  isSelected:     boolean;
  date:           string;
  canWrite:       boolean;
  isSaving:       boolean;
  onToggleSelect: () => void;
  onEdit:         (patch: Partial<RowEdit>) => void;
  onSave:         () => void;
};

function AttendanceRow({ row, edit, isDirty, isSelected, date, canWrite, isSaving, onToggleSelect, onEdit, onSave }: RowProps) {
  const statusInfo = edit.dailyStatus ? STATUS_COLORS[edit.dailyStatus] : null;
  const checkOutErr = edit.checkIn && edit.checkOut && edit.checkOut <= edit.checkIn
    ? "Must be after check-in"
    : null;
  const hrs = edit.checkIn && edit.checkOut && !checkOutErr ? calcHours(date, edit.checkIn, edit.checkOut) : null;
  const lateMin = edit.checkIn ? calcLateMin(date, edit.checkIn) : 0;

  const tdStyle: React.CSSProperties = {
    padding: "8px 12px",
    borderBottom: "1px solid var(--border)",
    verticalAlign: "middle",
    background: isDirty ? "rgba(var(--amber-rgb, 245,158,11), 0.04)" : undefined,
  };

  return (
    <tr style={{ transition: "background 0.15s" }}>
      {canWrite && (
        <td style={{ ...tdStyle, textAlign: "center" }}>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            style={{ cursor: "pointer" }}
          />
        </td>
      )}

      {/* Photo */}
      <td style={{ ...tdStyle, width: 56 }}>
        {row.photoUrl ? (
          <img
            src={resolvePhotoUrl(row.photoUrl)}
            alt={row.nameEn}
            style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }}
          />
        ) : (
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "var(--surface-2)", display: "flex",
            alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 700, color: "var(--text-3)",
          }}>
            {row.nameEn.charAt(0).toUpperCase()}
          </div>
        )}
      </td>

      {/* ID */}
      <td style={{ ...tdStyle, color: "var(--text-3)" }}>
        {row.employeeCode ?? row.employeeId}
      </td>

      {/* Name */}
      <td style={tdStyle}>
        <div style={{ fontWeight: 600, color: "var(--text)" }}>{row.nameEn}</div>
        <div style={{ fontSize: 11, color: "var(--text-3)" }}>{row.nameKh}</div>
      </td>

      {/* Department */}
      <td style={{ ...tdStyle, color: "var(--text-2)" }}>
        {row.departmentName ?? "—"}
      </td>

      {/* Position */}
      <td style={{ ...tdStyle, color: "var(--text-2)" }}>
        {row.positionName ?? "—"}
      </td>

      {/* Shift */}
      <td style={tdStyle}>
        {canWrite ? (
          <select
            value={edit.shiftType}
            onChange={e => onEdit({ shiftType: e.target.value })}
            style={{ ...selectStyle, width: 86 }}
          >
            <option value="">—</option>
            <option value="DAY">Day</option>
            <option value="AFTERNOON">Afternoon</option>
            <option value="NIGHT">Night</option>
          </select>
        ) : (
          <span style={{ color: "var(--text-2)" }}>{row.shift ?? "—"}</span>
        )}
      </td>

      {/* Status */}
      <td style={tdStyle}>
        {canWrite ? (
          <select
            value={edit.dailyStatus}
            onChange={e => onEdit({ dailyStatus: e.target.value as DailyStatusValue })}
            style={{ ...selectStyle, width: 156 }}
          >
            {STATUS_LIST.map(s => (
              <option key={s} value={s}>{DAILY_STATUS_LABEL[s]}</option>
            ))}
          </select>
        ) : (
          statusInfo && edit.dailyStatus ? (
            <span style={{
              display: "inline-block", padding: "3px 10px", borderRadius: 20,
              fontSize: 11, fontWeight: 700,
              color: statusInfo.color, background: statusInfo.bg,
            }}>
              {DAILY_STATUS_LABEL[edit.dailyStatus]}
            </span>
          ) : <span style={{ color: "var(--text-3)" }}>—</span>
        )}
      </td>

      {/* Check-in */}
      <td style={tdStyle}>
        {canWrite ? (
          <input
            type="time"
            value={edit.checkIn}
            onChange={e => onEdit({ checkIn: e.target.value })}
            style={{ ...inputStyle, width: 86 }}
          />
        ) : (
          <span style={{ color: "var(--text-2)" }}>{edit.checkIn || "—"}</span>
        )}
      </td>

      {/* Check-out */}
      <td style={tdStyle}>
        {canWrite ? (
          <div>
            <input
              type="time"
              value={edit.checkOut}
              onChange={e => onEdit({ checkOut: e.target.value })}
              style={{ ...inputStyle, width: 86, borderColor: checkOutErr ? "var(--red)" : undefined }}
            />
            {checkOutErr && (
              <div style={{ fontSize: 10, color: "var(--red)", marginTop: 2, width: 86 }}>{checkOutErr}</div>
            )}
          </div>
        ) : (
          <span style={{ color: "var(--text-2)" }}>{edit.checkOut || "—"}</span>
        )}
      </td>

      {/* Working hours */}
      <td style={{ ...tdStyle, textAlign: "center" }}>
        <span style={{ color: hrs ? "var(--green)" : "var(--text-3)", fontWeight: 600 }}>
          {hrs ? `${hrs.working}h` : "—"}
        </span>
      </td>

      {/* Overtime hours */}
      <td style={{ ...tdStyle, textAlign: "center" }}>
        <span style={{ color: hrs && hrs.overtime > 0 ? "var(--amber)" : "var(--text-3)", fontWeight: 600 }}>
          {hrs ? `${hrs.overtime}h` : "—"}
        </span>
      </td>

      {/* Late minutes */}
      <td style={{ ...tdStyle, textAlign: "center" }}>
        <span style={{ color: lateMin > 0 ? "var(--red)" : "var(--text-3)", fontWeight: 600 }}>
          {edit.checkIn ? (lateMin > 0 ? `${lateMin}m` : "—") : "—"}
        </span>
      </td>

      {/* Remarks */}
      <td style={tdStyle}>
        {canWrite ? (
          <input
            value={edit.note}
            onChange={e => onEdit({ note: e.target.value })}
            placeholder="Remarks…"
            maxLength={300}
            style={{ ...inputStyle, width: "100%" }}
          />
        ) : (
          <span style={{ color: "var(--text-2)" }}>{edit.note || "—"}</span>
        )}
      </td>

      {/* Save button */}
      {canWrite && (
        <td style={{ ...tdStyle, textAlign: "center" }}>
          <button
            onClick={onSave}
            disabled={isSaving || !isDirty}
            style={{
              padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
              cursor: isSaving || !isDirty ? "default" : "pointer",
              border: "1px solid var(--border)",
              background: isDirty ? "var(--steel)" : "var(--surface-2)",
              color: isDirty ? "#fff" : "var(--text-3)",
              opacity: isSaving ? 0.6 : 1,
              transition: "background 0.15s",
            }}
          >
            {isSaving ? "…" : "Save"}
          </button>
        </td>
      )}
    </tr>
  );
}
