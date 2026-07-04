"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { ZysteelLogo } from "@/components/ZysteelLogo";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const raw = searchParams.get("callbackUrl") ?? "/";
  const callbackUrl = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);
  const [showPw, setShowPw]     = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await authClient.signIn.email({ email, password });
    setLoading(false);
    if (err) {
      setError(err.message ?? "Invalid credentials");
    } else {
      router.replace(callbackUrl);
      router.refresh();
    }
  }

  return (
    <>
      {/* ── Keyframe definitions ── */}
      <style>{`
        @keyframes zy-bg-pulse {
          0%, 100% { opacity: 0.07; transform: scale(1) rotate(0deg); }
          50%       { opacity: 0.12; transform: scale(1.08) rotate(6deg); }
        }
        @keyframes zy-float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33%       { transform: translateY(-10px) rotate(2deg); }
          66%       { transform: translateY(-5px) rotate(-1deg); }
        }
        @keyframes zy-logo-in {
          from { opacity: 0; transform: translateY(-32px) scale(0.8); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes zy-card-in {
          from { opacity: 0; transform: translateY(40px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes zy-field-in {
          from { opacity: 0; transform: translateX(-16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes zy-btn-in {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes zy-spinner {
          to { transform: rotate(360deg); }
        }
        @keyframes zy-shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-6px); }
          40%       { transform: translateX(6px); }
          60%       { transform: translateX(-4px); }
          80%       { transform: translateX(4px); }
        }
        @keyframes zy-check-in {
          from { opacity: 0; transform: scale(0.6); }
          to   { opacity: 1; transform: scale(1); }
        }
        .zy-btn:hover:not(:disabled) {
          background: #b91c1c !important;
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(220,38,38,0.35);
        }
        .zy-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .zy-input:focus {
          outline: none;
          border-color: #DC2626 !important;
          box-shadow: 0 0 0 3px rgba(220,38,38,0.15);
        }
        .zy-input::placeholder { color: #9ca3af; }
      `}</style>

      <div style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0f172a 0%, #1e1b2e 50%, #0f172a 100%)",
        padding: 24,
        position: "relative",
        overflow: "hidden",
      }}>

        {/* ── Animated background rings ── */}
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          alignItems: "center", justifyContent: "center", pointerEvents: "none",
        }}>
          {[420, 620, 820, 1020].map((d, i) => (
            <div key={d} style={{
              position: "absolute",
              width: d, height: d,
              borderRadius: "50%",
              border: "1px solid rgba(220,38,38,0.15)",
              animation: `zy-bg-pulse ${3 + i * 0.7}s ease-in-out infinite`,
              animationDelay: `${i * 0.4}s`,
            }} />
          ))}
        </div>

        {/* ── Floating background ZY logo ── */}
        <div style={{
          position: "absolute",
          right: "8%", bottom: "10%",
          opacity: 0.04,
          animation: "zy-float 8s ease-in-out infinite",
          pointerEvents: "none",
        }}>
          <ZysteelLogo size={320} />
        </div>

        {/* ── Top-left accent ── */}
        <div style={{
          position: "absolute", top: "5%", left: "5%",
          opacity: 0.05,
          animation: "zy-float 11s ease-in-out infinite reverse",
          pointerEvents: "none",
        }}>
          <ZysteelLogo size={160} />
        </div>

        {/* ── Login card ── */}
        <div style={{
          width: "100%", maxWidth: 420,
          display: "flex", flexDirection: "column", alignItems: "center",
          gap: 0, position: "relative", zIndex: 10,
        }}>

          {/* Logo + brand name */}
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            marginBottom: 32,
            animation: "zy-logo-in 0.7s cubic-bezier(0.22,1,0.36,1) both",
          }}>
            {/* Glowing logo container */}
            <div style={{
              background: "rgba(220,38,38,0.08)",
              border: "1px solid rgba(220,38,38,0.25)",
              borderRadius: 24,
              padding: 20,
              marginBottom: 16,
              boxShadow: "0 0 40px rgba(220,38,38,0.15), inset 0 1px 0 rgba(255,255,255,0.05)",
              backdropFilter: "blur(8px)",
            }}>
              <ZysteelLogo size={72} />
            </div>
            <h1 style={{
              fontSize: 26, fontWeight: 800,
              color: "#fff", letterSpacing: "-0.02em",
              marginBottom: 4,
            }}>
              ZYSTEEL
            </h1>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", letterSpacing: "0.08em" }}>
              中粤铁网 · HR Management
            </p>
          </div>

          {/* Form card */}
          <div style={{
            width: "100%",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 20,
            padding: "32px 32px 28px",
            backdropFilter: "blur(20px)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.07)",
            animation: "zy-card-in 0.7s cubic-bezier(0.22,1,0.36,1) 0.15s both",
          }}>
            <h2 style={{
              fontSize: 18, fontWeight: 700, color: "#fff",
              marginBottom: 6,
            }}>
              Sign in
            </h2>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", marginBottom: 24 }}>
              Enter your credentials to continue
            </p>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 0 }} noValidate>

              {/* Email field */}
              <div style={{
                marginBottom: 16,
                animation: "zy-field-in 0.5s cubic-bezier(0.22,1,0.36,1) 0.3s both",
              }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)", marginBottom: 8, letterSpacing: "0.04em" }}>
                  EMAIL
                </label>
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  autoFocus
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="zy-input"
                  placeholder="you@zysteel.com"
                  style={{
                    width: "100%", boxSizing: "border-box",
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    borderRadius: 10,
                    padding: "12px 14px",
                    fontSize: 14, color: "#fff",
                    transition: "border-color 0.2s, box-shadow 0.2s",
                  }}
                  aria-describedby={error ? "login-error" : undefined}
                />
              </div>

              {/* Password field */}
              <div style={{
                marginBottom: 24,
                position: "relative",
                animation: "zy-field-in 0.5s cubic-bezier(0.22,1,0.36,1) 0.4s both",
              }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.6)", marginBottom: 8, letterSpacing: "0.04em" }}>
                  PASSWORD
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="login-password"
                    type={showPw ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="zy-input"
                    style={{
                      width: "100%", boxSizing: "border-box",
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 10,
                      padding: "12px 44px 12px 14px",
                      fontSize: 14, color: "#fff",
                      transition: "border-color 0.2s, box-shadow 0.2s",
                    }}
                    aria-describedby={error ? "login-error" : undefined}
                  />
                  {/* Show/hide password toggle */}
                  <button
                    type="button"
                    onClick={() => setShowPw(p => !p)}
                    tabIndex={-1}
                    style={{
                      position: "absolute", right: 12, top: "50%",
                      transform: "translateY(-50%)",
                      background: "none", border: "none", cursor: "pointer",
                      color: "rgba(255,255,255,0.35)", padding: 4,
                      transition: "color 0.15s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = "rgba(255,255,255,0.7)")}
                    onMouseLeave={e => (e.currentTarget.style.color = "rgba(255,255,255,0.35)")}
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? (
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Error message */}
              {error && (
                <div
                  id="login-error"
                  role="alert"
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    background: "rgba(220,38,38,0.12)",
                    border: "1px solid rgba(220,38,38,0.3)",
                    borderRadius: 8, padding: "10px 12px",
                    marginBottom: 16,
                    animation: "zy-shake 0.4s ease-out",
                  }}
                >
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth={2} style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <span style={{ fontSize: 13, color: "#fca5a5" }}>{error}</span>
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading}
                className="zy-btn"
                style={{
                  width: "100%",
                  background: "#DC2626",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  padding: "13px 24px",
                  fontSize: 15, fontWeight: 700,
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.7 : 1,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  transition: "all 0.2s",
                  boxShadow: "0 4px 16px rgba(220,38,38,0.25)",
                  animation: "zy-btn-in 0.5s cubic-bezier(0.22,1,0.36,1) 0.5s both",
                }}
              >
                {loading ? (
                  <>
                    <svg
                      width={16} height={16} viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" strokeWidth={2.5}
                      style={{ animation: "zy-spinner 0.7s linear infinite" }}
                    >
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                    </svg>
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign in
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer */}
          <p style={{
            marginTop: 20, fontSize: 12,
            color: "rgba(255,255,255,0.2)",
            animation: "zy-btn-in 0.5s ease 0.7s both",
          }}>
            © {new Date().getFullYear()} ZY Steel Cambodia · Secure HR System
          </p>
        </div>
      </div>
    </>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
