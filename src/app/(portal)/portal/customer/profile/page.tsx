import { getCustomerProfile } from "@/actions/portal/customer";
import ProfileClient from "./ProfileClient";

export default async function CustomerProfilePage() {
  const res = await getCustomerProfile();
  if (!res.ok) return <div style={{ color: "var(--red)" }}>Failed to load profile.</div>;

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 1.5rem" }}>Company Profile</h1>
      <ProfileClient profile={res.data} />
    </div>
  );
}
