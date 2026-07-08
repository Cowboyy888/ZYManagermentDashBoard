import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";

const BLOB_HOST_SUFFIX = ".blob.vercel-storage.com";

export async function GET(req: NextRequest) {
  try {
    // Auth check — middleware bypasses this route so we validate here
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const rawUrl = req.nextUrl.searchParams.get("url");
    if (!rawUrl) return new NextResponse("Missing url param", { status: 400 });

    let parsed: URL;
    try { parsed = new URL(rawUrl); } catch { return new NextResponse("Invalid URL", { status: 400 }); }

    // SSRF guard — only allow Vercel Blob URLs
    if (!parsed.hostname.endsWith(BLOB_HOST_SUFFIX)) {
      return new NextResponse("URL not allowed", { status: 403 });
    }

    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) return new NextResponse("BLOB_READ_WRITE_TOKEN not set", { status: 503 });

    // Extract the blob pathname from the URL (strip leading /)
    // e.g. "https://recxxx.private.blob.vercel-storage.com/employees/emp-30-uuid.jpg"
    //   →  "employees/emp-30-uuid.jpg"
    const pathname = parsed.pathname.slice(1);

    // Issue a signed delegation token locked to this one blob, valid for 1 hour.
    // Then generate a presigned GET URL — the browser can fetch it directly without
    // the API token; Vercel validates the signature on its side.
    const { issueSignedToken, presignUrl } = await import("@vercel/blob");

    const signedToken = await issueSignedToken({
      token,
      pathname,
      validUntil: Date.now() + 60 * 60 * 1000, // 1 hour
    });

    const { presignedUrl } = await presignUrl(signedToken, {
      operation: "get",
      pathname,
      access: "private",
    });

    // Redirect the browser to the presigned Vercel Blob URL — the image loads directly.
    // 307 is not cached by browsers, so a fresh presigned URL is always issued.
    return NextResponse.redirect(presignedUrl, { status: 307 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[employee-photo] error:", msg);
    return new NextResponse(`Error: ${msg}`, { status: 500 });
  }
}
