-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "PersonType" AS ENUM ('STUDENT', 'TEACHER');

-- CreateEnum
CREATE TYPE "TapType" AS ENUM ('CLOCK_IN', 'CLOCK_OUT', 'PRAYER', 'OTHER');

-- CreateEnum
CREATE TYPE "PrayerSlot" AS ENUM ('DHUHA', 'DHUHUR', 'ASHAR');

-- CreateEnum
CREATE TYPE "TapDecision" AS ENUM ('ACCEPTED', 'DUPLICATE', 'REJECTED', 'UNKNOWN_CARD');

-- CreateEnum
CREATE TYPE "RuleScope" AS ENUM ('GLOBAL', 'CLASS', 'PERSON');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('HADIR', 'TERLAMBAT', 'IZIN', 'SAKIT', 'ALFA', 'LIBUR');

-- CreateEnum
CREATE TYPE "CardStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'LOST');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ACTIVE', 'DISABLED', 'MAINTENANCE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'VIEWER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicYear" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcademicYear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassRoom" (
    "id" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "type" "PersonType" NOT NULL,
    "nis" TEXT,
    "nip" TEXT,
    "fullName" TEXT NOT NULL,
    "gender" TEXT,
    "phone" TEXT,
    "photoUrl" TEXT,
    "classId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfidCard" (
    "id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "label" TEXT,
    "personId" TEXT,
    "status" "CardStatus" NOT NULL DEFAULT 'ACTIVE',
    "assignedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RfidCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "apiKeyHash" TEXT NOT NULL,
    "status" "DeviceStatus" NOT NULL DEFAULT 'ACTIVE',
    "firmwareVersion" TEXT,
    "ipAddress" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "config" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TapRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TapType" NOT NULL,
    "prayerSlot" "PrayerSlot",
    "scope" "RuleScope" NOT NULL DEFAULT 'GLOBAL',
    "classId" TEXT,
    "personId" TEXT,
    "daysOfWeek" INTEGER[],
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,
    "minGapMinutes" INTEGER NOT NULL DEFAULT 2,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "validFrom" DATE,
    "validTo" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TapRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TapLog" (
    "id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "personId" TEXT,
    "tappedAt" TIMESTAMPTZ NOT NULL,
    "deviceTs" TIMESTAMPTZ,
    "tapType" "TapType",
    "prayerSlot" "PrayerSlot",
    "decision" "TapDecision" NOT NULL,
    "ruleId" TEXT,
    "reason" TEXT,
    "rawPayload" JSONB,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TapLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceDaily" (
    "id" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'ALFA',
    "checkInAt" TIMESTAMPTZ,
    "checkOutAt" TIMESTAMPTZ,
    "lateMinutes" INTEGER NOT NULL DEFAULT 0,
    "prayerDhuhaAt" TIMESTAMPTZ,
    "prayerDhuhurAt" TIMESTAMPTZ,
    "prayerAsharAt" TIMESTAMPTZ,
    "note" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceDaily_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "isSchoolDay" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicYear_name_key" ON "AcademicYear"("name");

-- CreateIndex
CREATE INDEX "AcademicYear_isActive_idx" ON "AcademicYear"("isActive");

-- CreateIndex
CREATE INDEX "ClassRoom_academicYearId_idx" ON "ClassRoom"("academicYearId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassRoom_academicYearId_name_key" ON "ClassRoom"("academicYearId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Person_nis_key" ON "Person"("nis");

-- CreateIndex
CREATE UNIQUE INDEX "Person_nip_key" ON "Person"("nip");

-- CreateIndex
CREATE INDEX "Person_type_isActive_idx" ON "Person"("type", "isActive");

-- CreateIndex
CREATE INDEX "Person_classId_idx" ON "Person"("classId");

-- CreateIndex
CREATE INDEX "Person_fullName_idx" ON "Person"("fullName");

-- CreateIndex
CREATE UNIQUE INDEX "RfidCard_uid_key" ON "RfidCard"("uid");

-- CreateIndex
CREATE INDEX "RfidCard_personId_status_idx" ON "RfidCard"("personId", "status");

-- CreateIndex
CREATE INDEX "RfidCard_status_idx" ON "RfidCard"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Device_code_key" ON "Device"("code");

-- CreateIndex
CREATE INDEX "TapRule_isActive_type_idx" ON "TapRule"("isActive", "type");

-- CreateIndex
CREATE INDEX "TapRule_classId_idx" ON "TapRule"("classId");

-- CreateIndex
CREATE INDEX "TapRule_personId_idx" ON "TapRule"("personId");

-- CreateIndex
CREATE UNIQUE INDEX "TapLog_idempotencyKey_key" ON "TapLog"("idempotencyKey");

-- CreateIndex
CREATE INDEX "TapLog_personId_tappedAt_idx" ON "TapLog"("personId", "tappedAt");

-- CreateIndex
CREATE INDEX "TapLog_tappedAt_idx" ON "TapLog"("tappedAt");

-- CreateIndex
CREATE INDEX "TapLog_uid_tappedAt_idx" ON "TapLog"("uid", "tappedAt");

-- CreateIndex
CREATE INDEX "TapLog_decision_tappedAt_idx" ON "TapLog"("decision", "tappedAt");

-- CreateIndex
CREATE INDEX "AttendanceDaily_date_status_idx" ON "AttendanceDaily"("date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceDaily_personId_date_key" ON "AttendanceDaily"("personId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_date_key" ON "Holiday"("date");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_idx" ON "AuditLog"("entity", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "ClassRoom" ADD CONSTRAINT "ClassRoom_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Person" ADD CONSTRAINT "Person_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfidCard" ADD CONSTRAINT "RfidCard_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TapRule" ADD CONSTRAINT "TapRule_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TapRule" ADD CONSTRAINT "TapRule_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TapLog" ADD CONSTRAINT "TapLog_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TapLog" ADD CONSTRAINT "TapLog_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceDaily" ADD CONSTRAINT "AttendanceDaily_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
