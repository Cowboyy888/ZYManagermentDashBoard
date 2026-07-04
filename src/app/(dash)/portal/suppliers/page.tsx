import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { listPortalAccounts } from "@/actions/portal/admin";
import PortalAccountsClient from "../customers/PortalAccountsClient";

export default async function PortalSuppliersPage() {
  const user = await requireUser();
  if (!can(user.role, "portal.manage")) redirect("/");

  const res = await listPortalAccounts("SUPPLIER");
  const accounts = res.ok ? res.data : [];

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 1.5rem" }}>Supplier Portal Accounts</h1>
      <PortalAccountsClient accounts={accounts} type="SUPPLIER" />
    </div>
  );
}
