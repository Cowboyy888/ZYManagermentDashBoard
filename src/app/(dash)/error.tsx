"use client";
import Link from "next/link";

export default function DashError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{
      padding: 48, display: "flex", alignItems: "center", justifyContent: "center",
      minHeight: 400,
    }}>
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <div style={{ fontSize: 36, marginBottom: 14 }}>⚠</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
          Something went wrong
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 24, lineHeight: 1.6 }}>
          {error.message || "An unexpected error occurred."}
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
          <button className="btn btn-primary" onClick={reset}>Try again</button>
          <Link href="/" className="btn">Go to dashboard</Link>
        </div>
      </div>
    </div>
  );
}
