import { getPortalAnnouncements } from "@/actions/portal/announcements";

export default async function CustomerAnnouncementsPage() {
  const res = await getPortalAnnouncements();
  const announcements = res.ok ? res.data : [];

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 1.5rem" }}>Announcements</h1>
      {announcements.length === 0 ? (
        <div className="panel" style={{ padding: "3rem", textAlign: "center", color: "var(--text-3)" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📢</div>
          <div>No announcements at this time.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {announcements.map(a => (
            <div key={a.id} className="panel">
              <div className="panel-head" style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{a.title}</span>
                <span style={{ fontSize: 12, color: "var(--text-3)", fontWeight: 400 }}>
                  {a.publishedAt ? new Date(a.publishedAt).toLocaleDateString() : ""}
                  {a.expiresAt ? ` · Expires ${new Date(a.expiresAt).toLocaleDateString()}` : ""}
                </span>
              </div>
              <div className="panel-body">
                <p style={{ margin: 0, fontSize: 14, color: "var(--text-2)", whiteSpace: "pre-wrap" }}>{a.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
