import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { getPayslipDetail } from "@/actions/payroll";
import { PayslipView } from "./PayslipView";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Payslip #${id}` };
}

export default async function PayslipPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUser();

  const res = await getPayslipDetail(id);
  if (!res.ok) notFound();

  return <PayslipView slip={res.data} />;
}
