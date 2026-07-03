import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { getNotifications } from "@/actions/notifications";
import { NotificationsList } from "./NotificationsList";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  await requireUser();
  const result = await getNotifications({ limit: 100 });
  const notifications = "error" in result ? [] : result.data;

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Notifications</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>
          In-app alerts from workflow events, scheduled checks, and system reminders
        </p>
      </div>
      <NotificationsList initial={notifications} />
    </div>
  );
}
