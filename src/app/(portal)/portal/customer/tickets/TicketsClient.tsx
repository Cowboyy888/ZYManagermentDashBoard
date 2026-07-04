"use client";
import { useState, useTransition } from "react";
import { createSupportTicket, replyToTicket, getTicketDetail } from "@/actions/portal/tickets";

type Ticket = { id: number; ticketNumber: string; subject: string; status: string; priority: string; createdAt: Date; _count: { messages: number } };
type TicketMsg = { id: number; body: string; createdAt: Date; sender: { name: string; role: string } };
type FullTicket = { id: number; ticketNumber: string; subject: string; status: string; messages: TicketMsg[]; assignedTo?: { name: string } | null };

const STATUS_COLOR: Record<string, string> = { OPEN: "var(--green)", IN_PROGRESS: "var(--blue)", CLOSED: "var(--text-3)" };
const PRIORITY_COLOR: Record<string, string> = { LOW: "var(--text-3)", NORMAL: "var(--blue)", HIGH: "var(--amber)", URGENT: "var(--red)" };

export default function TicketsClient({ initialTickets }: { initialTickets: Ticket[] }) {
  const [tickets, setTickets] = useState(initialTickets);
  const [active, setActive] = useState<FullTicket | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ subject: "", body: "", priority: "NORMAL" as "LOW" | "NORMAL" | "HIGH" | "URGENT" });
  const [reply, setReply] = useState("");
  const [isPending, startTransition] = useTransition();

  function loadTicket(id: number) {
    startTransition(async () => {
      const res = await getTicketDetail(id);
      if (res.ok) setActive(res.data as unknown as FullTicket);
    });
  }

  function submitTicket() {
    if (!form.subject.trim() || !form.body.trim()) return;
    startTransition(async () => {
      const res = await createSupportTicket(form);
      if (res.ok) {
        setShowNew(false);
        setForm({ subject: "", body: "", priority: "NORMAL" });
        loadTicket(res.data.ticketId);
      }
    });
  }

  function sendReply() {
    if (!active || !reply.trim()) return;
    startTransition(async () => {
      await replyToTicket(active.id, reply);
      setReply("");
      loadTicket(active.id);
    });
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: "1rem", minHeight: 500 }}>
      {/* Ticket list */}
      <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "1rem", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>My Tickets</span>
          <button onClick={() => setShowNew(true)} className="btn btn-sm">+ New Ticket</button>
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {tickets.length === 0 && (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-3)", fontSize: 14 }}>No tickets yet.</div>
          )}
          {tickets.map(t => (
            <div key={t.id} onClick={() => loadTicket(t.id)} style={{ padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)", cursor: "pointer", background: active?.id === t.id ? "var(--steel-light)" : "transparent" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span style={{ fontWeight: 500, fontSize: 13 }}>{t.ticketNumber}</span>
                <span className="tag" style={{ fontSize: 11, background: STATUS_COLOR[t.status] + "22", color: STATUS_COLOR[t.status] }}>{t.status}</span>
              </div>
              <div style={{ fontSize: 13, marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.subject}</div>
              <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                <span className="tag" style={{ fontSize: 10, background: PRIORITY_COLOR[t.priority] + "22", color: PRIORITY_COLOR[t.priority] }}>{t.priority}</span>
                {" · "}{t._count.messages} msg{t._count.messages !== 1 ? "s" : ""}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Content area */}
      {showNew ? (
        <div className="panel" style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
          <h3 style={{ margin: 0 }}>New Support Ticket</h3>
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 4 }}>Subject</label>
            <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Brief description of the issue" style={{ width: "100%", padding: "0.6rem", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 4 }}>Priority</label>
            <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as "LOW" | "NORMAL" | "HIGH" | "URGENT" }))} style={{ padding: "0.6rem", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }}>
              <option value="LOW">Low</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 4 }}>Description</label>
            <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={6} placeholder="Describe the issue in detail…" style={{ width: "100%", padding: "0.6rem", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, boxSizing: "border-box", resize: "vertical" }} />
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button onClick={submitTicket} disabled={isPending} className="btn">Submit Ticket</button>
            <button onClick={() => setShowNew(false)} style={{ padding: "0.5rem 1rem", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      ) : active ? (
        <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "1rem", borderBottom: "1px solid var(--border)" }}>
            <div style={{ fontWeight: 600 }}>{active.subject}</div>
            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 2 }}>
              {active.ticketNumber} · {active.status}
              {active.assignedTo && ` · Assigned: ${active.assignedTo.name}`}
            </div>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {active.messages.map(msg => {
              const isCustomer = msg.sender.role === "CUSTOMER_PORTAL";
              return (
                <div key={msg.id} style={{ display: "flex", justifyContent: isCustomer ? "flex-end" : "flex-start" }}>
                  <div style={{ maxWidth: "70%", padding: "0.75rem 1rem", borderRadius: 12, background: isCustomer ? "var(--steel)" : "var(--surface-2)", color: isCustomer ? "#fff" : "var(--text)" }}>
                    <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>{msg.sender.name} · {new Date(msg.createdAt).toLocaleString()}</div>
                    <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{msg.body}</div>
                  </div>
                </div>
              );
            })}
          </div>
          {active.status !== "CLOSED" && (
            <div style={{ padding: "1rem", borderTop: "1px solid var(--border)", display: "flex", gap: "0.5rem" }}>
              <input value={reply} onChange={e => setReply(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendReply())} placeholder="Reply… (Enter to send)" style={{ flex: 1, padding: "0.6rem", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }} />
              <button onClick={sendReply} disabled={isPending || !reply.trim()} className="btn">Send</button>
            </div>
          )}
        </div>
      ) : (
        <div className="panel" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center", color: "var(--text-3)" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🎫</div>
            <div>Select a ticket or create a new one</div>
          </div>
        </div>
      )}
    </div>
  );
}
