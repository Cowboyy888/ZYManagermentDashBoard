"use client";
import { useState } from "react";
import { acceptQuotation, rejectQuotation } from "@/actions/portal/customer";
import { useRouter } from "next/navigation";

export default function QuotationActions({ quotationId }: { quotationId: number }) {
  const router = useRouter();
  const [action, setAction] = useState<"accept" | "reject" | null>(null);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const res = action === "accept"
        ? await acceptQuotation(quotationId, note || undefined)
        : await rejectQuotation(quotationId, note || undefined);
      if ("error" in res) { setError(res.error); return; }
      router.refresh();
    } catch {
      setError("Failed to submit response.");
    } finally {
      setLoading(false);
    }
  }

  if (!action) {
    return (
      <div className="panel">
        <div className="panel-head">Your Response</div>
        <div className="panel-body" style={{ display: "flex", gap: "1rem" }}>
          <button
            onClick={() => setAction("accept")}
            style={{ padding: "0.6rem 1.5rem", background: "var(--green)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}
          >
            ✅ Accept Quotation
          </button>
          <button
            onClick={() => setAction("reject")}
            style={{ padding: "0.6rem 1.5rem", background: "var(--red)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}
          >
            ❌ Reject Quotation
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-head">
        {action === "accept" ? "Accept Quotation" : "Reject Quotation"}
      </div>
      <div className="panel-body">
        {error && <div style={{ color: "var(--red)", marginBottom: "1rem", fontSize: 14 }}>{error}</div>}
        <textarea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder={action === "accept" ? "Optional note (e.g. delivery instructions)" : "Reason for rejection (optional)"}
          rows={3}
          style={{ width: "100%", padding: "0.6rem", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, boxSizing: "border-box", resize: "vertical", marginBottom: "1rem" }}
        />
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button
            onClick={submit}
            disabled={loading}
            style={{
              padding: "0.6rem 1.5rem",
              background: action === "accept" ? "var(--green)" : "var(--red)",
              color: "#fff", border: "none", borderRadius: 8, fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "Submitting…" : `Confirm ${action === "accept" ? "Acceptance" : "Rejection"}`}
          </button>
          <button
            onClick={() => { setAction(null); setNote(""); setError(""); }}
            style={{ padding: "0.6rem 1rem", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer" }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
