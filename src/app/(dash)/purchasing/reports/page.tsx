import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { listPurchaseOrders, listGoodsReceipts, listSuppliers } from "@/actions/purchasing";
import { PurchasingReports } from "./PurchasingReports";

export const metadata: Metadata = { title: "Purchasing Reports" };

export default async function PurchasingReportsPage() {
  const user = await requireUser();

  const [poResult, grResult, suppResult] = await Promise.all([
    listPurchaseOrders(),
    listGoodsReceipts({ days: 90 }),
    listSuppliers(),
  ]);

  const orders = poResult.ok ? poResult.data.map((po) => ({
    id: po.id, poNumber: po.poNumber,
    supplierName: po.supplier.name, supplierCode: po.supplier.supplierCode,
    warehouseCode: po.warehouse?.code ?? null,
    status: po.status as string,
    orderDate: po.orderDate.toISOString(),
    expectedDelivery: po.expectedDelivery?.toISOString() ?? null,
    totalAmountUsd: Number(po.totalAmountUsd), currency: po.currency,
    itemCount: po.items.length, receiptCount: po._count.receipts,
    createdBy: po.createdBy.name, approvedBy: po.approvedBy?.name ?? null,
  })) : [];

  const receipts = grResult.ok ? grResult.data.map((r) => ({
    id: r.id.toString(), receiptNumber: r.receiptNumber,
    poNumber: r.po.poNumber, supplierName: r.po.supplier.name,
    warehouseCode: r.warehouse.code,
    status: r.status, receivedBy: r.receivedBy.name,
    receivedDate: r.receivedDate.toISOString(),
    itemCount: r.items.length,
    totalReceived: r.items.reduce((s, i) => s + Number(i.receivedQty), 0),
    totalRejected: r.items.reduce((s, i) => s + Number(i.rejectedQty), 0),
  })) : [];

  const suppliers = suppResult.ok ? suppResult.data.map((s) => ({
    id: s.id, supplierCode: s.supplierCode, name: s.name,
    status: s.status as string, orderCount: s._count.purchaseOrders,
    currency: s.currency, paymentTerms: s.paymentTerms,
  })) : [];

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Purchasing Reports</h1>
        <p style={{ fontSize: 13, color: "var(--text-3)", marginTop: 4 }}>Purchase order summaries, supplier performance, and spending analysis</p>
      </div>
      <PurchasingReports
        orders={orders}
        receipts={receipts}
        suppliers={suppliers}
        canExport={can(user.role, "report.export")}
      />
    </div>
  );
}
