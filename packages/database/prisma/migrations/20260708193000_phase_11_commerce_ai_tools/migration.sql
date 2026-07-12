ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'CONFIRMED';

CREATE TYPE "ProductStatus" AS ENUM ('DRAFT', 'ACTIVE', 'OUT_OF_STOCK', 'ARCHIVED');
CREATE TYPE "DeliveryStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'READY', 'SHIPPED', 'DELIVERED', 'FAILED', 'RETURNED');
CREATE TYPE "OrderSource" AS ENUM ('MANUAL', 'INBOX', 'AI', 'SIMULATOR', 'WHATSAPP');
CREATE TYPE "AiToolCallStatus" AS ENUM ('SUCCESS', 'FAILED', 'BLOCKED');

ALTER TABLE "Product"
  ADD COLUMN "stockQuantity" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE "Order"
  ADD COLUMN "conversationId" TEXT,
  ADD COLUMN "orderNumber" TEXT,
  ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "deliveryStatus" "DeliveryStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "source" "OrderSource" NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN "subtotalAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "customerName" TEXT,
  ADD COLUMN "customerPhone" TEXT,
  ADD COLUMN "customerEmail" TEXT,
  ADD COLUMN "deliveryAddress" TEXT,
  ADD COLUMN "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "approvedAt" TIMESTAMP(3),
  ADD COLUMN "approvedByUserId" TEXT,
  ADD COLUMN "confirmedAt" TIMESTAMP(3);

UPDATE "Order" SET "subtotalAmount" = "totalAmount" WHERE "subtotalAmount" = 0;

ALTER TABLE "OrderItem"
  ADD COLUMN "sku" TEXT,
  ADD COLUMN "lineTotal" DECIMAL(12,2) NOT NULL DEFAULT 0;

UPDATE "OrderItem" SET "lineTotal" = "unitPrice" * "quantity" WHERE "lineTotal" = 0;

CREATE TABLE "ProductImage" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "alt" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderTimelineEvent" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "type" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "OrderTimelineEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiToolCallLog" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "actorUserId" TEXT,
  "conversationId" TEXT,
  "orderId" TEXT,
  "toolName" TEXT NOT NULL,
  "status" "AiToolCallStatus" NOT NULL,
  "input" JSONB,
  "output" JSONB,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "AiToolCallLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Product_tenantId_status_idx" ON "Product"("tenantId", "status");
CREATE INDEX "Product_tenantId_stockQuantity_idx" ON "Product"("tenantId", "stockQuantity");

CREATE INDEX "ProductImage_tenantId_idx" ON "ProductImage"("tenantId");
CREATE INDEX "ProductImage_tenantId_productId_idx" ON "ProductImage"("tenantId", "productId");
CREATE INDEX "ProductImage_tenantId_productId_position_idx" ON "ProductImage"("tenantId", "productId", "position");
CREATE INDEX "ProductImage_createdAt_idx" ON "ProductImage"("createdAt");
CREATE INDEX "ProductImage_deletedAt_idx" ON "ProductImage"("deletedAt");

CREATE UNIQUE INDEX "Order_tenantId_orderNumber_key" ON "Order"("tenantId", "orderNumber");
CREATE INDEX "Order_tenantId_conversationId_idx" ON "Order"("tenantId", "conversationId");
CREATE INDEX "Order_tenantId_paymentStatus_idx" ON "Order"("tenantId", "paymentStatus");
CREATE INDEX "Order_tenantId_deliveryStatus_idx" ON "Order"("tenantId", "deliveryStatus");
CREATE INDEX "Order_tenantId_source_idx" ON "Order"("tenantId", "source");

CREATE INDEX "OrderItem_tenantId_productId_idx" ON "OrderItem"("tenantId", "productId");

CREATE INDEX "OrderTimelineEvent_tenantId_idx" ON "OrderTimelineEvent"("tenantId");
CREATE INDEX "OrderTimelineEvent_tenantId_orderId_idx" ON "OrderTimelineEvent"("tenantId", "orderId");
CREATE INDEX "OrderTimelineEvent_tenantId_type_idx" ON "OrderTimelineEvent"("tenantId", "type");
CREATE INDEX "OrderTimelineEvent_createdAt_idx" ON "OrderTimelineEvent"("createdAt");
CREATE INDEX "OrderTimelineEvent_deletedAt_idx" ON "OrderTimelineEvent"("deletedAt");

CREATE INDEX "AiToolCallLog_tenantId_idx" ON "AiToolCallLog"("tenantId");
CREATE INDEX "AiToolCallLog_tenantId_actorUserId_idx" ON "AiToolCallLog"("tenantId", "actorUserId");
CREATE INDEX "AiToolCallLog_tenantId_conversationId_idx" ON "AiToolCallLog"("tenantId", "conversationId");
CREATE INDEX "AiToolCallLog_tenantId_orderId_idx" ON "AiToolCallLog"("tenantId", "orderId");
CREATE INDEX "AiToolCallLog_tenantId_toolName_idx" ON "AiToolCallLog"("tenantId", "toolName");
CREATE INDEX "AiToolCallLog_tenantId_status_idx" ON "AiToolCallLog"("tenantId", "status");
CREATE INDEX "AiToolCallLog_createdAt_idx" ON "AiToolCallLog"("createdAt");
CREATE INDEX "AiToolCallLog_deletedAt_idx" ON "AiToolCallLog"("deletedAt");

ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Order" ADD CONSTRAINT "Order_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrderTimelineEvent" ADD CONSTRAINT "OrderTimelineEvent_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderTimelineEvent" ADD CONSTRAINT "OrderTimelineEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderTimelineEvent" ADD CONSTRAINT "OrderTimelineEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AiToolCallLog" ADD CONSTRAINT "AiToolCallLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AiToolCallLog" ADD CONSTRAINT "AiToolCallLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiToolCallLog" ADD CONSTRAINT "AiToolCallLog_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AiToolCallLog" ADD CONSTRAINT "AiToolCallLog_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
