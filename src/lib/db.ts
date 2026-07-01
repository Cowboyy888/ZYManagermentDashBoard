// Prisma client singleton (arch §3.4 — edge-compatible at deploy).
// Local dev uses a standard connection. On Cloudflare Pages, swap the
// datasource URL to an HTTP/WS driver (Accelerate / Neon) via env — no code change.
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
