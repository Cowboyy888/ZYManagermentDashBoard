import { requireCustomerUser } from "@/lib/auth/portal";
import PortalNav from "../PortalNav";

export default async function CustomerPortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireCustomerUser();

  const navItems = [
    { href: "/portal/customer", label: "Dashboard", icon: "⊞" },
    { href: "/portal/customer/quotations", label: "Quotations", icon: "📋" },
    { href: "/portal/customer/orders", label: "Orders", icon: "📦" },
    { href: "/portal/customer/deliveries", label: "Deliveries", icon: "🚚" },
    { href: "/portal/customer/invoices", label: "Invoices", icon: "🧾" },
    { href: "/portal/customer/certificates", label: "Certificates", icon: "📜" },
    { href: "/portal/customer/messages", label: "Messages", icon: "💬" },
    { href: "/portal/customer/tickets", label: "Support", icon: "🎫" },
    { href: "/portal/customer/announcements", label: "Announcements", icon: "📢" },
    { href: "/portal/customer/profile", label: "Profile", icon: "🏢" },
  ];

  return (
    <PortalNav
      user={{ name: user.name, companyName: user.companyName, role: "Customer" }}
      navItems={navItems}
    >
      {children}
    </PortalNav>
  );
}
