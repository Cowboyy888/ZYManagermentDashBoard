import { NextRequest, NextResponse } from "next/server";

const BLOB_HOST_SUFFIX = ".blob.vercel-storage.com";

export async function GET(req: NextRequest) {
  // Step 1: validate URL
  const rawUrl = req.nextUrl.searchParams.get("url");
  if (!rawUrl) return new NextResponse("Missing url param", { status: 400 });

  let parsed: URL;
  try { parsed = new URL(rawUrl); } catch { return new NextResponse("Invalid URL", { status: 400 }); }
  if (!parsed.hostname.endsWith(BLOB_HOST_SUFFIX)) {
    return new NextResponse("URL not allowed", { status: 403 });
  }

  // Step 2: check token
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) return new NextResponse("BLOB_READ_WRITE_TOKEN not set", { status: 503 });

  // Step 3: fetch blob — return the real error if it fails
  try {
    const res = await fetch(rawUrl, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return new NextResponse(
        `Blob fetch failed: ${res.status} ${res.statusText} — ${body.slice(0, 300)}`,
        { status: 502 }
      );
    }
    const data = await res.arrayBuffer();
    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": res.headers.get("Content-Type") ?? "image/jpeg",
        "Cache-Control": "private, max-age=86400, stale-while-revalidate=3600",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new NextResponse(`Fetch threw: ${msg}`, { status: 500 });
  }
}
