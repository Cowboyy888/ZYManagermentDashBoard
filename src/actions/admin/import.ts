"use server";

import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { z } from "zod";

export type ImportError = { row: number; field: string; message: string };
export type ImportResult = {
  imported: number;
  skipped: number;
  errors: ImportError[];
};

// ─── CSV parser ───────────────────────────────────────────────────────────────
// Lightweight RFC-4180 parser — avoids a client library in a server action.

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const nonEmpty = lines.filter(l => l.trim().length > 0);
  if (nonEmpty.length < 2) return [];

  const headers = splitCsvRow(nonEmpty[0]).map(h => h.trim().toLowerCase().replace(/\s+/g, "_"));

  return nonEmpty.slice(1).map(line => {
    const values = splitCsvRow(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (values[i] ?? "").trim(); });
    return row;
  });
}

function splitCsvRow(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

async function getFileText(formData: FormData): Promise<string | null> {
  const file = formData.get("file");
  if (!file || typeof file === "string") return null;
  return file.text();
}

// ─── Departments ──────────────────────────────────────────────────────────────

const DeptRow = z.object({
  name:        z.string().min(1, "required"),
  name_kh:     z.string().optional(),
  code:        z.string().optional(),
  description: z.string().optional(),
});

export async function importDepartments(formData: FormData): Promise<ImportResult> {
  const user = await requireUser();
  if (!can(user.role, "employee.create")) throw new Error("Forbidden");

  const text = await getFileText(formData);
  if (!text) return { imported: 0, skipped: 0, errors: [{ row: 0, field: "file", message: "No file uploaded" }] };

  const rows = parseCsv(text);
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const parsed = DeptRow.safeParse(rows[i]);
    if (!parsed.success) {
      parsed.error.issues.forEach(iss => {
        result.errors.push({ row: rowNum, field: iss.path.join("."), message: iss.message });
      });
      result.skipped++;
      continue;
    }
    const { name, name_kh, code, description } = parsed.data;
    try {
      await prisma.department.upsert({
        where: { name },
        update: { nameKh: name_kh ?? null, code: code || null, description: description || null },
        create: { name, nameKh: name_kh ?? null, code: code || null, description: description || null },
      });
      result.imported++;
    } catch (e) {
      result.errors.push({ row: rowNum, field: "name", message: e instanceof Error ? e.message : "Insert failed" });
      result.skipped++;
    }
  }
  return result;
}

// ─── Positions ────────────────────────────────────────────────────────────────

const PosRow = z.object({
  name:        z.string().min(1, "required"),
  code:        z.string().optional(),
  level:       z.coerce.number().int().min(1).max(4).default(1),
  description: z.string().optional(),
});

export async function importPositions(formData: FormData): Promise<ImportResult> {
  const user = await requireUser();
  if (!can(user.role, "employee.create")) throw new Error("Forbidden");

  const text = await getFileText(formData);
  if (!text) return { imported: 0, skipped: 0, errors: [{ row: 0, field: "file", message: "No file uploaded" }] };

  const rows = parseCsv(text);
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const parsed = PosRow.safeParse(rows[i]);
    if (!parsed.success) {
      parsed.error.issues.forEach(iss => {
        result.errors.push({ row: rowNum, field: String(iss.path[0] ?? ""), message: iss.message });
      });
      result.skipped++;
      continue;
    }
    const { name, code, level, description } = parsed.data;
    try {
      await prisma.position.upsert({
        where: { name },
        update: { code: code || null, level, description: description || null },
        create: { name, code: code || null, level, description: description || null },
      });
      result.imported++;
    } catch (e) {
      result.errors.push({ row: rowNum, field: "name", message: e instanceof Error ? e.message : "Insert failed" });
      result.skipped++;
    }
  }
  return result;
}

// ─── Customers ────────────────────────────────────────────────────────────────

const CustRow = z.object({
  customer_code:    z.string().min(1, "required"),
  name:             z.string().min(1, "required"),
  contact_person:   z.string().optional(),
  phone:            z.string().optional(),
  email:            z.string().optional(),
  address:          z.string().optional(),
  country:          z.string().default("Cambodia"),
  tax_id:           z.string().optional(),
  payment_terms:    z.string().optional(),
  credit_limit_usd: z.coerce.number().optional(),
});

export async function importCustomers(formData: FormData): Promise<ImportResult> {
  const user = await requireUser();
  if (!can(user.role, "sales.manage")) throw new Error("Forbidden");

  const text = await getFileText(formData);
  if (!text) return { imported: 0, skipped: 0, errors: [{ row: 0, field: "file", message: "No file uploaded" }] };

  const rows = parseCsv(text);
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const parsed = CustRow.safeParse(rows[i]);
    if (!parsed.success) {
      parsed.error.issues.forEach(iss => {
        result.errors.push({ row: rowNum, field: String(iss.path[0] ?? ""), message: iss.message });
      });
      result.skipped++;
      continue;
    }
    const d = parsed.data;
    try {
      await prisma.customer.upsert({
        where: { customerCode: d.customer_code },
        update: {
          name: d.name, contactPerson: d.contact_person || null, phone: d.phone || null,
          email: d.email || null, address: d.address || null, country: d.country,
          taxId: d.tax_id || null, paymentTerms: d.payment_terms || null,
          creditLimitUsd: d.credit_limit_usd ?? null,
        },
        create: {
          customerCode: d.customer_code, name: d.name, contactPerson: d.contact_person || null,
          phone: d.phone || null, email: d.email || null, address: d.address || null,
          country: d.country, taxId: d.tax_id || null, paymentTerms: d.payment_terms || null,
          creditLimitUsd: d.credit_limit_usd ?? null,
        },
      });
      result.imported++;
    } catch (e) {
      result.errors.push({ row: rowNum, field: "customer_code", message: e instanceof Error ? e.message : "Insert failed" });
      result.skipped++;
    }
  }
  return result;
}

// ─── Suppliers ────────────────────────────────────────────────────────────────

const SuppRow = z.object({
  supplier_code:  z.string().min(1, "required"),
  name:           z.string().min(1, "required"),
  contact_person: z.string().optional(),
  phone:          z.string().optional(),
  email:          z.string().optional(),
  address:        z.string().optional(),
  tax_id:         z.string().optional(),
  payment_terms:  z.string().optional(),
  currency:       z.string().default("USD"),
});

export async function importSuppliers(formData: FormData): Promise<ImportResult> {
  const user = await requireUser();
  if (!can(user.role, "purchasing.manage")) throw new Error("Forbidden");

  const text = await getFileText(formData);
  if (!text) return { imported: 0, skipped: 0, errors: [{ row: 0, field: "file", message: "No file uploaded" }] };

  const rows = parseCsv(text);
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const parsed = SuppRow.safeParse(rows[i]);
    if (!parsed.success) {
      parsed.error.issues.forEach(iss => {
        result.errors.push({ row: rowNum, field: String(iss.path[0] ?? ""), message: iss.message });
      });
      result.skipped++;
      continue;
    }
    const d = parsed.data;
    try {
      await prisma.supplier.upsert({
        where: { supplierCode: d.supplier_code },
        update: {
          name: d.name, contactPerson: d.contact_person || null, phone: d.phone || null,
          email: d.email || null, address: d.address || null, taxId: d.tax_id || null,
          paymentTerms: d.payment_terms || null, currency: d.currency,
        },
        create: {
          supplierCode: d.supplier_code, name: d.name, contactPerson: d.contact_person || null,
          phone: d.phone || null, email: d.email || null, address: d.address || null,
          taxId: d.tax_id || null, paymentTerms: d.payment_terms || null, currency: d.currency,
        },
      });
      result.imported++;
    } catch (e) {
      result.errors.push({ row: rowNum, field: "supplier_code", message: e instanceof Error ? e.message : "Insert failed" });
      result.skipped++;
    }
  }
  return result;
}

// ─── Machines ─────────────────────────────────────────────────────────────────

const MachineRow = z.object({
  code:                  z.string().min(1, "required"),
  name:                  z.string().min(1, "required"),
  type:                  z.string().min(1, "required"),
  factory_area_code:     z.string().optional(),
  capacity_kg_per_shift: z.coerce.number().optional(),
  purchase_date:         z.string().optional(),
  brand:                 z.string().optional(),
  model_number:          z.string().optional(),
  notes:                 z.string().optional(),
});

export async function importMachines(formData: FormData): Promise<ImportResult> {
  const user = await requireUser();
  if (!can(user.role, "factory.manage")) throw new Error("Forbidden");

  const text = await getFileText(formData);
  if (!text) return { imported: 0, skipped: 0, errors: [{ row: 0, field: "file", message: "No file uploaded" }] };

  const rows = parseCsv(text);
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

  // Build area code → id lookup
  const areas = await prisma.factoryArea.findMany({ select: { id: true, code: true } });
  const areaMap = new Map(areas.map(a => [a.code, a.id]));

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const parsed = MachineRow.safeParse(rows[i]);
    if (!parsed.success) {
      parsed.error.issues.forEach(iss => {
        result.errors.push({ row: rowNum, field: String(iss.path[0] ?? ""), message: iss.message });
      });
      result.skipped++;
      continue;
    }
    const d = parsed.data;
    const factoryAreaId = d.factory_area_code ? (areaMap.get(d.factory_area_code) ?? null) : null;
    if (d.factory_area_code && !factoryAreaId) {
      result.errors.push({ row: rowNum, field: "factory_area_code", message: `Area code "${d.factory_area_code}" not found` });
      result.skipped++;
      continue;
    }
    try {
      await prisma.machine.upsert({
        where: { code: d.code },
        update: {
          name: d.name, type: d.type, factoryAreaId,
          capacityKgPerShift: d.capacity_kg_per_shift ?? null,
          purchaseDate: d.purchase_date ? new Date(d.purchase_date) : null,
          brand: d.brand || null, notes: d.notes || null,
        },
        create: {
          code: d.code, name: d.name, type: d.type, factoryAreaId,
          capacityKgPerShift: d.capacity_kg_per_shift ?? null,
          purchaseDate: d.purchase_date ? new Date(d.purchase_date) : null,
          brand: d.brand || null, notes: d.notes || null,
        },
      });
      result.imported++;
    } catch (e) {
      result.errors.push({ row: rowNum, field: "code", message: e instanceof Error ? e.message : "Insert failed" });
      result.skipped++;
    }
  }
  return result;
}

// ─── Employees ────────────────────────────────────────────────────────────────

const EmpRow = z.object({
  name_en:           z.string().min(1, "required"),
  name_kh:           z.string().default(""),
  employee_code:     z.string().optional(),
  gender:            z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  birthday:          z.string().optional(),
  phone:             z.string().optional(),
  email:             z.string().optional(),
  hire_date:         z.string().min(1, "required"),
  daily_rate_usd:    z.coerce.number().min(0, "must be ≥ 0"),
  department_code:   z.string().optional(),
  position_code:     z.string().optional(),
  shift:             z.enum(["DAY", "AFTERNOON", "NIGHT"]).default("DAY"),
  factory_area_code: z.string().optional(),
});

export async function importEmployees(formData: FormData): Promise<ImportResult> {
  const user = await requireUser();
  if (!can(user.role, "employee.create")) throw new Error("Forbidden");

  const text = await getFileText(formData);
  if (!text) return { imported: 0, skipped: 0, errors: [{ row: 0, field: "file", message: "No file uploaded" }] };

  const rows = parseCsv(text);
  const result: ImportResult = { imported: 0, skipped: 0, errors: [] };

  // Build reference lookups
  const [depts, positions, areas] = await Promise.all([
    prisma.department.findMany({ select: { id: true, code: true } }),
    prisma.position.findMany({ select: { id: true, code: true } }),
    prisma.factoryArea.findMany({ select: { id: true, code: true } }),
  ]);
  const deptMap = new Map(depts.filter(d => d.code).map(d => [d.code!, d.id]));
  const posMap  = new Map(positions.filter(p => p.code).map(p => [p.code!, p.id]));
  const areaMap = new Map(areas.map(a => [a.code, a.id]));

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    const parsed = EmpRow.safeParse(rows[i]);
    if (!parsed.success) {
      parsed.error.issues.forEach(iss => {
        result.errors.push({ row: rowNum, field: String(iss.path[0] ?? ""), message: iss.message });
      });
      result.skipped++;
      continue;
    }
    const d = parsed.data;

    // Resolve FK lookups
    const departmentId = d.department_code ? (deptMap.get(d.department_code) ?? null) : null;
    const positionId   = d.position_code   ? (posMap.get(d.position_code)     ?? null) : null;
    const factoryAreaId = d.factory_area_code ? (areaMap.get(d.factory_area_code) ?? null) : null;

    if (d.department_code && !departmentId) {
      result.errors.push({ row: rowNum, field: "department_code", message: `Dept code "${d.department_code}" not found` });
      result.skipped++;
      continue;
    }
    if (d.position_code && !positionId) {
      result.errors.push({ row: rowNum, field: "position_code", message: `Position code "${d.position_code}" not found` });
      result.skipped++;
      continue;
    }

    try {
      const data = {
        nameEn: d.name_en, nameKh: d.name_kh,
        employeeCode: d.employee_code || null,
        gender: d.gender || null,
        birthday: d.birthday ? new Date(d.birthday) : null,
        phone: d.phone || null, email: d.email || null,
        hireDate: new Date(d.hire_date),
        dailyRateUsd: d.daily_rate_usd,
        shift: d.shift,
        departmentId, positionId, factoryAreaId,
      };
      if (d.employee_code) {
        await prisma.employee.upsert({
          where: { employeeCode: d.employee_code },
          update: data,
          create: data,
        });
      } else {
        await prisma.employee.create({ data });
      }
      result.imported++;
    } catch (e) {
      result.errors.push({ row: rowNum, field: "name_en", message: e instanceof Error ? e.message : "Insert failed" });
      result.skipped++;
    }
  }
  return result;
}
