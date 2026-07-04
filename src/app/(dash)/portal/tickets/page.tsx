import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { listAdminTickets } from "@/actions/portal/admin";
import Link from "next/link";

const STATUS_COLOR: Record<string, string> = { OPEN: "var(--green)", IN_PROGRESS: "var(--blue)", CLOSED: "var(--text-3)" };
const PRIORITY_COLOR: Record<string, string> = { LOW: "var(--text-3)", NORMAL: "var(--blue)", HIGH: "var(--amber)", URGENT: "var(--red)" };

export default async function AdminTicketsPage() {
  const user = await requireUser();
  if (!can(user.role, "portal.manage")) redirect("/");

  const res = await listAdminTickets();
  const tickets = res.ok ? res.data : [];

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 1.5rem" }}>Support Tickets</h1>
      <div className="panel">
        <div className="panel-body" style={{ padding: 0 }}>
          <table className="data-table" style={{ width: "100%" }}>
            <thead>
              <tr><th>Ticket #</th><th>Customer</th><th>Subject</th><th>Priority</th><th>Status</th><th>Messages</th><th>Created</th><th>Assigned To</th></tr>
            </thead>
            <tbody>
              {tickets.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: "center", color: "var(--text-3)", padding: "2rem" }}>No open tickets.</td></tr>
              )}
              {tickets.map(t => (
                <tr key={t.id}>
                  <td style={{ fontWeight: 500, fontFamily: "monospace", fontSize: 13 }}>{t.ticketNumber}</td>
                  <td>{t.customer.name}</td>
                  <td style={{ maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.subject}</td>
                  <td><span className="tag" style={{ background: PRIORITY_COLOR[t.priority] + "22", color: PRIORITY_COLOR[t.priority] }}>{t.priority}</span></td>
                  <td><span className="tag" style={{ background: STATUS_COLOR[t.status] + "22", color: STATUS_COLOR[t.status] }}>{t.status}</span></td>
                  <td>{t._count.messages}</td>
                  <td>{new Date(t.createdAt).toLocaleDateString()}</td>
                  <td>{t.assignedTo?.name ?? <span style={{ color: "var(--text-3)" }}>Unassigned</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
