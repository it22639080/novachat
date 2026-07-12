CREATE TYPE "AppointmentSource" AS ENUM ('MANUAL', 'INBOX', 'AI', 'SIMULATOR', 'WHATSAPP', 'PUBLIC_BOOKING');

CREATE TABLE "ServiceOffering" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "description" TEXT,
  "durationMinutes" INTEGER NOT NULL DEFAULT 30,
  "price" DECIMAL(12,2),
  "currency" "Currency" NOT NULL DEFAULT 'USD',
  "bufferBeforeMinutes" INTEGER NOT NULL DEFAULT 0,
  "bufferAfterMinutes" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "ServiceOffering_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StaffAvailability" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "staffUserId" TEXT NOT NULL,
  "dayOfWeek" INTEGER NOT NULL,
  "startsAt" TEXT NOT NULL,
  "endsAt" TEXT NOT NULL,
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "StaffAvailability_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppointmentTimelineEvent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "appointmentId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "type" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "AppointmentTimelineEvent_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Appointment"
  ADD COLUMN "serviceId" TEXT,
  ADD COLUMN "staffUserId" TEXT,
  ADD COLUMN "conversationId" TEXT,
  ADD COLUMN "source" "AppointmentSource" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "customerName" TEXT,
  ADD COLUMN "customerPhone" TEXT,
  ADD COLUMN "customerEmail" TEXT,
  ADD COLUMN "location" TEXT,
  ADD COLUMN "reminderScheduledAt" TIMESTAMP(3),
  ADD COLUMN "reminderSentAt" TIMESTAMP(3),
  ADD COLUMN "googleCalendarEventId" TEXT,
  ADD COLUMN "googleCalendarSyncStatus" TEXT,
  ADD COLUMN "cancellationReason" TEXT;

ALTER TABLE "AiToolCallLog"
  ADD COLUMN "appointmentId" TEXT;

CREATE UNIQUE INDEX "ServiceOffering_tenantId_slug_key" ON "ServiceOffering"("tenantId", "slug");
CREATE INDEX "ServiceOffering_tenantId_idx" ON "ServiceOffering"("tenantId");
CREATE INDEX "ServiceOffering_tenantId_isActive_idx" ON "ServiceOffering"("tenantId", "isActive");
CREATE INDEX "ServiceOffering_tenantId_durationMinutes_idx" ON "ServiceOffering"("tenantId", "durationMinutes");
CREATE INDEX "ServiceOffering_createdAt_idx" ON "ServiceOffering"("createdAt");
CREATE INDEX "ServiceOffering_deletedAt_idx" ON "ServiceOffering"("deletedAt");

CREATE INDEX "StaffAvailability_tenantId_idx" ON "StaffAvailability"("tenantId");
CREATE INDEX "StaffAvailability_tenantId_staffUserId_idx" ON "StaffAvailability"("tenantId", "staffUserId");
CREATE INDEX "StaffAvailability_tenantId_dayOfWeek_idx" ON "StaffAvailability"("tenantId", "dayOfWeek");
CREATE INDEX "StaffAvailability_tenantId_isActive_idx" ON "StaffAvailability"("tenantId", "isActive");
CREATE INDEX "StaffAvailability_createdAt_idx" ON "StaffAvailability"("createdAt");
CREATE INDEX "StaffAvailability_deletedAt_idx" ON "StaffAvailability"("deletedAt");

CREATE INDEX "Appointment_tenantId_serviceId_idx" ON "Appointment"("tenantId", "serviceId");
CREATE INDEX "Appointment_tenantId_staffUserId_idx" ON "Appointment"("tenantId", "staffUserId");
CREATE INDEX "Appointment_tenantId_conversationId_idx" ON "Appointment"("tenantId", "conversationId");
CREATE INDEX "Appointment_tenantId_source_idx" ON "Appointment"("tenantId", "source");
CREATE INDEX "Appointment_tenantId_reminderScheduledAt_idx" ON "Appointment"("tenantId", "reminderScheduledAt");

CREATE INDEX "AppointmentTimelineEvent_tenantId_idx" ON "AppointmentTimelineEvent"("tenantId");
CREATE INDEX "AppointmentTimelineEvent_tenantId_appointmentId_idx" ON "AppointmentTimelineEvent"("tenantId", "appointmentId");
CREATE INDEX "AppointmentTimelineEvent_tenantId_type_idx" ON "AppointmentTimelineEvent"("tenantId", "type");
CREATE INDEX "AppointmentTimelineEvent_createdAt_idx" ON "AppointmentTimelineEvent"("createdAt");
CREATE INDEX "AppointmentTimelineEvent_deletedAt_idx" ON "AppointmentTimelineEvent"("deletedAt");

CREATE INDEX "AiToolCallLog_tenantId_appointmentId_idx" ON "AiToolCallLog"("tenantId", "appointmentId");

ALTER TABLE "ServiceOffering" ADD CONSTRAINT "ServiceOffering_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StaffAvailability" ADD CONSTRAINT "StaffAvailability_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StaffAvailability" ADD CONSTRAINT "StaffAvailability_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ServiceOffering"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_staffUserId_fkey" FOREIGN KEY ("staffUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AppointmentTimelineEvent" ADD CONSTRAINT "AppointmentTimelineEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AppointmentTimelineEvent" ADD CONSTRAINT "AppointmentTimelineEvent_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppointmentTimelineEvent" ADD CONSTRAINT "AppointmentTimelineEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AiToolCallLog" ADD CONSTRAINT "AiToolCallLog_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
