"use server";
import { prisma } from "@/lib/db";
import { guard } from "@/lib/auth/session";

export async function listPositions() {
  await guard("employee.read");
  return prisma.position.findMany({ orderBy: [{ level: "asc" }, { name: "asc" }] });
}

export async function listFactoryAreas() {
  await guard("employee.read");
  return prisma.factoryArea.findMany({ orderBy: { code: "asc" } });
}

export async function listDepartments() {
  await guard("employee.read");
  return prisma.department.findMany({ orderBy: { name: "asc" } });
}
