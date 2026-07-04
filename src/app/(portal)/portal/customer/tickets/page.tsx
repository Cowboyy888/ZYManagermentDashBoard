import { getCustomerTickets } from "@/actions/portal/tickets";
import TicketsClient from "./TicketsClient";

export default async function CustomerTicketsPage() {
  const res = await getCustomerTickets();
  const tickets = res.ok ? res.data.items : [];

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 1.5rem" }}>Support Tickets</h1>
      <TicketsClient initialTickets={tickets} />
    </div>
  );
}
