import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { CardView } from "./CardView";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id: idStr } = await params;
  return { title: `ID Card #${idStr}` };
}

export default async function CardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) notFound();

  await requireUser();

  const emp = await prisma.employee.findUnique({
    where: { id },
    select: {
      id: true,
      nameEn: true,
      nameKh: true,
      nameZh: true,
      employeeCode: true,
      photoUrl: true,
      hireDate: true,
      phone: true,
      shift: true,
      department: { select: { name: true } },
      position: { select: { name: true } },
      factoryArea: { select: { code: true } },
    },
  });

  if (!emp) notFound();

  return (
    <CardView
      emp={{
        ...emp,
        hireDate: emp.hireDate.toISOString(),
      }}
    />
  );
}
