import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg)", padding: 24,
    }}>
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 80, fontWeight: 900, color: "var(--border)", lineHeight: 1, letterSpacing: "-4px" }}>
          404
        </p>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: "20px 0 8px" }}>
          Page not found
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-2)", marginBottom: 32 }}>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link href="/" className="btn btn-primary" style={{ display: "inline-flex" }}>
          Go to dashboard
        </Link>
      </div>
    </div>
  );
}
