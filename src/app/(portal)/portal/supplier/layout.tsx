import { requireSupplierUser } from "@/lib/auth/portal";
import PortalNav from "../PortalNav";

export default async function SupplierPortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSupplierUser();

  const navItems = [
    { href: "/portal/supplier", label: "Dashboard", icon: "⊞" },
    { href: "/portal/supplier/orders", label: "Purchase Orders", icon: "📋" },
    { href: "/portal/supplier/deliveries", label: "Deliveries", icon: "🚚" },
    { href: "/portal/supplier/payments", label: "Payments", icon: "💳" },
    { href: "/portal/supplier/performance", label: "Performance", icon: "📈" },
    { href: "/portal/supplier/messages", label: "Messages", icon: "💬" },
    { href: "/portal/supplier/profile", label: "Profile", icon: "🏢" },
  ];

  return (
    <PortalNav
      user={{ name: user.name, companyName: user.companyName, role: "Supplier" }}
      navItems={navItems}
    >
      {children}
    </PortalNav>
  );
}
