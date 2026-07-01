import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "documents");
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
    const filename = `doc-${employeeId}-${Date.now()}-${safeName}`;

    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(path.join(UPLOAD_DIR, filename), buffer);

    const url = `/uploads/documents/${filename}`;
    const doc = await prisma.employeeDocument.create({
      data: {
        employeeId,
        type: docType as never,
        filename: file.name,
        url,
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
