import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { can } from "@/lib/rbac";

// CSV header rows + one example row for each importable entity.
// These must exactly match the column names expected by the import actions.
const TEMPLATES: Record<string, { filename: string; csv: string }> = {
  employees: {
    filename: "import-employees-template.csv",
    csv: [
      "name_en,name_kh,employee_code,gender,birthday,phone,email,hire_date,daily_rate_usd,department_code,position_code,shift,factory_area_code",
      "John Doe,ចន ដូ,EMP-001,MALE,1990-05-15,+855-12-345-678,john@example.com,2024-01-01,12.00,PROD,OPERATOR,DAY,WD",
    ].join("\r\n"),
  },
  departments: {
    filename: "import-departments-template.csv",
    csv: [
      "name,name_kh,code,description",
      "Wire Drawing,ការទាញសាយ,WD,Wire production department",
    ].join("\r\n"),
  },
  customers: {
    filename: "import-customers-template.csv",
    csv: [
      "customer_code,name,contact_person,phone,email,address,country,tax_id,payment_terms,credit_limit_usd",
      "CUST-001,Phnom Penh Construction Co.,Mr. Chan,+855-23-456-789,info@ppcc.com,Street 271 Phnom Penh,Cambodia,K001-12345,Net30,50000",
    ].join("\r\n"),
  },
  suppliers: {
    filename: "import-suppliers-template.csv",
    csv: [
      "supplier_code,name,contact_person,phone,email,address,tax_id,payment_terms,currency",
      "SUP-001,Steel Coil Imports Ltd.,Ms. Li,+86-21-5555-6789,supply@steelcoil.cn,Shanghai China,,Net60,USD",
    ].join("\r\n"),
  },
  inventory: {
    filename: "import-inventory-template.csv",
    csv: [
      "item_code,name,unit_of_measure,specification,min_stock,max_stock,current_stock,category_name,warehouse_name",
      "WR-6.0MM,Wire Rod 6.0mm,KG,Q235B Grade hot-rolled wire rod 6.0mm,5000,50000,12500,Raw Material,Main Warehouse",
    ].join("\r\n"),
  },
  machines: {
    filename: "import-machines-template.csv",
    csv: [
      "code,name,type,factory_area_code,capacity_kg_per_shift,purchase_date,brand,model_number,notes",
      "WD-01,Wire Drawing Machine #1,WIRE_DRAWING,WD,800,2020-03-15,Morgan,MD-2000,",
    ].join("\r\n"),
  },
  positions: {
    filename: "import-positions-template.csv",
    csv: [
      "name,code,level,description",
      "Wire Operator,WO,1,Operates wire drawing machine",
      "Team Leader,TL,2,Leads production team",
    ].join("\r\n"),
  },
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ entity: string }> }
) {
  const user = await requireUser();
  if (!can(user.role, "employee.create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { entity } = await params;
  const tpl = TEMPLATES[entity];
  if (!tpl) {
    return NextResponse.json({ error: `No template for: ${entity}` }, { status: 404 });
  }

  return new NextResponse(tpl.csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${tpl.filename}"`,
    },
  });
}
