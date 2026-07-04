import { Metadata } from "next";
import RegisterForm from "./RegisterForm";

export const metadata: Metadata = { title: "Request Portal Access — ZY Steel" };

export default function RegisterPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: "2rem" }}>
      <div className="panel" style={{ width: "100%", maxWidth: 480, padding: "2.5rem" }}>
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: "var(--steel)" }}>ZY Steel</div>
          <div style={{ color: "var(--text-2)", marginTop: 4 }}>Request Customer Portal Access</div>
        </div>
        <RegisterForm />
        <p style={{ textAlign: "center", marginTop: "1.5rem", fontSize: 13, color: "var(--text-3)" }}>
          Already have an account?{" "}
          <a href="/portal/login" style={{ color: "var(--steel)", textDecoration: "none", fontWeight: 500 }}>
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
