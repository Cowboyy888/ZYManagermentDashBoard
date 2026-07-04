"use client";
import { useState, useTransition } from "react";
import { setPortalAccountStatus } from "@/actions/portal/admin";
import { useRouter } from "next/navigation";

type Account = {
  id: number;
  status: string;
  portalType: string;
  createdAt: Date;
  approvedAt: Date | null;
  user: { name: string; email: string; active: boolean };
  customer?: { name: string; customerCode: string; status: string } | null;
  supplier?: { name: string; supplierCode: string; status: string } | null;
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: "var(--amber)", ACTIVE: "var(--green)", SUSPENDED: "var(--red)",
};

export default function PortalAccountsClient({ accounts, type }: { accounts: Account[]; type: "CUSTOMER" | "SUPPLIER" }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function updateStatus(id: number, status: "ACTIVE" | "SUSPENDED" | "PENDING") {
    startTransition(async () => {
      await setPortalAccountStatus(id, status);
      router.refresh();
    });
  }

  return (
    <div className="panel">
      <div className="panel-body" style={{ padding: 0 }}>
        <table className="data-table" style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>User</th><th>{type === "CUSTOMER" ? "Customer" : "Supplier"}</th>
              <th>Status</th><th>Registered</th><th>Approved</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: "center", color: "var(--text-3)", padding: "2rem" }}>No portal accounts.</td></tr>
            )}
            {accounts.map(a => {
              const company = a.customer ?? a.supplier;
              return (
                <tr key={a.id}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{a.user.name}</div>
                    <div style={{ fontSize: 12, color: "var(--text-3)" }}>{a.user.email}</div>
                  </td>
                  <td>
                    {company ? (
                      <div>
                        <div style={{ fontWeight: 500 }}>{company.name}</div>
                        <div style={{ fontSize: 12, color: "var(--text-3)" }}>{(a.customer?.customerCode ?? a.supplier?.supplierCode) ?? ""}</div>
                      </div>
                    ) : "—"}
                  </td>
                  <td>
                    <span className="tag" style={{ background: STATUS_COLOR[a.status] + "22", color: STATUS_COLOR[a.status] }}>
                      {a.status}
                    </span>
                  </td>
                  <td>{new Date(a.createdAt).toLocaleDateString()}</td>
                  <td>{a.approvedAt ? new Date(a.approvedAt).toLocaleDateString() : "—"}</td>
                  <td>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      {a.status !== "ACTIVE" && (
                        <button onClick={() => updateStatus(a.id, "ACTIVE")} disabled={isPending} className="btn btn-sm" style={{ background: "var(--green)", color: "#fff", border: "none" }}>
                          Approve
                        </button>
                      )}
                      {a.status !== "SUSPENDED" && (
                        <button onClick={() => updateStatus(a.id, "SUSPENDED")} disabled={isPending} className="btn btn-sm" style={{ background: "var(--red)", color: "#fff", border: "none" }}>
                          Suspend
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
