/** @type {import('next').NextConfig} */
const nextConfig = {
  // Don't leak our tech stack in response headers.
  poweredByHeader: false,

  // Double-invokes effects/renders in dev to surface bugs early.
  reactStrictMode: true,

  // Gzip/Brotli compression for Next.js-served responses.
  // Default is true; explicit here so the intent is clear if this ever moves to a CDN.
  compress: true,

  // Image optimisation pipeline (formats + caching).
  // The app currently uses <img> tags; this config future-proofs migration to <Image>.
  // Local photos at /public/uploads/ are same-origin — no remotePatterns needed.
  images: {
    // Serve AVIF first (smaller), fall back to WebP, then original.
    formats: ["image/avif", "image/webp"],
    // Responsive breakpoints matching common viewport widths.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    // Cache optimised images for 7 days on the CDN / browser.
    minimumCacheTTL: 60 * 60 * 24 * 7,
  },

  experimental: {
    // Tree-shake large packages so only the components actually imported are bundled.
    // Recharts pulls in the full D3 suite without this; react-table ships unused plugins.
    optimizePackageImports: ["recharts", "framer-motion", "@tanstack/react-table"],
  },

  // Keep native-binary packages outside the Next.js server bundle.
  // Prisma generates a .node query engine; @node-rs/argon2 is a Rust binary.
  // Bundling either causes "cannot find module" errors in the output directory.
  serverExternalPackages: ["@prisma/client", "@node-rs/argon2"],

  // Explicit no-ignore policy — fail the build on type errors and lint violations.
  // Both fields default to false (ignore), so this documents intent and prevents
  // a future next.config change from silently weakening the gate.
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        // Employee photos and documents under /public/uploads/.
        // Filenames are timestamped (emp-{id}-{timestamp}.ext) so each upload
        // gets a unique URL — safe to cache aggressively in the browser.
        // 30 days max-age + 1 day stale-while-revalidate for a smooth UX on slow links.
        source: "/uploads/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=2592000, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
};

// Applied to every response. Order doesn't matter to browsers but keep it logical.
const securityHeaders = [
  // Disable speculative DNS lookups before the request.
  { key: "X-DNS-Prefetch-Control", value: "off" },

  // Force HTTPS for 2 years; tell browsers to preload (requires HTTPS in prod).
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },

  // Prevent browsers from MIME-sniffing the response (guards content-type attacks).
  { key: "X-Content-Type-Options", value: "nosniff" },

  // Clickjacking: allow framing only from the same origin.
  // Redundant with frame-ancestors in CSP below, but kept for older browsers.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },

  // Don't send the full URL path as a referrer to external sites.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

  // Disable browser APIs we don't use.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },

  // Content Security Policy.
  //
  // 'unsafe-inline' in script-src is required by Next.js App Router — it embeds
  // the RSC payload and router state in inline <script> tags. To remove it, migrate
  // to nonce-based CSP via Next.js middleware (future hardening task).
  //
  // 'unsafe-inline' in style-src is required by Tailwind's utility classes and the
  // inline style props used throughout the UI.
  //
  // Turnstile (challenges.cloudflare.com) is pre-wired for the login widget that
  // will be added when implementing Turnstile CSRF protection.
  //
  // img-src blob: covers the photo preview (URL.createObjectURL) in EmployeeForm.
  // img-src data: covers QR code SVG rendering from qrcode.react.
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' blob: data:",
      "font-src 'self'",
      "connect-src 'self' https://challenges.cloudflare.com",
      "frame-src 'self' https://challenges.cloudflare.com",
      "frame-ancestors 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

export default nextConfig;
