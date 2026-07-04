import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { listAnnouncements } from "@/actions/portal/announcements";
import AnnouncementsClient from "./AnnouncementsClient";

export default async function AdminAnnouncementsPage() {
  const user = await requireUser();
  if (!can(user.role, "portal.manage")) redirect("/");

  const res = await listAnnouncements();
  const announcements = res.ok ? res.data : [];

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 1.5rem" }}>Portal Announcements</h1>
      <AnnouncementsClient announcements={announcements} />
    </div>
  );
}
