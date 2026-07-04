import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ZY Steel — Factory TV Dashboard",
  robots: { index: false },
};

export default function TVLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "#0a0e1a", color: "#e2e8f0", fontFamily: "system-ui, sans-serif" }}>
      {children}
    </div>
  );
}
