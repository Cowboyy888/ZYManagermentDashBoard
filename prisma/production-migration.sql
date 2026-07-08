-- ZY Steel — Production Module DDL
-- Run this in psql against the zysteel database ONCE.
-- Prisma client was already regenerated; no migration file is created.

-- ── Enums ──────────────────────────────────────────────────────────────────────

CREATE TYPE "MachineStatus" AS ENUM ('OPERATIONAL', 'UNDER_MAINTENANCE', 'RETIRED');
CREATE TYPE "ProductionOrderStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "QualityResult" AS ENUM ('PASS', 'FAIL', 'REWORK');
CREATE TYPE "MaintenanceType" AS ENUM ('PREVENTIVE', 'CORRECTIVE', 'BREAKDOWN');

-- ── Machine ─────────────────────────────────────────────────────────────────────

CREATE TABLE "Machine" (
    "id"            SERIAL PRIMARY KEY,
    "code"          TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "type"          TEXT NOT NULL,
    "factoryAreaId" INTEGER REFERENCES "FactoryArea"("id") ON DELETE SET NULL,
    "status"        "MachineStatus" NOT NULL DEFAULT 'OPERATIONAL',
    "purchaseDate"  DATE,
    "notes"         TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "Machine_code_key" ON "Machine"("code");
CREATE INDEX "Machine_factoryAreaId_idx" ON "Machine"("factoryAreaId");
CREATE INDEX "Machine_status_idx" ON "Machine"("status");

-- ── WireInventory ────────────────────────────────────────────────────────────────

CREATE TABLE "WireInventory" (
    "id"               SERIAL PRIMARY KEY,
    "batchCode"        TEXT NOT NULL,
    "wireDiameterMm"   DECIMAL(5,2) NOT NULL,
    "weightKg"         DECIMAL(10,2) NOT NULL,
    "remainingKg"      DECIMAL(10,2) NOT NULL,
    "supplier"         TEXT,
    "receivedDate"     DATE NOT NULL,
    "notes"            TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "WireInventory_batchCode_key" ON "WireInventory"("batchCode");
CREATE INDEX "WireInventory_receivedDate_idx" ON "WireInventory"("receivedDate");

-- ── MeshInventory ────────────────────────────────────────────────────────────────

CREATE TABLE "MeshInventory" (
    "id"               SERIAL PRIMARY KEY,
    "sku"              TEXT NOT NULL,
    "lengthM"          DECIMAL(6,2) NOT NULL,
    "widthM"           DECIMAL(6,2) NOT NULL,
    "wireDiameterMm"   DECIMAL(5,2) NOT NULL,
    "gridSpacingMm"    INTEGER NOT NULL,
    "qtyInStock"       INTEGER NOT NULL DEFAULT 0,
    "unitWeightKg"     DECIMAL(8,3) NOT NULL,
    "notes"            TEXT,
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "MeshInventory_sku_key" ON "MeshInventory"("sku");

-- ── ProductionOrder ──────────────────────────────────────────────────────────────

CREATE TABLE "ProductionOrder" (
    "id"              SERIAL PRIMARY KEY,
    "orderCode"       TEXT NOT NULL,
    "status"          "ProductionOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "machineId"       INTEGER REFERENCES "Machine"("id") ON DELETE SET NULL,
    "supervisorId"    INTEGER REFERENCES "Employee"("id") ON DELETE SET NULL,
    "plannedDate"     DATE NOT NULL,
    "completedDate"   DATE,
    "notes"           TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ProductionOrder_orderCode_key" ON "ProductionOrder"("orderCode");
CREATE INDEX "ProductionOrder_status_idx" ON "ProductionOrder"("status");
CREATE INDEX "ProductionOrder_plannedDate_idx" ON "ProductionOrder"("plannedDate");

-- ── ProductionOrderLine ──────────────────────────────────────────────────────────

CREATE TABLE "ProductionOrderLine" (
    "id"            SERIAL PRIMARY KEY,
    "orderId"       INTEGER NOT NULL REFERENCES "ProductionOrder"("id") ON DELETE CASCADE,
    "meshId"        INTEGER NOT NULL REFERENCES "MeshInventory"("id"),
    "qtyOrdered"    INTEGER NOT NULL,
    "qtyProduced"   INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX "ProductionOrderLine_orderId_idx" ON "ProductionOrderLine"("orderId");

-- ── DailyProductionReport ────────────────────────────────────────────────────────

CREATE TABLE "DailyProductionReport" (
    "id"               BIGSERIAL PRIMARY KEY,
    "reportDate"       DATE NOT NULL,
    "shift"            TEXT NOT NULL,
    "factoryAreaId"    INTEGER REFERENCES "FactoryArea"("id") ON DELETE SET NULL,
    "supervisorId"     INTEGER REFERENCES "Employee"("id") ON DELETE SET NULL,
    "meshProducedKg"   DECIMAL(10,2) NOT NULL DEFAULT 0,
    "wireConsumedKg"   DECIMAL(10,2) NOT NULL DEFAULT 0,
    "headcount"        INTEGER NOT NULL DEFAULT 0,
    "downtimeMinutes"  INTEGER NOT NULL DEFAULT 0,
    "notes"            TEXT,
    "createdById"      TEXT NOT NULL REFERENCES "user"("id"),
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "DailyProductionReport_date_shift_area_key"
    ON "DailyProductionReport"("reportDate", "shift", "factoryAreaId");
CREATE INDEX "DailyProductionReport_reportDate_idx" ON "DailyProductionReport"("reportDate");
CREATE INDEX "DailyProductionReport_factoryAreaId_idx" ON "DailyProductionReport"("factoryAreaId");

-- ── QualityCheck ─────────────────────────────────────────────────────────────────

CREATE TABLE "QualityCheck" (
    "id"              BIGSERIAL PRIMARY KEY,
    "orderId"         INTEGER REFERENCES "ProductionOrder"("id") ON DELETE SET NULL,
    "inspectedById"   INTEGER NOT NULL REFERENCES "Employee"("id"),
    "checkDate"       DATE NOT NULL,
    "meshSku"         TEXT,
    "sampleSize"      INTEGER NOT NULL,
    "defectCount"     INTEGER NOT NULL DEFAULT 0,
    "result"          "QualityResult" NOT NULL,
    "notes"           TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "QualityCheck_checkDate_idx" ON "QualityCheck"("checkDate");
CREATE INDEX "QualityCheck_orderId_idx" ON "QualityCheck"("orderId");

-- ── MaintenanceLog ───────────────────────────────────────────────────────────────

CREATE TABLE "MaintenanceLog" (
    "id"               BIGSERIAL PRIMARY KEY,
    "machineId"        INTEGER NOT NULL REFERENCES "Machine"("id"),
    "type"             "MaintenanceType" NOT NULL,
    "performedById"    INTEGER REFERENCES "Employee"("id") ON DELETE SET NULL,
    "startedAt"        TIMESTAMP(3) NOT NULL,
    "completedAt"      TIMESTAMP(3),
    "downtimeMinutes"  INTEGER,
    "description"      TEXT NOT NULL,
    "cost"             DECIMAL(10,2),
    "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "MaintenanceLog_machineId_idx" ON "MaintenanceLog"("machineId");
CREATE INDEX "MaintenanceLog_startedAt_idx" ON "MaintenanceLog"("startedAt");

-- ── Shift & Work Schedule Management ────────────────────────────────────────────
-- Run this block AFTER the Production Module DDL above.

DO $$ BEGIN
  CREATE TYPE "DailyStatus" AS ENUM (
    'PRESENT','LATE','ABSENT','SICK_LEAVE','ANNUAL_LEAVE',
    'PERSONAL_LEAVE','BUSINESS_TRIP','WORK_FROM_HOME','HALF_DAY','HOLIDAY'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- attendance_day: add manual daily-entry columns (nullable for backward compat)
ALTER TABLE "AttendanceDay"
  ADD COLUMN IF NOT EXISTS "dailyStatus"  "DailyStatus",
  ADD COLUMN IF NOT EXISTS "checkIn"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "checkOut"     TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "shiftType"    TEXT;

CREATE TABLE IF NOT EXISTS "Shift" (
    "id"             SERIAL PRIMARY KEY,
    "code"           TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "description"    TEXT,
    "shiftType"      TEXT NOT NULL DEFAULT 'DAY',
    "startTime"      TEXT NOT NULL,
    "endTime"        TEXT NOT NULL,
    "breakStart"     TEXT,
    "breakEnd"       TEXT,
    "workingHours"   DECIMAL(4,2) NOT NULL,
    "otStartsAfter"  TEXT,
    "gracePeriodMin" INTEGER NOT NULL DEFAULT 15,
    "color"          TEXT NOT NULL DEFAULT '#3b82f6',
    "active"         BOOLEAN NOT NULL DEFAULT TRUE,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "Shift_code_key" ON "Shift"("code");
CREATE INDEX IF NOT EXISTS "Shift_active_idx"    ON "Shift"("active");
CREATE INDEX IF NOT EXISTS "Shift_shiftType_idx" ON "Shift"("shiftType");

CREATE TABLE IF NOT EXISTS "ShiftAssignment" (
    "id"            SERIAL PRIMARY KEY,
    "shiftId"       INTEGER NOT NULL REFERENCES "Shift"("id"),
    "employeeId"    INTEGER NOT NULL REFERENCES "Employee"("id") ON DELETE CASCADE,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo"   DATE,
    "notes"         TEXT,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ShiftAssignment_shiftId_idx"       ON "ShiftAssignment"("shiftId");
CREATE INDEX IF NOT EXISTS "ShiftAssignment_employeeId_idx"    ON "ShiftAssignment"("employeeId");
CREATE INDEX IF NOT EXISTS "ShiftAssignment_effectiveFrom_idx" ON "ShiftAssignment"("effectiveFrom");

-- ── Production Planning & MES ────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE "PlanStatus" AS ENUM ('DRAFT','RELEASED','IN_PROGRESS','COMPLETED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ExecutionStatus" AS ENUM ('QUEUED','IN_PROGRESS','PAUSED','COMPLETED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "DowntimeReason" AS ENUM (
    'BREAKDOWN','SETUP','MATERIAL_SHORTAGE','QUALITY_ISSUE',
    'POWER_OUTAGE','PLANNED_MAINTENANCE','OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "ProductionPlan" (
    "id"           SERIAL PRIMARY KEY,
    "planNumber"   TEXT NOT NULL,
    "title"        TEXT NOT NULL,
    "description"  TEXT,
    "startDate"    DATE NOT NULL,
    "endDate"      DATE NOT NULL,
    "status"       "PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "priority"     TEXT NOT NULL DEFAULT 'MEDIUM',
    "shiftId"      INTEGER REFERENCES "Shift"("id") ON DELETE SET NULL,
    "machineId"    INTEGER REFERENCES "Machine"("id") ON DELETE SET NULL,
    "targetQtyKg"  DECIMAL(10,2),
    "notes"        TEXT,
    "createdById"  TEXT NOT NULL REFERENCES "user"("id"),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "ProductionPlan_planNumber_key" ON "ProductionPlan"("planNumber");
CREATE INDEX IF NOT EXISTS "ProductionPlan_status_idx"      ON "ProductionPlan"("status");
CREATE INDEX IF NOT EXISTS "ProductionPlan_dates_idx"       ON "ProductionPlan"("startDate","endDate");
CREATE INDEX IF NOT EXISTS "ProductionPlan_createdById_idx" ON "ProductionPlan"("createdById");

CREATE TABLE IF NOT EXISTS "WorkExecution" (
    "id"           SERIAL PRIMARY KEY,
    "orderId"      INTEGER NOT NULL REFERENCES "ProductionOrder"("id"),
    "operatorId"   INTEGER REFERENCES "Employee"("id") ON DELETE SET NULL,
    "machineId"    INTEGER REFERENCES "Machine"("id") ON DELETE SET NULL,
    "status"       "ExecutionStatus" NOT NULL DEFAULT 'QUEUED',
    "startedAt"    TIMESTAMP(3),
    "completedAt"  TIMESTAMP(3),
    "qtyProduced"  INTEGER NOT NULL DEFAULT 0,
    "qtyScrap"     INTEGER NOT NULL DEFAULT 0,
    "notes"        TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "WorkExecution_orderId_idx"    ON "WorkExecution"("orderId");
CREATE INDEX IF NOT EXISTS "WorkExecution_operatorId_idx" ON "WorkExecution"("operatorId");
CREATE INDEX IF NOT EXISTS "WorkExecution_status_idx"     ON "WorkExecution"("status");

CREATE TABLE IF NOT EXISTS "DowntimeEvent" (
    "id"           SERIAL PRIMARY KEY,
    "executionId"  INTEGER NOT NULL REFERENCES "WorkExecution"("id") ON DELETE CASCADE,
    "reason"       "DowntimeReason" NOT NULL,
    "startedAt"    TIMESTAMP(3) NOT NULL,
    "endedAt"      TIMESTAMP(3),
    "durationMin"  INTEGER,
    "notes"        TEXT,
    "reportedById" TEXT NOT NULL REFERENCES "user"("id"),
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "DowntimeEvent_executionId_idx" ON "DowntimeEvent"("executionId");
CREATE INDEX IF NOT EXISTS "DowntimeEvent_reason_idx"      ON "DowntimeEvent"("reason");
