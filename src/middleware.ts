import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Better Auth session cookie names:
//   - "better-auth.session_token"          — dev / HTTP
//   - "__Secure-better-auth.session_token" — prod / HTTPS (useSecureCookies)
// Long tokens are stored as chunks: base-name, base-name.0, base-name.1 …
// We only need to confirm at least one chunk is present, not validate it.
// Actual session validation happens in requireUser() in the RSC layer.
const BA_PREFIXES = ["better-auth.session_token", "__Secure-better-auth.session_token"] as const;

function hasSessionCookie(request: NextRequest): boolean {
  return request.cookies.getAll().some(c =>
    BA_PREFIXES.some(p => c.name === p || c.name.startsWith(p + "."))
  );
}

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // Always let these through — they are not protected resources.
  if (
    pathname.startsWith("/api/auth") || // Better Auth handler
    pathname === "/login" ||            // Internal login page
    pathname === "/portal/login" ||     // Portal login page
    pathname === "/portal/register"     // Customer self-registration
  ) {
    return NextResponse.next();
  }

  // Short-circuit authenticated requests immediately.
  if (hasSessionCookie(request)) {
    return NextResponse.next();
  }

  // No session: redirect to login, preserving the intended destination
  // so the login page can send the user back after a successful sign-in.
  const loginUrl = new URL("/login", request.url);
  const destination = pathname + request.nextUrl.search;
  if (destination !== "/") {
    loginUrl.searchParams.set("callbackUrl", destination);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // Run on every request EXCEPT:
    //   _next/static — pre-compiled JS/CSS bundles
    //   _next/image  — Next.js image optimisation endpoint
    //   favicon.ico  — browser default favicon request
    //
    // NOTE: /uploads/ is intentionally NOT excluded. Employee photos and
    // documents are sensitive; unauthenticated users must not access them
    // even if they know the URL. The middleware redirects to /login.
    "/((?!_next/static|_next/image|favicon\\.ico).*)",
  ],
};
