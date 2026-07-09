import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";

const MAX_SIZE = 20 * 1024 * 1024; // 20 MB
const ALLOWED_TYPES = new Set([
  "image/jpeg", "image/png", "image/webp",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    if (!can(user.role, "employee.update")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!checkRateLimit(user.id, "doc-upload", 30, 60 * 60 * 1000)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const employeeId = Number(formData.get("employeeId"));
    const docType = String(formData.get("type") ?? "OTHER");
    const expiryDate = formData.get("expiryDate") ? String(formData.get("expiryDate")) : null;
    const notes = formData.get("notes") ? String(formData.get("notes")) : null;

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!employeeId) {
      return NextResponse.json({ error: "employeeId required" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    if (buffer.length > MAX_SIZE) {
      return NextResponse.json({ error: "File too large (max 20 MB)" }, { status: 400 });
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const blobPath = `documents/doc-${employeeId}-${Date.now()}-${safeName}`;

    const blob = await put(blobPath, buffer, {
      access: "public",
      contentType: file.type,
    });

    const doc = await prisma.employeeDocument.create({
      data: {
        employeeId,
        type: docType as never,
        filename: file.name,
        url: blob.url,
        fileSize: buffer.length,
        mimeType: file.type,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        notes,
        uploadedById: user.id,
      },
    });

    return NextResponse.json({ ok: true, doc });
  } catch (e) {
    console.error("Document upload error:", e);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
