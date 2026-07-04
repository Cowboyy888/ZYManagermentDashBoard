"use client";

import { useState, useRef, useTransition } from "react";
import {
  importDepartments, importPositions, importEmployees,
  importCustomers, importSuppliers, importMachines,
  type ImportResult,
} from "@/actions/admin/import";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Badge } from "@/components/ui/Badge";

interface Props {
  canImportSales:      boolean;
  canImportPurchasing: boolean;
  canImportFactory:    boolean;
}

type EntityKey =
  | "departments" | "positions" | "employees"
  | "customers" | "suppliers" | "machines";

interface EntityConfig {
  key: EntityKey;
  label: string;
  description: string;
  columns: string[];
  action: (fd: FormData) => Promise<ImportResult>;
  requiredPerm?: boolean;
}

export function ImportDashboard({ canImportSales, canImportPurchasing, canImportFactory }: Props) {
  const [active, setActive] = useState<EntityKey>("departments");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const entities: EntityConfig[] = [
    {
      key: "departments",
      label: "Departments",
      description: "Create or update department records.",
      columns: ["name*", "name_kh", "code", "description"],
      action: importDepartments,
    },
    {
      key: "positions",
      label: "Positions",
      description: "Create or update job positions (salary grades 1–4).",
      columns: ["name*", "code", "level (1–4)", "description"],
      action: importPositions,
    },
    {
      key: "employees",
      label: "Employees",
      description: "Create or update employee records. Departments and positions must exist first.",
      columns: ["name_en*", "name_kh", "employee_code", "gender", "birthday", "phone", "email", "hire_date*", "daily_rate_usd*", "department_code", "position_code", "shift", "factory_area_code"],
      action: importEmployees,
    },
    {
      key: "customers",
      label: "Customers",
      description: "Create or update customer master data.",
      columns: ["customer_code*", "name*", "contact_person", "phone", "email", "address", "country", "tax_id", "payment_terms", "credit_limit_usd"],
      action: importCustomers,
      requiredPerm: canImportSales,
    },
    {
      key: "suppliers",
      label: "Suppliers",
      description: "Create or update supplier master data.",
      columns: ["supplier_code*", "name*", "contact_person", "phone", "email", "address", "tax_id", "payment_terms", "currency"],
      action: importSuppliers,
      requiredPerm: canImportPurchasing,
    },
    {
      key: "machines",
      label: "Machines",
      description: "Create or update factory machine records. Factory areas must exist first.",
      columns: ["code*", "name*", "type*", "factory_area_code", "capacity_kg_per_shift", "purchase_date", "brand", "model_number", "notes"],
      action: importMachines,
      requiredPerm: canImportFactory,
    },
  ];

  const current = entities.find(e => e.key === active)!;
  const locked = current.requiredPerm === false;

  function handleTabChange(key: EntityKey) {
    setActive(key);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function handleImport() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setResult(null);
    const fd = new FormData();
    fd.append("file", file);
    startTransition(async () => {
      const res = await current.action(fd);
      setResult(res);
      if (fileRef.current) fileRef.current.value = "";
    });
  }

  return (
    <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>
      {/* Sidebar tabs */}
      <div style={{
        width: 200, flexShrink: 0,
        background: "var(--surface)", border: "1px solid var(--border)",
        borderRadius: 10, overflow: "hidden",
      }}>
        {entities.map(e => (
          <button
            key={e.key}
            onClick={() => handleTabChange(e.key)}
            style={{
              display: "block", width: "100%", textAlign: "left",
              padding: "11px 16px", border: "none", borderBottom: "1px solid var(--border)",
              fontSize: 13, fontWeight: active === e.key ? 700 : 400,
              background: active === e.key ? "var(--steel)" : "transparent",
              color: active === e.key ? "#fff" : e.requiredPerm === false ? "var(--text-3)" : "var(--text)",
              cursor: e.requiredPerm === false ? "not-allowed" : "pointer",
            }}
          >
            {e.label}
            {e.requiredPerm === false && (
              <span style={{ fontSize: 10, marginLeft: 6, opacity: 0.7 }}>no access</span>
            )}
          </button>
        ))}
      </div>

      {/* Main panel */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 20 }}>
        {/* Entity header */}
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 10, padding: 20,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>
            Import {current.label}
          </h2>
          <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 16 }}>
            {current.description}
          </p>

          {/* Column reference */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
              CSV Columns (* = required)
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {current.columns.map(col => (
                <Badge
                  key={col}
                  color={col.endsWith("*") ? "steel" : "gray"}
                  size="sm"
                >
                  {col}
                </Badge>
              ))}
            </div>
          </div>

          {/* Template download + file upload */}
          {locked ? (
            <Alert level="warning" message="You don't have permission to import this entity type." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <a
                  href={`/api/templates/${current.key}`}
                  download
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "7px 14px", borderRadius: 7,
                    border: "1px solid var(--border)", background: "var(--surface)",
                    color: "var(--text-2)", fontSize: 13, fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  ↓ Download CSV Template
                </a>
                <span style={{ fontSize: 12, color: "var(--text-3)" }}>
                  Fill in the template, save as CSV, then upload below.
                </span>
              </div>

              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  style={{
                    fontSize: 13, color: "var(--text)",
                    border: "1px solid var(--border)", borderRadius: 7,
                    padding: "6px 12px", background: "var(--surface)",
                    flex: 1, maxWidth: 340,
                  }}
                />
                <Button
                  onClick={handleImport}
                  loading={isPending}
                  disabled={isPending}
                >
                  Import
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Result */}
        {result && (
          <div style={{
            background: "var(--surface)", border: "1px solid var(--border)",
            borderRadius: 10, padding: 20,
          }}>
            <div style={{ display: "flex", gap: 16, marginBottom: result.errors.length > 0 ? 16 : 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Badge color="green">{result.imported} imported</Badge>
              </div>
              {result.skipped > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Badge color="amber">{result.skipped} skipped</Badge>
                </div>
              )}
              {result.errors.length === 0 && result.imported > 0 && (
                <span style={{ fontSize: 13, color: "var(--green)", fontWeight: 600 }}>
                  Import completed successfully.
                </span>
              )}
            </div>

            {result.errors.length > 0 && (
              <div>
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-3)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  Errors ({result.errors.length})
                </p>
                <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid var(--border)" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "var(--surface-2)" }}>
                        {["Row", "Field", "Error"].map(h => (
                          <th key={h} style={{ padding: "7px 12px", textAlign: "left", fontWeight: 600, color: "var(--text-3)", borderBottom: "1px solid var(--border)" }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.errors.map((err, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "6px 12px", color: "var(--text-3)" }}>{err.row}</td>
                          <td style={{ padding: "6px 12px", fontFamily: "monospace" }}>{err.field}</td>
                          <td style={{ padding: "6px 12px", color: "var(--red)" }}>{err.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
