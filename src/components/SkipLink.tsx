"use client";

export function SkipLink() {
  return (
    <a
      href="#main-content"
      style={{
        position: "absolute", top: -40, left: 0, zIndex: 100,
        background: "var(--steel)", color: "#fff",
        padding: "8px 16px", fontSize: 14, fontWeight: 600,
        textDecoration: "none", borderRadius: "0 0 8px 0",
        transition: "top 0.1s",
      }}
      onFocus={(e) => { (e.currentTarget as HTMLElement).style.top = "0"; }}
      onBlur={(e) => { (e.currentTarget as HTMLElement).style.top = "-40px"; }}
    >
      Skip to content
    </a>
  );
}
