"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth/client";
import { useRouter } from "next/navigation";

export default function PortalLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await authClient.signIn.email({ email, password });
      if ("error" in res && res.error) {
        setError(res.error.message ?? "Login failed. Check your credentials.");
        return;
      }
      // Redirect based on role — fetch user info
      const sessionRes = await authClient.getSession();
      const role = (sessionRes?.data?.user as { role?: string } | null | undefined)?.role;
      if (role === "CUSTOMER_PORTAL") {
        router.push("/portal/customer");
      } else if (role === "SUPPLIER_PORTAL") {
        router.push("/portal/supplier");
      } else {
        // Internal user trying portal login — redirect to dashboard
        router.push("/");
      }
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div style={{
          background: "var(--red-bg)", color: "var(--red)", borderRadius: 8,
          padding: "0.75rem 1rem", marginBottom: "1rem", fontSize: 14,
        }}>
          {error}
        </div>
      )}
      <div style={{ marginBottom: "1rem" }}>
        <label style={{ display: "block", fontWeight: 500, marginBottom: 6, fontSize: 14 }}>Email</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          placeholder="you@company.com"
          style={{
            width: "100%", padding: "0.6rem 0.85rem", border: "1px solid var(--border)",
            borderRadius: 8, fontSize: 14, boxSizing: "border-box", background: "var(--surface)",
          }}
        />
      </div>
      <div style={{ marginBottom: "1.5rem" }}>
        <label style={{ display: "block", fontWeight: 500, marginBottom: 6, fontSize: 14 }}>Password</label>
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          placeholder="••••••••••"
          style={{
            width: "100%", padding: "0.6rem 0.85rem", border: "1px solid var(--border)",
            borderRadius: 8, fontSize: 14, boxSizing: "border-box", background: "var(--surface)",
          }}
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        style={{
          width: "100%", padding: "0.7rem", background: "var(--steel)", color: "#fff",
          border: "none", borderRadius: 8, fontWeight: 600, fontSize: 15, cursor: loading ? "not-allowed" : "pointer",
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? "Signing in…" : "Sign In"}
      </button>
    </form>
  );
}
