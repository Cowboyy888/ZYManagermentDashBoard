import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getSessionUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
// image/jpg is non-standard but some browsers/devices send it
const ALLOWED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);

// Magic byte signatures — validate actual file content, not just content-type header
const MAGIC_SIGNATURES = [
  { sig: [0xff, 0xd8, 0xff],                           mime: "image/jpeg" },
  { sig: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], mime: "image/png"  },
  // WebP: RIFF....WEBP — check bytes 0-3 and 8-11
] as const;

function validateMagicBytes(buf: Buffer): boolean {
  for (const { sig } of MAGIC_SIGNATURES) {
    if (sig.every((b, i) => buf[i] === b)) return true;
  }
  // WebP: RIFF at 0-3, WEBP at 8-11
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return true;
  return false;
}

// Sanitise filename — strip path traversal, keep only safe chars
function safeFilename(employeeId: string): string {
  const id = employeeId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 20);
  return `emp-${id}-${randomUUID()}.jpg`;
}

export async function POST(req: NextRequest) {
  try {
    // Use getSessionUser (not requireUser) — redirect() inside try/catch causes 500 in route handlers
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    if (!can(user.role, "employee.update")) {
      return NextResponse.json({ error: "Forbidden — your role cannot update employees" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const employeeIdRaw = formData.get("employeeId");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!employeeIdRaw || typeof employeeIdRaw !== "string") {
      return NextResponse.json({ error: "employeeId required" }, { status: 400 });
    }

    // Validate declared MIME type
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Only JPEG, PNG, or WebP images are allowed" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    console.log(`[photo-upload] user=${user.id} role=${user.role} empId=${employeeIdRaw} type=${file.type} size=${buffer.length} blobToken=${!!process.env.BLOB_READ_WRITE_TOKEN}`);

    // Validate file size
    if (buffer.length > MAX_SIZE) {
      return NextResponse.json({ error: "File too large (max 10 MB)" }, { status: 400 });
    }

    // Validate actual file content via magic bytes (rejects renamed executables)
    if (!validateMagicBytes(buffer)) {
      return NextResponse.json({ error: "File content does not match a valid image" }, { status: 400 });
    }

    // Resize to max 800×800, always output JPEG @ 85% quality
    const sharp = (await import("sharp")).default;
    const optimized = await sharp(buffer)
      .resize(800, 800, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85, progressive: true })
      .toBuffer();

    const filename = safeFilename(employeeIdRaw);
    let url: string;

    if (process.env.BLOB_READ_WRITE_TOKEN) {
      // Production path: Vercel Blob (requires BLOB_READ_WRITE_TOKEN in env)
      const { put } = await import("@vercel/blob");
      const blob = await put(`employees/${filename}`, optimized, {
        access: "public",
        contentType: "image/jpeg",
      });
      url = blob.url;
    } else if (process.env.NODE_ENV !== "production") {
      // Development path: local filesystem under public/uploads/employees/
      const { writeFile, mkdir } = await import("fs/promises");
      const { join } = await import("path");
      const uploadDir = join(process.cwd(), "public", "uploads", "employees");
      await mkdir(uploadDir, { recursive: true });
      await writeFile(join(uploadDir, filename), optimized);
      url = `/uploads/employees/${filename}`;
    } else {
      // Production without blob token — fail with actionable message
      console.error("BLOB_READ_WRITE_TOKEN is not set. Add it in Vercel → Settings → Environment Variables.");
      return NextResponse.json(
        { error: "Photo storage is not configured. Contact your administrator." },
        { status: 503 }
      );
    }

    return NextResponse.json({ ok: true, url });
  } catch (e) {
    console.error("Photo upload error:", e);
    const msg = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
