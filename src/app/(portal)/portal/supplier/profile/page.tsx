import { getSupplierProfile } from "@/actions/portal/supplier";
import SupplierProfileClient from "./SupplierProfileClient";

export default async function SupplierProfilePage() {
  const res = await getSupplierProfile();
  if (!res.ok) return <div style={{ color: "var(--red)" }}>Failed to load profile.</div>;
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 1.5rem" }}>Company Profile</h1>
      <SupplierProfileClient profile={res.data} />
    </div>
  );
}
