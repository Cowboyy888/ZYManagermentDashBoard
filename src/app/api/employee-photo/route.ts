import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";

const BLOB_HOST_SUFFIX = ".blob.vercel-storage.com";

export async function GET(req: NextRequest) {
  // Require auth — employee photos are internal
  const user = await getSessionUser();
  if (!user) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const rawUrl = req.nextUrl.searchParams.get("url");
  if (!rawUrl) {
    return new NextResponse("Missing url param", { status: 400 });
  }

  // Validate it's actually a Vercel Blob URL (prevents SSRF)
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return new NextResponse("Invalid URL", { status: 400 });
  }
  if (!parsed.hostname.endsWith(BLOB_HOST_SUFFIX)) {
    return new NextResponse("URL not allowed", { status: 400 });
  }

  // Fetch the private blob from Vercel using the server-side token
  const upstream = await fetch(rawUrl, {
    headers: {
      Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}`,
    },
    // Don't cache the upstream fetch — we cache the response ourselves below
    cache: "no-store",
  });

  if (!upstream.ok) {
    return new NextResponse("Photo not found", { status: upstream.status });
  }

  const contentType = upstream.headers.get("Content-Type") ?? "image/jpeg";

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      // Cache in the browser for 1 day; private so CDN won't cache it
      "Cache-Control": "private, max-age=86400, stale-while-revalidate=3600",
    },
  });
}
