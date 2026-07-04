"use client";
import { useState, useTransition } from "react";
import { createPortalThread, getPortalThread, sendPortalMessage } from "@/actions/portal/messaging";

type Thread = { id: number; subject: string; type: string; status: string; lastMessageAt: Date | null; _count: { messages: number } };
type Message = { id: number; body: string; createdAt: Date; sender: { id: string; name: string; role: string } };
type FullThread = { id: number; subject: string; messages: Message[] };

export default function MessagesClient({ initialThreads }: { initialThreads: Thread[] }) {
  const [threads, setThreads] = useState(initialThreads);
  const [activeThread, setActiveThread] = useState<FullThread | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");
  const [isPending, startTransition] = useTransition();

  function loadThread(id: number) {
    startTransition(async () => {
      const res = await getPortalThread(id);
      if (res.ok) setActiveThread(res.data as unknown as FullThread);
    });
  }

  function createThread() {
    if (!newSubject.trim() || !newBody.trim()) return;
    startTransition(async () => {
      const res = await createPortalThread({ subject: newSubject, body: newBody });
      if (res.ok) {
        setShowNew(false);
        setNewSubject("");
        setNewBody("");
        loadThread(res.data.threadId);
      }
    });
  }

  function sendReply() {
    if (!activeThread || !newMessage.trim()) return;
    startTransition(async () => {
      await sendPortalMessage(activeThread.id, newMessage);
      setNewMessage("");
      loadThread(activeThread.id);
    });
  }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: "1rem", height: "calc(100vh - 200px)" }}>
      {/* Thread list */}
      <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "1rem", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>Conversations</span>
          <button onClick={() => setShowNew(true)} className="btn btn-sm" style={{ padding: "0.25rem 0.6rem" }}>+ New</button>
        </div>
        <div style={{ overflowY: "auto", flex: 1 }}>
          {threads.length === 0 && (
            <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-3)", fontSize: 14 }}>
              No conversations yet. Start one!
            </div>
          )}
          {threads.map(t => (
            <div
              key={t.id}
              onClick={() => loadThread(t.id)}
              style={{
                padding: "0.75rem 1rem", borderBottom: "1px solid var(--border)",
                cursor: "pointer", background: activeThread?.id === t.id ? "var(--steel-light)" : "transparent",
              }}
            >
              <div style={{ fontWeight: 500, fontSize: 14, marginBottom: 2 }}>{t.subject}</div>
              <div style={{ fontSize: 12, color: "var(--text-3)" }}>
                {t._count.messages} message{t._count.messages !== 1 ? "s" : ""}
                {t.lastMessageAt && ` · ${new Date(t.lastMessageAt).toLocaleDateString()}`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Thread content / new thread */}
      {showNew ? (
        <div className="panel" style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "1.5rem" }}>
          <h3 style={{ margin: 0, fontWeight: 600 }}>New Message</h3>
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 4 }}>Subject</label>
            <input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="What's this about?" style={{ width: "100%", padding: "0.6rem", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 4 }}>Message</label>
            <textarea value={newBody} onChange={e => setNewBody(e.target.value)} placeholder="Type your message…" rows={6} style={{ width: "100%", padding: "0.6rem", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, boxSizing: "border-box", resize: "vertical" }} />
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button onClick={createThread} disabled={isPending} className="btn">Send Message</button>
            <button onClick={() => setShowNew(false)} style={{ padding: "0.5rem 1rem", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer" }}>Cancel</button>
          </div>
        </div>
      ) : activeThread ? (
        <div className="panel" style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ padding: "1rem", borderBottom: "1px solid var(--border)", fontWeight: 600 }}>{activeThread.subject}</div>
          <div style={{ flex: 1, overflowY: "auto", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            {activeThread.messages.map(msg => {
              const isPortalUser = msg.sender.role === "CUSTOMER_PORTAL" || msg.sender.role === "SUPPLIER_PORTAL";
              return (
                <div key={msg.id} style={{ display: "flex", justifyContent: isPortalUser ? "flex-end" : "flex-start" }}>
                  <div style={{
                    maxWidth: "70%", padding: "0.75rem 1rem", borderRadius: 12,
                    background: isPortalUser ? "var(--steel)" : "var(--surface-2)",
                    color: isPortalUser ? "#fff" : "var(--text)",
                  }}>
                    <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>
                      {msg.sender.name} · {new Date(msg.createdAt).toLocaleString()}
                    </div>
                    <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{msg.body}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ padding: "1rem", borderTop: "1px solid var(--border)", display: "flex", gap: "0.5rem" }}>
            <input
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendReply())}
              placeholder="Type a message… (Enter to send)"
              style={{ flex: 1, padding: "0.6rem", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }}
            />
            <button onClick={sendReply} disabled={isPending || !newMessage.trim()} className="btn">Send</button>
          </div>
        </div>
      ) : (
        <div className="panel" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center", color: "var(--text-3)" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
            <div>Select a conversation or start a new one</div>
          </div>
        </div>
      )}
    </div>
  );
}
