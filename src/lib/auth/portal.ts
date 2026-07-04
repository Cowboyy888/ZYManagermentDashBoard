// Portal-specific session helpers. Portal users have role CUSTOMER_PORTAL or
// SUPPLIER_PORTAL and are always linked to a PortalAccount record.
import { redirect } from "next/navigation";
import { getSessionUser } from "./session";
import { prisma } from "../db";

export interface PortalSessionUser {
  id: string;
  email: string;
  name: string;
  role: "CUSTOMER_PORTAL" | "SUPPLIER_PORTAL";
  // resolved from PortalAccount
  portalAccountId: number;
  customerId: number | null;
  supplierId: number | null;
  companyName: string;
}

export async function getPortalUser(): Promise<PortalSessionUser | null> {
  const u = await getSessionUser();
  if (!u) return null;
  if (u.role !== "CUSTOMER_PORTAL" && u.role !== "SUPPLIER_PORTAL") return null;

  const pa = await prisma.portalAccount.findUnique({
    where: { userId: u.id },
    include: {
      customer: { select: { id: true, name: true } },
      supplier: { select: { id: true, name: true } },
    },
  });
  if (!pa || pa.status !== "ACTIVE") return null;

  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role as "CUSTOMER_PORTAL" | "SUPPLIER_PORTAL",
    portalAccountId: pa.id,
    customerId: pa.customerId ?? null,
    supplierId: pa.supplierId ?? null,
    companyName: pa.customer?.name ?? pa.supplier?.name ?? u.name,
  };
}

/** Require an active portal user or redirect to portal login. */
export async function requirePortalUser(): Promise<PortalSessionUser> {
  const u = await getPortalUser();
  if (!u) redirect("/portal/login");
  return u;
}

/** Require specifically a customer portal user. */
export async function requireCustomerUser(): Promise<PortalSessionUser & { customerId: number }> {
  const u = await requirePortalUser();
  if (u.role !== "CUSTOMER_PORTAL" || !u.customerId) redirect("/portal/login");
  return u as PortalSessionUser & { customerId: number };
}

/** Require specifically a supplier portal user. */
export async function requireSupplierUser(): Promise<PortalSessionUser & { supplierId: number }> {
  const u = await requirePortalUser();
  if (u.role !== "SUPPLIER_PORTAL" || !u.supplierId) redirect("/portal/login");
  return u as PortalSessionUser & { supplierId: number };
}
