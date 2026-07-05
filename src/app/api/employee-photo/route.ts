import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";

const BLOB_HOST_SUFFIX = ".blob.vercel-storage.com";

export async function GET(req: NextRequest) {
  try {
    // Use req.headers directly — avoids next/headers() issues inside image-load Route Handlers
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      console.warn("[employee-photo] 401 — no valid session");
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const rawUrl = req.nextUrl.searchParams.get("url");
    if (!rawUrl) return new NextResponse("Missing url param", { status: 400 });

    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return new NextResponse("Invalid URL", { status: 400 });
    }
    if (!parsed.hostname.endsWith(BLOB_HOST_SUFFIX)) {
      return new NextResponse("URL not allowed", { status: 403 });
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      console.error("[employee-photo] BLOB_READ_WRITE_TOKEN not set");
      return new NextResponse("Storage not configured", { status: 503 });
    }

    console.log(`[employee-photo] user=${session.user.id} fetching ${rawUrl.slice(0, 80)}`);

    const upstream = await fetch(rawUrl, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    console.log(`[employee-photo] blob status=${upstream.status} type=${upstream.headers.get("content-type")}`);

    if (!upstream.ok) {
      console.error(`[employee-photo] blob fetch failed: ${upstream.status} ${upstream.statusText}`);
      return new NextResponse("Photo not found", { status: upstream.status });
    }

    // Buffer to avoid ReadableStream piping issues in serverless functions
    const data = await upstream.arrayBuffer();
    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";

    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=86400, stale-while-revalidate=3600",
      },
    });
  } catch (err) {
    console.error("[employee-photo] unexpected error:", err);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
