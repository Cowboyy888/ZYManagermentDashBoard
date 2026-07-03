"use client";
import { useState, useRef, useEffect, useTransition } from "react";

type Message = { role: "user" | "assistant"; content: string };

interface Props {
  domain: "hr" | "production" | "sales";
  placeholder?: string;
  starters?: string[];
}

const MODEL_NAME = "Claude Sonnet 4.6";

export function AIChatWidget({ domain, placeholder = "Ask anything…", starters = [] }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming]);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    setError(null);

    const newMessages: Message[] = [...messages, { role: "user", content: trimmed }];
    setMessages([...newMessages, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, messages: newMessages }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(body.error ?? "Request failed");
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        const finalText = accumulated;
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = { role: "assistant", content: finalText };
          return updated;
        });
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Something went wrong");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setStreaming(false);
      abortRef.current = null;
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function clearChat() {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setInput("");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 120px)", minHeight: 500 }}>
      {/* Starter prompts */}
      {messages.length === 0 && starters.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {starters.map((s) => (
            <button key={s} onClick={() => sendMessage(s)} style={{ padding: "7px 14px", borderRadius: 20, border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text-2)", fontSize: 12.5, cursor: "pointer", fontWeight: 500 }}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, paddingBottom: 8 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-3)" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🤖</div>
            <div style={{ fontSize: 14, fontWeight: 500 }}>Powered by {MODEL_NAME}</div>
            <div style={{ fontSize: 12.5, marginTop: 4 }}>Ask a question or pick a starter above</div>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
            {msg.role === "assistant" && (
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--steel)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, marginRight: 8, flexShrink: 0, marginTop: 2 }}>✦</div>
            )}
            <div style={{
              maxWidth: "75%",
              padding: "10px 14px",
              borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "4px 18px 18px 18px",
              background: msg.role === "user" ? "var(--steel)" : "var(--surface)",
              color: msg.role === "user" ? "#fff" : "var(--text)",
              fontSize: 13.5,
              lineHeight: 1.55,
              border: msg.role === "assistant" ? "1px solid var(--border)" : "none",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}>
              {msg.content}
              {msg.role === "assistant" && msg.content === "" && streaming && (
                <span style={{ display: "inline-block", width: 6, height: 14, background: "var(--steel)", borderRadius: 2, animation: "blink 1s step-end infinite", verticalAlign: "text-bottom" }} />
              )}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 8, background: "var(--red-bg)", color: "var(--red)", fontSize: 13, marginBottom: 8 }}>
          {error}
        </div>
      )}

      {/* Input */}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", borderTop: "1px solid var(--border)", paddingTop: 12 }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          rows={1}
          style={{
            flex: 1, resize: "none", padding: "10px 14px", borderRadius: 12, border: "1px solid var(--border)",
            background: "var(--surface)", color: "var(--text)", fontSize: 13.5, fontFamily: "inherit",
            outline: "none", lineHeight: 1.5, maxHeight: 120, overflowY: "auto",
          }}
          onInput={(e) => {
            const ta = e.currentTarget;
            ta.style.height = "auto";
            ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
          }}
        />
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          {streaming ? (
            <button onClick={() => abortRef.current?.abort()} style={{ height: 40, padding: "0 16px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", fontSize: 13, color: "var(--text-2)" }}>
              Stop
            </button>
          ) : (
            <button onClick={() => sendMessage(input)} disabled={!input.trim()} style={{ height: 40, padding: "0 16px", borderRadius: 10, border: "none", background: input.trim() ? "var(--steel)" : "var(--border)", color: input.trim() ? "#fff" : "var(--text-3)", cursor: input.trim() ? "pointer" : "default", fontSize: 13, fontWeight: 600, transition: "all 0.12s" }}>
              Send
            </button>
          )}
          {messages.length > 0 && !streaming && (
            <button onClick={clearChat} style={{ height: 40, padding: "0 12px", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface)", cursor: "pointer", fontSize: 12, color: "var(--text-3)" }}>
              Clear
            </button>
          )}
        </div>
      </div>

      <style>{`@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }`}</style>
    </div>
  );
}
