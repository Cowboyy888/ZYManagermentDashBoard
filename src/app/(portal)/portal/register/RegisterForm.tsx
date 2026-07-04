"use client";
import { useState } from "react";
import { registerCustomerPortal } from "@/actions/portal/auth";

export default function RegisterForm() {
  const [form, setForm] = useState({
    name: "", email: "", password: "", confirmPassword: "", companyName: "", phone: "", country: "Cambodia",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (form.password.length < 10) {
      setError("Password must be at least 10 characters.");
      return;
    }
    setLoading(true);
    try {
      const res = await registerCustomerPortal({
        name: form.name,
        email: form.email,
        password: form.password,
        companyName: form.companyName,
        phone: form.phone || undefined,
        country: form.country || undefined,
      });
      if ("error" in res) { setError(res.error); return; }
      setSuccess(true);
    } catch {
      setError("Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div style={{ textAlign: "center", padding: "1rem" }}>
        <div style={{ fontSize: 40 }}>✅</div>
        <h3 style={{ margin: "1rem 0 0.5rem", color: "var(--green)" }}>Request Submitted</h3>
        <p style={{ color: "var(--text-2)", fontSize: 14 }}>
          Your portal access request has been submitted. Our team will review and activate your account within 1–2 business days.
        </p>
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "0.6rem 0.85rem", border: "1px solid var(--border)",
    borderRadius: 8, fontSize: 14, boxSizing: "border-box", background: "var(--surface)",
  };
  const labelStyle: React.CSSProperties = { display: "block", fontWeight: 500, marginBottom: 6, fontSize: 14 };

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div style={{ background: "var(--red-bg)", color: "var(--red)", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1rem", fontSize: 14 }}>
          {error}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
        <div>
          <label style={labelStyle}>Your Name</label>
          <input style={inputStyle} required value={form.name} onChange={e => set("name", e.target.value)} placeholder="John Doe" />
        </div>
        <div>
          <label style={labelStyle}>Company Name</label>
          <input style={inputStyle} required value={form.companyName} onChange={e => set("companyName", e.target.value)} placeholder="Acme Corp" />
        </div>
      </div>
      <div style={{ marginBottom: "1rem" }}>
        <label style={labelStyle}>Email Address</label>
        <input type="email" style={inputStyle} required value={form.email} onChange={e => set("email", e.target.value)} placeholder="you@company.com" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
        <div>
          <label style={labelStyle}>Phone</label>
          <input style={inputStyle} value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="+855..." />
        </div>
        <div>
          <label style={labelStyle}>Country</label>
          <input style={inputStyle} value={form.country} onChange={e => set("country", e.target.value)} />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1.5rem" }}>
        <div>
          <label style={labelStyle}>Password</label>
          <input type="password" style={inputStyle} required value={form.password} onChange={e => set("password", e.target.value)} placeholder="Min 10 chars" />
        </div>
        <div>
          <label style={labelStyle}>Confirm Password</label>
          <input type="password" style={inputStyle} required value={form.confirmPassword} onChange={e => set("confirmPassword", e.target.value)} placeholder="Repeat password" />
        </div>
      </div>
      <button
        type="submit"
        disabled={loading}
        style={{
          width: "100%", padding: "0.7rem", background: "var(--steel)", color: "#fff",
          border: "none", borderRadius: 8, fontWeight: 600, fontSize: 15,
          cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? "Submitting…" : "Request Access"}
      </button>
    </form>
  );
}
