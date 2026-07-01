// Better Auth configuration (arch §4). Session-based auth backed by Prisma.
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "../db";

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
  },
  session: {
    expiresIn: 60 * 60 * 8,        // 8h working day
    updateAge: 60 * 60,            // refresh hourly
  },
  // Roles live on the User model; exposed in the session for RBAC.
  user: {
    additionalFields: {
      role: { type: "string", required: true, defaultValue: "VIEWER" },
      departmentId: { type: "number", required: false },
    },
  },
  // CSRF/origin protection + Turnstile verified at the login route (arch §4).
  trustedOrigins: [process.env.AUTH_URL ?? "http://localhost:3000"],
});

export type Auth = typeof auth;
