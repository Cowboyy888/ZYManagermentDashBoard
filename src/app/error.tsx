"use client";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg)", padding: 24,
    }}>
      <div style={{ textAlign: "center", maxWidth: 420 }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>⚠</div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>
          Something went wrong
        </h2>
        <p style={{ fontSize: 14, color: "var(--text-2)", marginBottom: 24, lineHeight: 1.6 }}>
          {error.message || "An unexpected error occurred."}
        </p>
        <button className="btn btn-primary" onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
