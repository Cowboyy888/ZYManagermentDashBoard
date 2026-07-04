import { Metadata } from "next";
import PortalLoginForm from "./PortalLoginForm";

export const metadata: Metadata = { title: "Portal Login — ZY Steel" };

export default function PortalLoginPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)" }}>
      <div className="panel" style={{ width: "100%", maxWidth: 420, padding: "2.5rem" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--steel)", letterSpacing: "-0.5px" }}>ZY Steel</div>
          <div style={{ color: "var(--text-2)", marginTop: 4 }}>Customer & Supplier Portal</div>
        </div>
        <PortalLoginForm />
        <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: 13, color: "var(--text-3)" }}>
          New customer?{" "}
          <a href="/portal/register" style={{ color: "var(--steel)", textDecoration: "none", fontWeight: 500 }}>
            Request portal access
          </a>
        </p>
      </div>
    </div>
  );
}
