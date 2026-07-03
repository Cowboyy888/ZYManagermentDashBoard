"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createUser, updateUserRole, resetUserPassword, setUserActive } from "@/actions/users";
import type { UserRow } from "@/actions/users";

const ROLES = ["OWNER", "HR_MANAGER", "SUPERVISOR", "VIEWER"] as const;
const ROLE_STYLE: Record<string, React.CSSProperties> = {
  OWNER:      { color: "#7c3aed", background: "#f5f3ff" },
  HR_MANAGER: { color: "var(--steel)", background: "var(--surface-2)" },
  SUPERVISOR: { color: "var(--amber)", background: "var(--amber-bg)" },
  VIEWER:     { color: "var(--text-3)", background: "var(--surface-2)" },
};

interface Props {
  users: UserRow[];
  departments: { id: number; name: string }[];
  actorId: string;
}

type FormState = { name: string; email: string; role: typeof ROLES[number]; departmentId: string };
const emptyForm: FormState = { name: "", email: "", role: "VIEWER", departmentId: "" };

export function UsersManager({ users, departments, actorId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [tempCredential, setTempCredential] = useState<{ email: string; password: string } | null>(null);
  const [actionPending, setActionPending] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<{ userId: string; role: string; departmentId: string } | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    startTransition(async () => {
      const res = await createUser({
        name: form.name,
        email: form.email,
        role: form.role,
        departmentId: form.departmentId ? Number(form.departmentId) : null,
      });
      if (res.ok) {
        setTempCredential({ email: form.email, password: res.data.tempPassword });
        setForm(emptyForm);
        setShowForm(false);
        router.refresh();
      } else {
        setMsg({ ok: false, text: "error" in res ? res.error : "Error" });
      }
    });
  }

  async function handleRoleUpdate() {
    if (!editingRole) return;
    setMsg(null);
    const res = await updateUserRole({
      userId: editingRole.userId,
      role: editingRole.role,
      departmentId: editingRole.departmentId ? Number(editingRole.departmentId) : null,
    });
    if (res.ok) { setEditingRole(null); router.refresh(); }
    else { setMsg({ ok: false, text: "error" in res ? res.error : "Error" }); }
  }

  async function handleReset(userId: string) {
    setMsg(null);
    setActionPending(`reset-${userId}`);
    const res = await resetUserPassword(userId);
    setActionPending(null);
    if (res.ok) {
      const user = users.find((u) => u.id === userId);
      setTempCredential({ email: user?.email ?? "", password: res.data.tempPassword });
      router.refresh();
    } else {
      setMsg({ ok: false, text: "error" in res ? res.error : "Error" });
    }
  }

  async function handleToggleActive(userId: string, active: boolean) {
    setMsg(null);
    setActionPending(`active-${userId}`);
    const res = await setUserActive(userId, active);
    setActionPending(null);
    if (res.ok) { router.refresh(); }
    else { setMsg({ ok: false, text: "error" in res ? res.error : "Error" }); }
  }

  const needsDept = (role: string) => role === "SUPERVISOR";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
        {ROLES.map((r) => {
          const count = users.filter((u) => u.role === r).length;
          return (
            <div key={r} className="kpi-card">
              <div style={{ fontSize: 11.5, color: "var(--text-3)", fontWeight: 500, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>{r.replace("_", " ")}</div>
              <div style={{ fontSize: 26, fontWeight: 800, ...ROLE_STYLE[r] }}>{count}</div>
            </div>
          );
        })}
      </div>

      {/* Temp credential banner */}
      {tempCredential && (
        <div style={{ padding: "16px 20px", borderRadius: 10, background: "#fef3c7", border: "1px solid #f59e0b", display: "flex", gap: 16, alignItems: "flex-start" }}>
          <div style={{ fontSize: 22, flexShrink: 0 }}>🔑</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: "#92400e", marginBottom: 4 }}>Share these credentials — they will not be shown again</div>
            <div style={{ fontSize: 13, color: "#78350f", fontFamily: "monospace", lineHeight: 1.8 }}>
              Email: <strong>{tempCredential.email}</strong><br />
              Password: <strong>{tempCredential.password}</strong>
            </div>
            <div style={{ fontSize: 11.5, color: "#92400e", marginTop: 6 }}>The user should change their password immediately after first login.</div>
          </div>
          <button onClick={() => setTempCredential(null)} style={{ border: "none", background: "none", cursor: "pointer", fontSize: 18, color: "#92400e", padding: 0, lineHeight: 1 }}>✕</button>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 10 }}>
        <button className="btn btn-primary" onClick={() => { setShowForm((v) => !v); setMsg(null); }}>
          {showForm ? "Cancel" : "+ Create User"}
        </button>
      </div>

      {msg && (
        <div style={{ padding: "10px 14px", borderRadius: 8, fontSize: 13, background: msg.ok ? "var(--green-bg)" : "var(--red-bg)", color: msg.ok ? "var(--green)" : "var(--red)" }}>
          {msg.text}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <div className="panel">
          <div className="panel-head"><span className="panel-title">New System User</span></div>
          <form onSubmit={handleCreate} className="panel-body">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Full Name</label>
                <input className="form-input" required placeholder="Sokha Chan" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Email</label>
                <input type="email" className="form-input" required placeholder="sokha@zysteel.local" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Role</label>
                <select className="form-select" required value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as typeof ROLES[number] }))}>
                  {ROLES.map((r) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
                </select>
              </div>
              {needsDept(form.role) && (
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 500, color: "var(--text-2)", marginBottom: 5 }}>Department <span style={{ color: "var(--red)" }}>*</span></label>
                  <select className="form-select" required value={form.departmentId} onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))}>
                    <option value="">Select department…</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-3)" }}>
              A temporary password will be generated. Share it securely with the user.
            </div>
            <div style={{ marginTop: 14, display: "flex", gap: 10 }}>
              <button type="submit" className="btn btn-primary" disabled={isPending}>
                {isPending ? <><span className="spinner" /> Creating…</> : "Create User"}
              </button>
              <button type="button" className="btn" onClick={() => { setShowForm(false); setForm(emptyForm); }}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Users table */}
      <div className="panel">
        <div className="panel-head">
          <span className="panel-title">All Users</span>
          <span style={{ fontSize: 12, color: "var(--text-3)" }}>{users.length} accounts · {users.filter((u) => !u.active).length} disabled</span>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Status</th><th>Created</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const isMe = u.id === actorId;
                const isEditing = editingRole?.userId === u.id;
                return (
                  <tr key={u.id} style={{ opacity: u.active ? 1 : 0.5 }}>
                    <td>
                      <div style={{ fontWeight: 500, fontSize: 13.5 }}>{u.name}</div>
                      {isMe && <div style={{ fontSize: 11, color: "var(--steel)", fontWeight: 600 }}>YOU</div>}
                    </td>
                    <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{u.email}</td>
                    <td>
                      {isEditing ? (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <select
                            className="form-select"
                            style={{ width: "auto", height: 28, fontSize: 12 }}
                            value={editingRole.role}
                            onChange={(e) => setEditingRole((er) => er ? { ...er, role: e.target.value } : null)}
                          >
                            {ROLES.map((r) => <option key={r} value={r}>{r.replace("_", " ")}</option>)}
                          </select>
                          {needsDept(editingRole.role) && (
                            <select
                              className="form-select"
                              style={{ width: "auto", height: 28, fontSize: 12 }}
                              value={editingRole.departmentId}
                              onChange={(e) => setEditingRole((er) => er ? { ...er, departmentId: e.target.value } : null)}
                            >
                              <option value="">Dept…</option>
                              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                          )}
                          <button className="btn btn-primary" style={{ height: 28, padding: "0 10px", fontSize: 12 }} onClick={handleRoleUpdate}>Save</button>
                          <button className="btn" style={{ height: 28, padding: "0 8px", fontSize: 12 }} onClick={() => setEditingRole(null)}>✕</button>
                        </div>
                      ) : (
                        <span className="tag" style={{ ...ROLE_STYLE[u.role], cursor: isMe ? "default" : "pointer" }}
                          onClick={() => !isMe && setEditingRole({ userId: u.id, role: u.role, departmentId: u.departmentId?.toString() ?? "" })}
                          title={isMe ? undefined : "Click to change role"}
                        >
                          {u.role.replace("_", " ")}
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: 12.5, color: "var(--text-2)" }}>{u.departmentName ?? "—"}</td>
                    <td>
                      <span className="tag" style={{ color: u.active ? "var(--green)" : "var(--text-3)", background: u.active ? "var(--green-bg)" : "var(--surface-2)" }}>
                        {u.active ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: "var(--text-3)", whiteSpace: "nowrap" }}>
                      {new Date(u.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </td>
                    <td>
                      {!isMe && (
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            className="btn"
                            style={{ height: 28, padding: "0 10px", fontSize: 11.5 }}
                            disabled={actionPending === `reset-${u.id}` || !u.active}
                            onClick={() => handleReset(u.id)}
                          >
                            {actionPending === `reset-${u.id}` ? <span className="spinner" /> : "Reset pwd"}
                          </button>
                          <button
                            className={`btn${u.active ? " btn-danger" : ""}`}
                            style={{ height: 28, padding: "0 10px", fontSize: 11.5 }}
                            disabled={actionPending === `active-${u.id}`}
                            onClick={() => handleToggleActive(u.id, !u.active)}
                          >
                            {actionPending === `active-${u.id}` ? <span className="spinner" /> : u.active ? "Disable" : "Enable"}
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
