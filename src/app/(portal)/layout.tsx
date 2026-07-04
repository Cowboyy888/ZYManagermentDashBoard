import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "ZY Steel Portal",
  description: "Customer & Supplier Portal — ZY Steel Cambodia",
};

export default function PortalRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, background: "var(--bg)", color: "var(--text)", fontFamily: "system-ui, sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
