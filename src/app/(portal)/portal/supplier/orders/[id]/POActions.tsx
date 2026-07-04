"use client";
import { useState } from "react";
import { acceptPurchaseOrder, rejectPurchaseOrder } from "@/actions/portal/supplier";
import { useRouter } from "next/navigation";

export default function POActions({ poId, expectedDelivery }: { poId: number; expectedDelivery: string }) {
  const router = useRouter();
  const [action, setAction] = useState<"accept" | "reject" | null>(null);
  const [note, setNote] = useState("");
  const [confirmedDelivery, setConfirmedDelivery] = useState(expectedDelivery);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const res = action === "accept"
        ? await acceptPurchaseOrder(poId, confirmedDelivery || undefined, note || undefined)
        : await rejectPurchaseOrder(poId, note || undefined);
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
        <div className="panel-head">Your Response Required</div>
        <div className="panel-body">
          <p style={{ margin: "0 0 1rem", fontSize: 14, color: "var(--text-2)" }}>
            Please accept or reject this purchase order.
          </p>
          <div style={{ display: "flex", gap: "1rem" }}>
            <button onClick={() => setAction("accept")} style={{ padding: "0.6rem 1.5rem", background: "var(--green)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
              ✅ Accept Order
            </button>
            <button onClick={() => setAction("reject")} style={{ padding: "0.6rem 1.5rem", background: "var(--red)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer" }}>
              ❌ Reject Order
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-head">{action === "accept" ? "Accept Purchase Order" : "Reject Purchase Order"}</div>
      <div className="panel-body" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {error && <div style={{ color: "var(--red)", fontSize: 14 }}>{error}</div>}
        {action === "accept" && (
          <div>
            <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 4 }}>Confirmed Delivery Date</label>
            <input type="date" value={confirmedDelivery} onChange={e => setConfirmedDelivery(e.target.value)} style={{ padding: "0.6rem", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14 }} />
          </div>
        )}
        <div>
          <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 4 }}>
            {action === "accept" ? "Note (optional)" : "Reason for rejection (optional)"}
          </label>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={3} style={{ width: "100%", padding: "0.6rem", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, boxSizing: "border-box", resize: "vertical" }} />
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button onClick={submit} disabled={loading} style={{ padding: "0.6rem 1.5rem", background: action === "accept" ? "var(--green)" : "var(--red)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Submitting…" : `Confirm ${action === "accept" ? "Acceptance" : "Rejection"}`}
          </button>
          <button onClick={() => { setAction(null); setError(""); }} style={{ padding: "0.6rem 1rem", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
