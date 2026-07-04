import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { listPortalAccounts, setPortalAccountStatus } from "@/actions/portal/admin";
import PortalAccountsClient from "./PortalAccountsClient";

export default async function PortalCustomersPage() {
  const user = await requireUser();
  if (!can(user.role, "portal.manage")) redirect("/");

  const res = await listPortalAccounts("CUSTOMER");
  const accounts = res.ok ? res.data : [];

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 1.5rem" }}>Customer Portal Accounts</h1>
      <PortalAccountsClient accounts={accounts} type="CUSTOMER" />
    </div>
  );
}
