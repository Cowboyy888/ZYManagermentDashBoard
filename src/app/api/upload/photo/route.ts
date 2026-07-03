import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import { put } from "@vercel/blob";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!can(user.role, "employee.update")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const employeeId = formData.get("employeeId");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!employeeId) {
      return NextResponse.json({ error: "employeeId required" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Only JPEG, PNG, WebP images are allowed" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > MAX_SIZE) {
      return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 400 });
    }

    // Resize to max 800×800, convert to JPEG @ 85% quality — always output .jpg
    const optimized = await sharp(buffer)
      .resize(800, 800, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85, progressive: true })
      .toBuffer();

    const filename = `employees/emp-${employeeId}-${Date.now()}.jpg`;
    const blob = await put(filename, optimized, {
      access: "public",
      contentType: "image/jpeg",
    });

    return NextResponse.json({ ok: true, url: blob.url });
  } catch (e) {
    console.error("Photo upload error:", e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
