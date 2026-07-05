import { NextRequest, NextResponse } from "next/server";

// Middleware enforces authentication before this handler runs.
// This proxy exists solely to serve private Vercel Blob photos to authenticated clients.
const BLOB_HOST_SUFFIX = ".blob.vercel-storage.com";

export async function GET(req: NextRequest) {
  try {
    const rawUrl = req.nextUrl.searchParams.get("url");
    if (!rawUrl) return new NextResponse("Missing url param", { status: 400 });

    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return new NextResponse("Invalid URL", { status: 400 });
    }

    // SSRF guard — only allow Vercel Blob URLs (covers *.public.blob.*, *.private.blob.*, etc.)
    if (!parsed.hostname.endsWith(BLOB_HOST_SUFFIX)) {
      return new NextResponse("URL not allowed", { status: 403 });
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      console.error("[employee-photo] BLOB_READ_WRITE_TOKEN not set");
      return new NextResponse("Storage not configured", { status: 503 });
    }

    console.log(`[employee-photo] fetching ${rawUrl.slice(0, 80)}`);

    // Use the official @vercel/blob SDK to read private blobs — raw fetch with
    // Authorization header does not work for private store URLs.
    const { get } = await import("@vercel/blob");
    const result = await get(rawUrl, { access: "private", token });

    if (!result || !result.stream) {
      console.error(`[employee-photo] blob not found or empty: ${rawUrl.slice(0, 80)}`);
      return new NextResponse("Photo not found", { status: 404 });
    }

    console.log(`[employee-photo] blob found, contentType=${result.blob.contentType}`);

    // Collect the ReadableStream into a Buffer
    const reader = result.stream.getReader();
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) chunks.push(value);
    }
    const buffer = Buffer.concat(chunks);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": result.blob.contentType ?? "image/jpeg",
        "Cache-Control": "private, max-age=86400, stale-while-revalidate=3600",
      },
    });
  } catch (err) {
    console.error("[employee-photo] error:", err);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
