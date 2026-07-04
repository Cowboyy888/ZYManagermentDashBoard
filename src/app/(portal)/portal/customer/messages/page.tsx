import { getPortalThreads } from "@/actions/portal/messaging";
import MessagesClient from "./MessagesClient";

export default async function CustomerMessagesPage() {
  const res = await getPortalThreads();
  const threads = res.ok ? res.data : [];

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 1.5rem" }}>Messages</h1>
      <MessagesClient initialThreads={threads} />
    </div>
  );
}
