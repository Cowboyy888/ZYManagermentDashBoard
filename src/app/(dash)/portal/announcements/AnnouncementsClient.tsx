"use client";
import { useState, useTransition } from "react";
import { createAnnouncement, deleteAnnouncement } from "@/actions/portal/announcements";
import { useRouter } from "next/navigation";

type Announcement = {
  id: number; title: string; body: string; targetType: string;
  publishedAt: Date | null; expiresAt: Date | null;
  createdBy: { name: string };
};

const TARGET_LABEL: Record<string, string> = { ALL: "All", CUSTOMERS: "Customers", SUPPLIERS: "Suppliers" };

export default function AnnouncementsClient({ announcements }: { announcements: Announcement[] }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", targetType: "ALL" as "ALL" | "CUSTOMERS" | "SUPPLIERS", publishedAt: "", expiresAt: "" });
  const [isPending, startTransition] = useTransition();

  function create() {
    startTransition(async () => {
      await createAnnouncement({
        title: form.title,
        body: form.body,
        targetType: form.targetType,
        publishedAt: form.publishedAt || undefined,
        expiresAt: form.expiresAt || undefined,
      });
      setShowForm(false);
      setForm({ title: "", body: "", targetType: "ALL", publishedAt: "", expiresAt: "" });
      router.refresh();
    });
  }

  function remove(id: number) {
    startTransition(async () => {
      await deleteAnnouncement(id);
      router.refresh();
    });
  }

  return (
    <div>
      <div style={{ marginBottom: "1rem" }}>
        <button onClick={() => setShowForm(!showForm)} className="btn">
          {showForm ? "Cancel" : "+ New Announcement"}
        </button>
      </div>

      {showForm && (
        <div className="panel" style={{ marginBottom: "1.5rem" }}>
          <div className="panel-head">New Announcement</div>
          <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 4 }}>Title</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={{ width: "100%", padding: "0.6rem", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 4 }}>Target</label>
                <select value={form.targetType} onChange={e => setForm(f => ({ ...f, targetType: e.target.value as "ALL" | "CUSTOMERS" | "SUPPLIERS" }))} style={{ width: "100%", padding: "0.6rem", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }}>
                  <option value="ALL">All</option>
                  <option value="CUSTOMERS">Customers Only</option>
                  <option value="SUPPLIERS">Suppliers Only</option>
                </select>
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 4 }}>Publish At</label>
                <input type="datetime-local" value={form.publishedAt} onChange={e => setForm(f => ({ ...f, publishedAt: e.target.value }))} style={{ width: "100%", padding: "0.6rem", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }} />
              </div>
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 4 }}>Expires At</label>
                <input type="datetime-local" value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} style={{ width: "100%", padding: "0.6rem", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }} />
              </div>
            </div>
            <div>
              <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 4 }}>Body</label>
              <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={4} style={{ width: "100%", padding: "0.6rem", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, boxSizing: "border-box", resize: "vertical" }} />
            </div>
            <button onClick={create} disabled={isPending || !form.title || !form.body} className="btn">Publish</button>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-body" style={{ padding: 0 }}>
          <table className="data-table" style={{ width: "100%" }}>
            <thead><tr><th>Title</th><th>Target</th><th>Published</th><th>Expires</th><th>By</th><th></th></tr></thead>
            <tbody>
              {announcements.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text-3)", padding: "2rem" }}>No announcements.</td></tr>
              )}
              {announcements.map(a => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 500 }}>{a.title}</td>
                  <td><span className="tag">{TARGET_LABEL[a.targetType]}</span></td>
                  <td>{a.publishedAt ? new Date(a.publishedAt).toLocaleDateString() : "—"}</td>
                  <td>{a.expiresAt ? new Date(a.expiresAt).toLocaleDateString() : "Never"}</td>
                  <td style={{ fontSize: 13, color: "var(--text-2)" }}>{a.createdBy.name}</td>
                  <td>
                    <button onClick={() => remove(a.id)} disabled={isPending} style={{ fontSize: 12, padding: "0.25rem 0.6rem", background: "var(--red-bg)", color: "var(--red)", border: "none", borderRadius: 6, cursor: "pointer" }}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
