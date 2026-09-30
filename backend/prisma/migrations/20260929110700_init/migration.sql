-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'phc_staff');

-- CreateEnum
CREATE TYPE "MedicineCategory" AS ENUM ('Antibiotic', 'Antipyretic', 'Fluid', 'Antimalarial', 'Cardiac', 'Respiratory', 'Ophthalmic', 'Vaccine', 'Kits', 'Other');

-- CreateEnum
CREATE TYPE "MedicineUnit" AS ENUM ('Tablet', 'Bottle', 'Injection', 'Kit', 'ml', 'mg', 'Strip');

-- CreateEnum
CREATE TYPE "MedicineEventReason" AS ENUM ('received', 'dispensed', 'wasted', 'transfer_in', 'transfer_out');

-- CreateEnum
CREATE TYPE "FootfallEventSource" AS ENUM ('manual', 'simulation', 'scenario');

-- CreateEnum
CREATE TYPE "BedEventReason" AS ENUM ('admission', 'discharge', 'emergency_reserve_change', 'transfer');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('Doctor', 'Nurse', 'Pharmacist', 'LabTech', 'Admin', 'Support');

-- CreateEnum
CREATE TYPE "EmergencyType" AS ENUM ('Dengue', 'Cardiac', 'Respiratory', 'MassCasualty', 'Other');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('low', 'moderate', 'high');

-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('proposed', 'approved', 'rejected', 'executed');

-- CreateEnum
CREATE TYPE "TransferProposedBy" AS ENUM ('ai', 'manual');

-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('stockout', 'bed_crowding', 'staff_shortage', 'emergency', 'anomaly');

-- CreateEnum
CREATE TYPE "AlertSeverity" AS ENUM ('info', 'warning', 'critical');

-- CreateTable
CREATE TABLE "Phc" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "zone" TEXT NOT NULL,
    "catchmentPopulation" INTEGER NOT NULL,
    "totalBeds" INTEGER NOT NULL,
    "totalStaff" INTEGER NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Phc_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "phcId" INTEGER,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medicine" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "genericName" TEXT,
    "category" "MedicineCategory" NOT NULL DEFAULT 'Other',
    "unit" "MedicineUnit" NOT NULL DEFAULT 'Tablet',
    "defaultDailyConsumptionPer100Patients" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    "reorderLevel" INTEGER NOT NULL DEFAULT 100,
    "criticalLevel" INTEGER NOT NULL DEFAULT 30,
    "daysOfStockWarning" INTEGER NOT NULL DEFAULT 7,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Medicine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicineInventory" (
    "id" SERIAL NOT NULL,
    "phcId" INTEGER NOT NULL,
    "medicineId" INTEGER NOT NULL,
    "currentQuantity" INTEGER NOT NULL,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedicineInventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhcStatus" (
    "id" SERIAL NOT NULL,
    "phcId" INTEGER NOT NULL,
    "bedsTotal" INTEGER NOT NULL,
    "bedsOccupied" INTEGER NOT NULL DEFAULT 0,
    "bedsEmergencyReserved" INTEGER NOT NULL DEFAULT 0,
    "staffTotal" INTEGER NOT NULL,
    "staffOnDuty" INTEGER NOT NULL DEFAULT 0,
    "activeEmergency" BOOLEAN NOT NULL DEFAULT false,
    "lastPatientCount" INTEGER NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhcStatus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyFootfallAggregate" (
    "id" SERIAL NOT NULL,
    "phcId" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "outpatient" INTEGER NOT NULL DEFAULT 0,
    "admissions" INTEGER NOT NULL DEFAULT 0,
    "discharges" INTEGER NOT NULL DEFAULT 0,
    "triageMild" INTEGER NOT NULL DEFAULT 0,
    "triageModerate" INTEGER NOT NULL DEFAULT 0,
    "triageSevere" INTEGER NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DailyFootfallAggregate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffRoster" (
    "id" SERIAL NOT NULL,
    "phcId" INTEGER NOT NULL,
    "staffMemberName" TEXT NOT NULL,
    "staffRole" "StaffRole" NOT NULL,
    "isPresent" BOOLEAN NOT NULL DEFAULT true,
    "lastMarked" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffRoster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicineEvent" (
    "id" SERIAL NOT NULL,
    "phcId" INTEGER NOT NULL,
    "medicineId" INTEGER NOT NULL,
    "inventoryId" INTEGER,
    "changeQty" INTEGER NOT NULL,
    "reason" "MedicineEventReason" NOT NULL,
    "referenceId" TEXT,
    "operatorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedicineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FootfallEvent" (
    "id" SERIAL NOT NULL,
    "phcId" INTEGER NOT NULL,
    "outpatientDelta" INTEGER NOT NULL DEFAULT 0,
    "admissionsDelta" INTEGER NOT NULL DEFAULT 0,
    "dischargesDelta" INTEGER NOT NULL DEFAULT 0,
    "triageMildDelta" INTEGER NOT NULL DEFAULT 0,
    "triageModerateDelta" INTEGER NOT NULL DEFAULT 0,
    "triageSevereDelta" INTEGER NOT NULL DEFAULT 0,
    "source" "FootfallEventSource" NOT NULL DEFAULT 'manual',
    "operatorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FootfallEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BedEvent" (
    "id" SERIAL NOT NULL,
    "phcId" INTEGER NOT NULL,
    "occupiedDelta" INTEGER NOT NULL,
    "reason" "BedEventReason" NOT NULL,
    "operatorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BedEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceEvent" (
    "id" SERIAL NOT NULL,
    "phcId" INTEGER NOT NULL,
    "staffRosterId" INTEGER NOT NULL,
    "isPresent" BOOLEAN NOT NULL,
    "operatorId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmergencyEvent" (
    "id" SERIAL NOT NULL,
    "phcId" INTEGER NOT NULL,
    "type" "EmergencyType" NOT NULL,
    "severity" "Severity" NOT NULL,
    "patientCount" INTEGER NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "reportedById" INTEGER NOT NULL,
    "resolvedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "EmergencyEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransferProposal" (
    "id" SERIAL NOT NULL,
    "sourcePhcId" INTEGER NOT NULL,
    "destPhcId" INTEGER NOT NULL,
    "medicineId" INTEGER NOT NULL,
    "proposedQty" INTEGER NOT NULL,
    "rationale" TEXT NOT NULL,
    "riskScore" DOUBLE PRECISION NOT NULL,
    "status" "TransferStatus" NOT NULL DEFAULT 'proposed',
    "proposedBy" "TransferProposedBy" NOT NULL DEFAULT 'ai',
    "adminId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "executedAt" TIMESTAMP(3),

    CONSTRAINT "TransferProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alert" (
    "id" SERIAL NOT NULL,
    "phcId" INTEGER,
    "type" "AlertType" NOT NULL,
    "severity" "AlertSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "relatedRowId" TEXT,
    "dismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Alert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Phc_city_zone_idx" ON "Phc"("city", "zone");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Medicine_name_key" ON "Medicine"("name");

-- CreateIndex
CREATE INDEX "MedicineInventory_phcId_idx" ON "MedicineInventory"("phcId");

-- CreateIndex
CREATE INDEX "MedicineInventory_medicineId_idx" ON "MedicineInventory"("medicineId");

-- CreateIndex
CREATE UNIQUE INDEX "MedicineInventory_phcId_medicineId_key" ON "MedicineInventory"("phcId", "medicineId");

-- CreateIndex
CREATE UNIQUE INDEX "PhcStatus_phcId_key" ON "PhcStatus"("phcId");

-- CreateIndex
CREATE INDEX "DailyFootfallAggregate_phcId_date_idx" ON "DailyFootfallAggregate"("phcId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyFootfallAggregate_phcId_date_key" ON "DailyFootfallAggregate"("phcId", "date");

-- CreateIndex
CREATE INDEX "StaffRoster_phcId_idx" ON "StaffRoster"("phcId");

-- CreateIndex
CREATE INDEX "MedicineEvent_phcId_createdAt_idx" ON "MedicineEvent"("phcId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "MedicineEvent_medicineId_createdAt_idx" ON "MedicineEvent"("medicineId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "MedicineEvent_reason_createdAt_idx" ON "MedicineEvent"("reason", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "FootfallEvent_phcId_createdAt_idx" ON "FootfallEvent"("phcId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "FootfallEvent_source_createdAt_idx" ON "FootfallEvent"("source", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "BedEvent_phcId_createdAt_idx" ON "BedEvent"("phcId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AttendanceEvent_phcId_createdAt_idx" ON "AttendanceEvent"("phcId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "AttendanceEvent_staffRosterId_createdAt_idx" ON "AttendanceEvent"("staffRosterId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "EmergencyEvent_phcId_isActive_createdAt_idx" ON "EmergencyEvent"("phcId", "isActive", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "EmergencyEvent_severity_createdAt_idx" ON "EmergencyEvent"("severity", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "TransferProposal_status_createdAt_idx" ON "TransferProposal"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "TransferProposal_sourcePhcId_status_idx" ON "TransferProposal"("sourcePhcId", "status");

-- CreateIndex
CREATE INDEX "TransferProposal_destPhcId_status_idx" ON "TransferProposal"("destPhcId", "status");

-- CreateIndex
CREATE INDEX "Alert_severity_dismissed_createdAt_idx" ON "Alert"("severity", "dismissed", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Alert_phcId_createdAt_idx" ON "Alert"("phcId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_phcId_fkey" FOREIGN KEY ("phcId") REFERENCES "Phc"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicineInventory" ADD CONSTRAINT "MedicineInventory_phcId_fkey" FOREIGN KEY ("phcId") REFERENCES "Phc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicineInventory" ADD CONSTRAINT "MedicineInventory_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "Medicine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhcStatus" ADD CONSTRAINT "PhcStatus_phcId_fkey" FOREIGN KEY ("phcId") REFERENCES "Phc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyFootfallAggregate" ADD CONSTRAINT "DailyFootfallAggregate_phcId_fkey" FOREIGN KEY ("phcId") REFERENCES "Phc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffRoster" ADD CONSTRAINT "StaffRoster_phcId_fkey" FOREIGN KEY ("phcId") REFERENCES "Phc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicineEvent" ADD CONSTRAINT "MedicineEvent_phcId_fkey" FOREIGN KEY ("phcId") REFERENCES "Phc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicineEvent" ADD CONSTRAINT "MedicineEvent_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "Medicine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicineEvent" ADD CONSTRAINT "MedicineEvent_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "MedicineInventory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicineEvent" ADD CONSTRAINT "MedicineEvent_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FootfallEvent" ADD CONSTRAINT "FootfallEvent_phcId_fkey" FOREIGN KEY ("phcId") REFERENCES "Phc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FootfallEvent" ADD CONSTRAINT "FootfallEvent_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BedEvent" ADD CONSTRAINT "BedEvent_phcId_fkey" FOREIGN KEY ("phcId") REFERENCES "Phc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BedEvent" ADD CONSTRAINT "BedEvent_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_phcId_fkey" FOREIGN KEY ("phcId") REFERENCES "Phc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_staffRosterId_fkey" FOREIGN KEY ("staffRosterId") REFERENCES "StaffRoster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceEvent" ADD CONSTRAINT "AttendanceEvent_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyEvent" ADD CONSTRAINT "EmergencyEvent_phcId_fkey" FOREIGN KEY ("phcId") REFERENCES "Phc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyEvent" ADD CONSTRAINT "EmergencyEvent_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyEvent" ADD CONSTRAINT "EmergencyEvent_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferProposal" ADD CONSTRAINT "TransferProposal_sourcePhcId_fkey" FOREIGN KEY ("sourcePhcId") REFERENCES "Phc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferProposal" ADD CONSTRAINT "TransferProposal_destPhcId_fkey" FOREIGN KEY ("destPhcId") REFERENCES "Phc"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferProposal" ADD CONSTRAINT "TransferProposal_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "Medicine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransferProposal" ADD CONSTRAINT "TransferProposal_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alert" ADD CONSTRAINT "Alert_phcId_fkey" FOREIGN KEY ("phcId") REFERENCES "Phc"("id") ON DELETE SET NULL ON UPDATE CASCADE;
