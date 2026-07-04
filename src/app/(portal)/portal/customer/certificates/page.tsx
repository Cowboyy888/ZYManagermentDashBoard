import { getCustomerCertificates } from "@/actions/portal/customer";
import { logDocumentDownload } from "@/actions/portal/documents";

const CERT_TYPE_LABEL: Record<string, string> = {
  COC: "Certificate of Conformance",
  TEST_REPORT: "Test Report",
  INSPECTION_CERT: "Inspection Certificate",
};

export default async function CustomerCertificatesPage() {
  const res = await getCustomerCertificates();
  if (!res.ok) return <div style={{ color: "var(--red)" }}>Failed to load certificates.</div>;
  const { items } = res.data;

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: "0 0 1.5rem" }}>Quality Certificates</h1>
      <div className="panel">
        <div className="panel-body" style={{ padding: 0 }}>
          <table className="data-table" style={{ width: "100%" }}>
            <thead>
              <tr><th>Certificate #</th><th>Type</th><th>Product</th><th>Batch #</th><th>Issued</th><th>Valid Until</th><th>Order</th></tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--text-3)", padding: "2rem" }}>No certificates yet.</td></tr>
              )}
              {items.map(cert => (
                <tr key={cert.id}>
                  <td style={{ fontWeight: 500, fontFamily: "monospace", fontSize: 13 }}>{cert.certificateNumber}</td>
                  <td><span className="tag">{CERT_TYPE_LABEL[cert.type] ?? cert.type}</span></td>
                  <td style={{ maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {cert.productDescription ?? "—"}
                  </td>
                  <td style={{ fontFamily: "monospace", fontSize: 13 }}>{cert.batchNumber ?? "—"}</td>
                  <td>{new Date(cert.issuedDate).toLocaleDateString()}</td>
                  <td>{cert.validUntil ? new Date(cert.validUntil).toLocaleDateString() : "—"}</td>
                  <td>{cert.salesOrder ? <a href={`/portal/customer/orders/${cert.salesOrder.id}`} style={{ color: "var(--steel)" }}>{cert.salesOrder.orderNumber}</a> : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
