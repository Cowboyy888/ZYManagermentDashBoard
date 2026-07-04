"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createFactoryArea, updateFactoryArea, deleteFactoryArea } from "@/actions/factoryAreas";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

interface Area {
  id: number;
  name: string;
  code: string;
  description: string | null;
  employeeCount: number;
}

interface Props {
  areas: Area[];
  canEdit: boolean;
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 12px", borderRadius: 8,
  border: "1px solid var(--border)", fontSize: 13,
  background: "var(--surface)", color: "var(--text)",
  boxSizing: "border-box",
};

export function FactoryAreasClient({ areas, canEdit }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Area | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      name: fd.get("name") as string,
      code: (fd.get("code") as string).toUpperCase(),
      description: fd.get("description") as string || null,
    };

    start(async () => {
      const res = editing
        ? await updateFactoryArea(editing.id, payload)
        : await createFactoryArea(payload);
      if ('error' in res) { setError(res.error); return; }
      setShowForm(false);
      setEditing(null);
      router.refresh();
    });
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this factory area?")) return;
    start(async () => {
      const res = await deleteFactoryArea(id);
      if ('error' in res) { setError(res.error); return; }
      router.refresh();
    });
  }

  function startEdit(a: Area) {
    setEditing(a);
    setShowForm(true);
  }

  function cancelForm() {
    setShowForm(false);
    setEditing(null);
    setError(null);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {error && <Alert level="error" message={error} />}

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 12, padding: 20,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
              {editing ? "Edit Factory Area" : "New Factory Area"}
            </h3>
            <button type="button" onClick={cancelForm}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-3)", fontSize: 18 }}>✕</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 4 }}>Area Name *</label>
              <input name="name" required defaultValue={editing?.name} style={inputStyle} placeholder="e.g. Wire Drawing" />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 4 }}>Code *</label>
              <input name="code" required maxLength={10} defaultValue={editing?.code}
                style={{ ...inputStyle, textTransform: "uppercase" }} placeholder="e.g. WD" />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 4 }}>Description</label>
              <textarea name="description" defaultValue={editing?.description ?? ""}
                style={{ ...inputStyle, minHeight: 60, resize: "vertical" }} placeholder="Optional description" />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <Button type="submit" loading={pending}>
              {editing ? "Save" : "Create"}
            </Button>
            <Button type="button" variant="secondary" onClick={cancelForm}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* Header + Add button */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p style={{ fontSize: 13, color: "var(--text-3)" }}>{areas.length} areas defined</p>
        {canEdit && !showForm && (
          <Button onClick={() => { setEditing(null); setShowForm(true); }}>
            + Add Area
          </Button>
        )}
      </div>

      {/* Grid of area cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
        {areas.map(a => (
          <div key={a.id} style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 12, padding: 16,
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div style={{
                padding: "4px 10px", borderRadius: 6, fontSize: 13, fontWeight: 800,
                background: "var(--steel-light)", color: "var(--steel)",
                letterSpacing: "0.05em", marginBottom: 10,
              }}>
                {a.code}
              </div>
              {canEdit && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => startEdit(a)}
                    style={{ fontSize: 12, color: "var(--blue)", background: "none", border: "none", cursor: "pointer" }}>
                    Edit
                  </button>
                  <button onClick={() => handleDelete(a.id)}
                    style={{ fontSize: 12, color: "var(--red)", background: "none", border: "none", cursor: "pointer" }}>
                    Delete
                  </button>
                </div>
              )}
            </div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{a.name}</h3>
            {a.description && (
              <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 8 }}>{a.description}</p>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth={2}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              </svg>
              <span style={{ fontSize: 12, color: "var(--text-3)" }}>{a.employeeCount} employees</span>
            </div>
          </div>
        ))}
      </div>

      {areas.length === 0 && !showForm && (
        <div style={{
          borderRadius: 10, border: "1.5px dashed var(--border)",
          padding: "40px 24px", textAlign: "center",
          color: "var(--text-3)", fontSize: 14,
        }}>
          No factory areas defined yet. Add your first area.
        </div>
      )}
    </div>
  );
}
