// ZYSTEEL HR — database seed
// Generated from the real June 16–30 2026 roster (38 employees) + reconstructed OT log.
// Run: npx prisma db seed
import { PrismaClient, Role, EmploymentStatus, OvertimeBand } from "@prisma/client";
import { hash } from "@node-rs/argon2"; // or bcrypt; see auth setup

const prisma = new PrismaClient();

const DEPARTMENTS = [
  { name: "Production", nameKh: "ផលិតកម្ម", nameZh: "生产部" },
  { name: "Office",     nameKh: "ការិយាល័យ", nameZh: "办公室" },
];

// Cambodian public holidays falling in/near the seeded period (data, not hardcode).
const HOLIDAYS = [
  { date: "2026-06-18", name: "Queen Mother's Birthday", nameKh: "ព្រះរាជពិធីបុណ្យ", paid: true },
];

type SeedEmp = {
  id: number; nameKh: string; nameZh: string | null; nameEn: string;
  dailyRateUsd: number; dept: string; hireDate: string; note: string | null;
};

const EMPLOYEES: SeedEmp[] = [
  { id: 1, nameKh: "ខឹម ពិសិដ្ធ", nameZh: null, nameEn: "Khoem Piseth", dailyRateUsd: 20, dept: "Production", hireDate: "2025-01-01", note: "员工协助及 舒畅安排" },
  { id: 2, nameKh: "សិន ចាន់ថន", nameZh: null, nameEn: "Sin Chanthorn", dailyRateUsd: 18, dept: "Production", hireDate: "2025-01-01", note: "电线从新链接 及 主导者" },
  { id: 3, nameKh: "ផាន់ សុភារិទ្ធ", nameZh: null, nameEn: "Phann Sophearith", dailyRateUsd: 17, dept: "Production", hireDate: "2025-01-01", note: "听话第一做了摸样才后面调直机和焊网机 一起进步" },
  { id: 4, nameKh: "ឃឹម ភារិត", nameZh: null, nameEn: "Khoem Phearith", dailyRateUsd: 13, dept: "Production", hireDate: "2025-01-01", note: "奖励员工宿舍管理者 优秀执行" },
  { id: 5, nameKh: "ទូច ជិន", nameZh: null, nameEn: "Toch chin", dailyRateUsd: 12, dept: "Production", hireDate: "2025-01-01", note: null },
  { id: 6, nameKh: "កៅ សារុំ", nameZh: null, nameEn: "Kao Sarom", dailyRateUsd: 13, dept: "Production", hireDate: "2025-01-01", note: null },
  { id: 7, nameKh: "អ៊ុន ចាន់ណាក់", nameZh: null, nameEn: "Oun Channak", dailyRateUsd: 12, dept: "Production", hireDate: "2025-01-01", note: null },
  { id: 8, nameKh: "អេង សុខកល", nameZh: null, nameEn: "Eng Sokol", dailyRateUsd: 11, dept: "Production", hireDate: "2025-01-01", note: null },
  { id: 9, nameKh: "ជុន ខាន់", nameZh: null, nameEn: "Chun Khann", dailyRateUsd: 12, dept: "Production", hireDate: "2025-01-01", note: null },
  { id: 10, nameKh: "សាយ សារ៉ាក់សុីញ", nameZh: null, nameEn: "Say Saraksinh", dailyRateUsd: 11, dept: "Production", hireDate: "2025-01-01", note: null },
  { id: 11, nameKh: "យ៉ុន ម៉ឿន", nameZh: null, nameEn: "Yon Moeun", dailyRateUsd: 11, dept: "Production", hireDate: "2025-01-01", note: null },
  { id: 12, nameKh: "នៅ រ៉ា", nameZh: null, nameEn: "Nao Ra", dailyRateUsd: 12, dept: "Production", hireDate: "2025-01-01", note: null },
  { id: 13, nameKh: "វេង គឹមហុង", nameZh: null, nameEn: "Veng Kimhong", dailyRateUsd: 11, dept: "Production", hireDate: "2025-01-01", note: null },
  { id: 14, nameKh: "លី រត្តនា", nameZh: null, nameEn: "Ly ratana", dailyRateUsd: 9, dept: "Production", hireDate: "2025-01-01", note: null },
  { id: 15, nameKh: "ជា​​​ សំណាង", nameZh: null, nameEn: "chea somnag", dailyRateUsd: 11.5, dept: "Production", hireDate: "2025-01-01", note: "补上个月0.5的工资休息一天" },
  { id: 16, nameKh: "គាន សារ៉ន", nameZh: null, nameEn: "kean sarron", dailyRateUsd: 9, dept: "Production", hireDate: "2025-01-01", note: null },
  { id: 17, nameKh: "ទូច សំណាង", nameZh: null, nameEn: "Touch Somnang", dailyRateUsd: 11, dept: "Production", hireDate: "2025-01-01", note: null },
  { id: 18, nameKh: "សែម សង្ហារ", nameZh: null, nameEn: "sem Songha", dailyRateUsd: 9, dept: "Production", hireDate: "2025-01-01", note: null },
  { id: 19, nameKh: "គង់ សុផៃ", nameZh: null, nameEn: "kong sophai", dailyRateUsd: 9, dept: "Production", hireDate: "2025-01-01", note: null },
  { id: 20, nameKh: "ម៉ូង សុផាន់", nameZh: null, nameEn: "Moung Sophann", dailyRateUsd: 11, dept: "Production", hireDate: "2025-01-01", note: null },
  { id: 21, nameKh: "ជា ជាន", nameZh: null, nameEn: "Chea Chean", dailyRateUsd: 11, dept: "Production", hireDate: "2025-01-01", note: null },
  { id: 22, nameKh: "ភឿន តឿក", nameZh: null, nameEn: "Phoeurn Toeurk", dailyRateUsd: 10, dept: "Production", hireDate: "2025-01-01", note: null },
  { id: 23, nameKh: "អោន សុខមន", nameZh: null, nameEn: "Aun Sokmon", dailyRateUsd: 11, dept: "Production", hireDate: "2025-01-01", note: null },
  { id: 24, nameKh: "ធុល  សារិន", nameZh: null, nameEn: "Thol Saovoren", dailyRateUsd: 10, dept: "Production", hireDate: "2025-01-01", note: null },
  { id: 25, nameKh: "ឌុក មាឃ", nameZh: null, nameEn: "Duk Meak", dailyRateUsd: 11, dept: "Production", hireDate: "2025-01-01", note: null },
  { id: 26, nameKh: "គ្រីន គីណាល់", nameZh: null, nameEn: "Krin Kinal", dailyRateUsd: 11, dept: "Production", hireDate: "2025-01-01", note: null },
  { id: 27, nameKh: "កៅ សិត", nameZh: null, nameEn: "kao sith", dailyRateUsd: 9, dept: "Production", hireDate: "2025-01-01", note: null },
  { id: 28, nameKh: "សារិ ល័ក្ខ", nameZh: null, nameEn: "sari  lek", dailyRateUsd: 9, dept: "Production", hireDate: "2025-01-01", note: null },
  { id: 29, nameKh: "ថន ចាន់ធី", nameZh: null, nameEn: "Thorn ChanThy", dailyRateUsd: 7, dept: "Production", hireDate: "2025-01-01", note: null },
  { id: 30, nameKh: "ហៀក ចាន់ថន", nameZh: null, nameEn: "Heak Chanthon", dailyRateUsd: 10.5, dept: "Production", hireDate: "2025-01-01", note: "补上个月0.5工资休息半天" },
  { id: 31, nameKh: "លន ជឿន", nameZh: null, nameEn: "Loen Chern", dailyRateUsd: 11, dept: "Production", hireDate: "2025-01-01", note: null },
  { id: 32, nameKh: "រតនា មករា", nameZh: null, nameEn: "Ratana makara", dailyRateUsd: 9, dept: "Production", hireDate: "2025-01-01", note: null },
  { id: 33, nameKh: "ខាន់ សីហា", nameZh: null, nameEn: "Khann Seyha", dailyRateUsd: 7, dept: "Production", hireDate: "2025-01-01", note: null },
  { id: 34, nameKh: "ឌុក សុខអេង", nameZh: null, nameEn: "Duk Sok Eng", dailyRateUsd: 11, dept: "Production", hireDate: "2025-01-01", note: null },
  { id: 35, nameKh: "អៀង​​ ចន្ថា", nameZh: null, nameEn: "Eang chantha", dailyRateUsd: 9, dept: "Production", hireDate: "2025-01-01", note: null },
  { id: 36, nameKh: "អូន​ គិមលាង", nameZh: null, nameEn: "Oun kimleang", dailyRateUsd: 9, dept: "Production", hireDate: "2026-06-19", note: "19日入职" },
  { id: 37, nameKh: "阿山", nameZh: null, nameEn: "Chea Vireaksat", dailyRateUsd: 25, dept: "Office", hireDate: "2025-01-01", note: null },
  { id: 38, nameKh: "阿明", nameZh: null, nameEn: "Seng Chansereyrith", dailyRateUsd: 30, dept: "Office", hireDate: "2025-01-01", note: null },
];

type SeedOt = { employeeId: number; date: string; hours: number; band: keyof typeof OvertimeBand; description: string | null };
const OVERTIME: SeedOt[] = [
  { employeeId: 1, date: "2026-06-15", hours: 1.5, band: "NORMAL_1_5", description: "安排出货" },
  { employeeId: 1, date: "2026-06-15", hours: 2.0, band: "NIGHT_2_0", description: "调直机" },
  { employeeId: 1, date: "2026-06-22", hours: 1.0, band: "NIGHT_2_0", description: "出货" },
  { employeeId: 1, date: "2026-06-26", hours: 1.0, band: "NIGHT_2_0", description: "出货" },
  { employeeId: 4, date: "2026-06-15", hours: 1.5, band: "NORMAL_1_5", description: "拔丝机" },
  { employeeId: 4, date: "2026-06-15", hours: 2.0, band: "NIGHT_2_0", description: "拔丝机" },
  { employeeId: 4, date: "2026-06-16", hours: 1.5, band: "NORMAL_1_5", description: "拔丝机" },
  { employeeId: 4, date: "2026-06-16", hours: 2.0, band: "NIGHT_2_0", description: "拔丝机" },
  { employeeId: 7, date: "2026-06-15", hours: 1.5, band: "NORMAL_1_5", description: "拔丝机" },
  { employeeId: 7, date: "2026-06-15", hours: 2.0, band: "NIGHT_2_0", description: "拔丝机" },
  { employeeId: 7, date: "2026-06-16", hours: 1.5, band: "NORMAL_1_5", description: "拔丝机" },
  { employeeId: 7, date: "2026-06-16", hours: 2.0, band: "NIGHT_2_0", description: "拔丝机" },
  { employeeId: 7, date: "2026-06-27", hours: 1.5, band: "NORMAL_1_5", description: "出货" },
  { employeeId: 7, date: "2026-06-27", hours: 1.0, band: "NIGHT_2_0", description: "出货" },
  { employeeId: 10, date: "2026-06-22", hours: 1.0, band: "NIGHT_2_0", description: "出货" },
  { employeeId: 10, date: "2026-06-26", hours: 1.0, band: "NIGHT_2_0", description: "出货" },
  { employeeId: 10, date: "2026-06-27", hours: 1.5, band: "NORMAL_1_5", description: "出货" },
  { employeeId: 10, date: "2026-06-27", hours: 1.0, band: "NIGHT_2_0", description: "出货" },
];

// Hourly rate from a daily rate: daily / 8 (8-hour standard day, Labour Law).
// FLAT_TIER: factory pays fixed $/hour per band (validated against the real 加班表).
const FLAT_USD: Record<string, number> = { NORMAL_1_5: 1.25, NIGHT_2_0: 2.0, HOLIDAY_2_0: 2.0 };
const round2 = (n: number) => Math.round(n * 100) / 100;

async function main() {
  // Departments
  const deptMap = new Map<string, number>();
  for (const d of DEPARTMENTS) {
    const rec = await prisma.department.upsert({
      where: { name: d.name }, update: {}, create: d,
    });
    deptMap.set(d.name, rec.id);
  }

  // Holidays
  for (const h of HOLIDAYS) {
    await prisma.publicHoliday.upsert({
      where: { date: new Date(h.date) }, update: {},
      create: { date: new Date(h.date), name: h.name, nameKh: h.nameKh, paid: h.paid },
    });
  }

  // Employees (explicit ids — arch §3.2, stable integer identity)
  for (const e of EMPLOYEES) {
    await prisma.employee.upsert({
      where: { id: e.id }, update: {},
      create: {
        id: e.id, nameKh: e.nameKh, nameZh: e.nameZh ?? undefined, nameEn: e.nameEn,
        dailyRateUsd: e.dailyRateUsd, departmentId: deptMap.get(e.dept),
        hireDate: new Date(e.hireDate), status: EmploymentStatus.ACTIVE,
        note: e.note ?? undefined,
      },
    });
  }
  // Keep autoincrement above the highest explicit id
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"Employee"','id'), (SELECT MAX(id) FROM "Employee"))`
  );

  // Overtime (value derived — arch §3.5)
  const rateById = new Map(EMPLOYEES.map((e) => [e.id, e.dailyRateUsd]));
  for (const o of OVERTIME) {
    const amount = round2(o.hours * FLAT_USD[o.band]); // FLAT_TIER, see calc.ts
    await prisma.overtimeEntry.create({
      data: {
        employeeId: o.employeeId, date: new Date(o.date), hours: o.hours,
        band: o.band as OvertimeBand, description: o.description ?? undefined, amountUsd: amount,
      },
    });
  }

  // Pay period: 2026-06 second half (days 16–30)
  await prisma.payPeriod.upsert({
    where: { year_month_half: { year: 2026, month: 6, half: 2 } },
    update: {},
    create: {
      year: 2026, month: 6, half: 2,
      startDate: new Date("2026-06-16"), endDate: new Date("2026-06-30"),
      workingDays: 15, locked: false,
    },
  });

  // Admin user (change the password immediately after first login)
  await prisma.user.upsert({
    where: { email: "admin@zysteel.local" }, update: {},
    create: {
      email: "admin@zysteel.local", name: "Factory Admin", role: Role.OWNER,
      passwordHash: await hash("change-me-on-first-login"),
    },
  });

  // Settings
  for (const [key, value] of Object.entries({
    exchange_rate: "4100",
    overtime_mode: "FLAT_TIER",
    ot_band_normal_mult: "1.5",
    ot_band_night_mult: "2.0",
    standard_hours_per_day: "8",
    work_days_per_week: "6",
  })) {
    await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }

  console.log(`Seeded ${EMPLOYEES.length} employees, ${OVERTIME.length} OT entries.`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
