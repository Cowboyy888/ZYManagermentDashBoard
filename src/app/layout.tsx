import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#2d4a63",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  ),
  title: {
    default: "Zysteel HR",
    template: "%s | Zysteel HR",
  },
  description:
    "HR management system for ZY Steel (中粤铁网) — employee records, attendance, payroll, and overtime.",
  // Private internal tool — opt-out all crawlers. robots.txt is authoritative;
  // this meta tag is belt-and-suspenders for any page accidentally exposed.
  robots: { index: false, follow: false },
  openGraph: {
    type: "website",
    siteName: "Zysteel HR",
    title: "Zysteel HR",
    description: "HR management system for ZY Steel Cambodia.",
    locale: "en_US",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main-content" className="skip-nav">Skip to main content</a>
        {children}
      </body>
    </html>
  );
}
