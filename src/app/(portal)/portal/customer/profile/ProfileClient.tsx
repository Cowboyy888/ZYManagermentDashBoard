"use client";
import { useState, useTransition } from "react";
import { updateCustomerProfile } from "@/actions/portal/customer";

type Profile = {
  id: number; customerCode: string; name: string; contactPerson: string | null;
  phone: string | null; email: string | null; address: string | null;
  country: string; taxId: string | null; paymentTerms: string | null; status: string;
};

export default function ProfileClient({ profile }: { profile: Profile }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    contactPerson: profile.contactPerson ?? "",
    phone: profile.phone ?? "",
    address: profile.address ?? "",
    country: profile.country ?? "",
  });
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const res = await updateCustomerProfile({
        contactPerson: form.contactPerson || undefined,
        phone: form.phone || undefined,
        address: form.address || undefined,
        country: form.country || undefined,
      });
      if ("error" in res) {
        setMessage(res.error);
      } else {
        setEditing(false);
        setMessage("Profile updated successfully.");
      }
    });
  }

  const row = (label: string, value: string | null | undefined) => (
    <div style={{ display: "flex", borderBottom: "1px solid var(--border)", padding: "0.75rem 0" }}>
      <div style={{ width: 160, color: "var(--text-2)", fontSize: 14, flexShrink: 0 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 500 }}>{value || "—"}</div>
    </div>
  );

  return (
    <div>
      {message && (
        <div style={{ background: "var(--green-bg)", color: "var(--green)", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1rem", fontSize: 14 }}>
          {message}
        </div>
      )}

      {/* Read-only fields */}
      <div className="panel" style={{ marginBottom: "1rem" }}>
        <div className="panel-head">Company Information</div>
        <div className="panel-body">
          {row("Company Name", profile.name)}
          {row("Customer Code", profile.customerCode)}
          {row("Tax ID", profile.taxId)}
          {row("Payment Terms", profile.paymentTerms)}
          {row("Status", profile.status)}
        </div>
      </div>

      {/* Editable fields */}
      <div className="panel">
        <div className="panel-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>Contact Details</span>
          {!editing && (
            <button onClick={() => setEditing(true)} className="btn btn-sm">Edit</button>
          )}
        </div>
        <div className="panel-body">
          {editing ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {[
                { label: "Contact Person", field: "contactPerson" },
                { label: "Phone", field: "phone" },
                { label: "Country", field: "country" },
              ].map(({ label, field }) => (
                <div key={field}>
                  <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 4 }}>{label}</label>
                  <input
                    value={form[field as keyof typeof form]}
                    onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                    style={{ width: "100%", padding: "0.6rem", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, boxSizing: "border-box" }}
                  />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 13, fontWeight: 500, display: "block", marginBottom: 4 }}>Address</label>
                <textarea
                  value={form.address}
                  onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  rows={3}
                  style={{ width: "100%", padding: "0.6rem", border: "1px solid var(--border)", borderRadius: 8, fontSize: 14, boxSizing: "border-box", resize: "vertical" }}
                />
              </div>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button onClick={save} disabled={isPending} className="btn">Save Changes</button>
                <button onClick={() => setEditing(false)} style={{ padding: "0.5rem 1rem", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, cursor: "pointer" }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div>
              {row("Contact Person", profile.contactPerson)}
              {row("Phone", profile.phone)}
              {row("Email", profile.email)}
              {row("Address", profile.address)}
              {row("Country", profile.country)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
