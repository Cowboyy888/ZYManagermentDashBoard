import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
  description:
    "Sign in to Zysteel HR — the workforce management system for ZY Steel (中粤铁网), Cambodia.",
  // Allow the login page to be indexed so the brand appears in search.
  // All other dashboard routes remain noindex via the root layout default.
  robots: { index: true, follow: false },
};

const org = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "ZY Steel (中粤铁网)",
  alternateName: "Zysteel Cambodia",
  description: "Steel mesh manufacturing plant, Phnom Penh, Cambodia.",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(org) }}
      />
      {children}
    </>
  );
}
