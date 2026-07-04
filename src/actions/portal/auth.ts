"use server";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth/config";
import { headers } from "next/headers";
import { requirePortalUser } from "@/lib/auth/portal";

type AR<T> = { ok: true; data: T } | { ok: false; error: string };
function ok<T>(data: T): AR<T> { return { ok: true, data }; }
function err(e: unknown): AR<never> {
  return { ok: false, error: e instanceof Error ? e.message : String(e) };
}

/** Customer self-registration. Status defaults to PENDING; requires HR approval. */
export async function registerCustomerPortal(input: {
  name: string;
  email: string;
  password: string;
  companyName: string;
  phone?: string;
  country?: string;
}): Promise<AR<{ message: string }>> {
  try {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) return { ok: false, error: "Email already registered." };

    // Create Better Auth user via API
    const res = await auth.api.signUpEmail({
      body: {
        email: input.email,
        password: input.password,
        name: input.name,
        role: "CUSTOMER_PORTAL",
      },
    });

    if (!res?.user?.id) return { ok: false, error: "Registration failed." };

    // Find or create Customer record
    let customer = await prisma.customer.findFirst({
      where: { name: { equals: input.companyName, mode: "insensitive" } },
    });
    if (!customer) {
      const count = await prisma.customer.count();
      customer = await prisma.customer.create({
        data: {
          customerCode: `CUST-${String(count + 1).padStart(4, "0")}`,
          name: input.companyName,
          contactPerson: input.name,
          phone: input.phone ?? null,
          country: input.country ?? "Cambodia",
          status: "ACTIVE",
        },
      });
    }

    // Create portal account (PENDING — requires approval)
    await prisma.portalAccount.create({
      data: {
        userId: res.user.id,
        portalType: "CUSTOMER",
        customerId: customer.id,
        status: "PENDING",
      },
    });

    return ok({ message: "Registration submitted. You will be notified when approved." });
  } catch (e) {
    return err(e);
  }
}

/** Get the current portal user's profile info. */
export async function getPortalProfile(): Promise<AR<{
  name: string;
  email: string;
  companyName: string;
  role: string;
}>> {
  try {
    const u = await requirePortalUser();
    return ok({
      name: u.name,
      email: u.email,
      companyName: u.companyName,
      role: u.role,
    });
  } catch (e) {
    return err(e);
  }
}

/** Internal: approve or suspend a portal account. */
export async function setPortalAccountStatus(
  portalAccountId: number,
  status: "ACTIVE" | "SUSPENDED" | "PENDING"
): Promise<AR<undefined>> {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (!session?.user) return { ok: false, error: "Not authenticated" };
    const actor = session.user as { role?: string };
    if (actor.role !== "OWNER" && actor.role !== "HR_MANAGER") {
      return { ok: false, error: "Forbidden" };
    }
    await prisma.portalAccount.update({
      where: { id: portalAccountId },
      data: {
        status,
        approvedAt: status === "ACTIVE" ? new Date() : undefined,
      },
    });
    return ok(undefined);
  } catch (e) {
    return err(e);
  }
}
