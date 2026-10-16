-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('OWNER', 'STUDIO_MANAGER', 'STYLIST', 'FULFILLMENT');

-- CreateEnum
CREATE TYPE "CustomerTier" AS ENUM ('GUEST', 'MEMBER', 'PARIS_CLUB');

-- CreateEnum
CREATE TYPE "DressStatus" AS ENUM ('AVAILABLE', 'RENTED', 'CLEANING', 'RETIRED');

-- CreateEnum
CREATE TYPE "ImageKind" AS ENUM ('FRONT', 'BACK', 'DETAIL', 'ON_BODY', 'MOVEMENT');

-- CreateEnum
CREATE TYPE "ConditionSeverity" AS ENUM ('NOTE', 'MINOR', 'MAJOR');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'SHIPPED', 'WITH_CUSTOMER', 'LATE', 'RETURNED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'AUTHORIZED', 'PAID', 'REFUNDED', 'FAILED');

-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('NONE', 'HELD', 'REFUNDED', 'FORFEITED');

-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('RENTAL', 'DEPOSIT', 'ADD_ON', 'INSURANCE', 'LATE_FEE', 'REFUND');

-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('STRIPE', 'STUDIO');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CARD', 'APPLE_PAY', 'GOOGLE_PAY', 'BNPL', 'STUDIO_CREDIT');

-- CreateEnum
CREATE TYPE "BookingEventType" AS ENUM ('CREATED', 'STATUS_CHANGE', 'NOTE', 'EXTENSION', 'PAYMENT', 'REFUND', 'CLEANING', 'TICKET');

-- CreateEnum
CREATE TYPE "AddOnCategory" AS ENUM ('ACCESSORY', 'FIT', 'COVERAGE', 'DELIVERY');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('OPEN', 'RESOLVED');

-- CreateEnum
CREATE TYPE "InquiryTopic" AS ENUM ('SIZING', 'BOOKING_CHANGE', 'GROUP_BOOKING', 'DELIVERY', 'DAMAGE', 'GENERAL');

-- CreateEnum
CREATE TYPE "InquiryChannel" AS ENUM ('CONTACT_FORM', 'DRESS_PAGE', 'EMAIL', 'PHONE');

-- CreateEnum
CREATE TYPE "TemplateChannel" AS ENUM ('EMAIL', 'SMS');

-- CreateTable
CREATE TABLE "StaffUser" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL DEFAULT 'STYLIST',
    "title" TEXT NOT NULL,
    "phone" TEXT,
    "accentTone" TEXT NOT NULL DEFAULT 'rose',
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "lastActiveAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "tier" "CustomerTier" NOT NULL DEFAULT 'MEMBER',
    "passwordHash" TEXT,
    "lifetimeSpend" INTEGER NOT NULL DEFAULT 0,
    "rentalsCount" INTEGER NOT NULL DEFAULT 0,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "region" TEXT,
    "postalCode" TEXT,
    "country" TEXT DEFAULT 'United States',
    "memberSince" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creditBalance" INTEGER NOT NULL DEFAULT 0,
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "lastActiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Measurement" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "heightCm" INTEGER,
    "bustCm" INTEGER,
    "waistCm" INTEGER,
    "hipsCm" INTEGER,
    "dressSizeLabel" TEXT,
    "backupSize" TEXT,
    "shoeSize" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Measurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerNote" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "staffId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dress" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "designer" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "occasion" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "colorHex" TEXT NOT NULL,
    "length" TEXT NOT NULL,
    "neckline" TEXT NOT NULL,
    "sleeve" TEXT NOT NULL,
    "fabric" TEXT NOT NULL,
    "retailValue" INTEGER NOT NULL,
    "rentalPrice4" INTEGER NOT NULL,
    "rentalPrice8" INTEGER NOT NULL,
    "deposit" INTEGER NOT NULL,
    "status" "DressStatus" NOT NULL DEFAULT 'AVAILABLE',
    "timesRented" INTEGER NOT NULL DEFAULT 0,
    "careNotes" TEXT NOT NULL,
    "fitNotes" TEXT NOT NULL,
    "story" TEXT NOT NULL,
    "artTone" TEXT NOT NULL,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "isNewArrival" BOOLEAN NOT NULL DEFAULT false,
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Dress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DressSize" (
    "id" TEXT NOT NULL,
    "dressId" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DressSize_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DressImage" (
    "id" TEXT NOT NULL,
    "dressId" TEXT NOT NULL,
    "kind" "ImageKind" NOT NULL,
    "alt" TEXT NOT NULL,
    "caption" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DressImage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DressBlock" (
    "id" TEXT NOT NULL,
    "dressId" TEXT NOT NULL,
    "size" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "staffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DressBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CleaningRecord" (
    "id" TEXT NOT NULL,
    "dressId" TEXT NOT NULL,
    "bookingId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "method" TEXT NOT NULL DEFAULT 'Specialist dry clean',
    "note" TEXT,
    "staffId" TEXT,

    CONSTRAINT "CleaningRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConditionLog" (
    "id" TEXT NOT NULL,
    "dressId" TEXT NOT NULL,
    "bookingId" TEXT,
    "severity" "ConditionSeverity" NOT NULL DEFAULT 'NOTE',
    "summary" TEXT NOT NULL,
    "detail" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "staffId" TEXT,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConditionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "dressId" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "backupSize" TEXT,
    "eventType" TEXT NOT NULL,
    "eventDate" DATE NOT NULL,
    "deliveryDate" DATE NOT NULL,
    "returnDate" DATE NOT NULL,
    "rentalDays" INTEGER NOT NULL DEFAULT 4,
    "bufferDays" INTEGER NOT NULL DEFAULT 1,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "addOnTotal" INTEGER NOT NULL DEFAULT 0,
    "insuranceFee" INTEGER NOT NULL DEFAULT 0,
    "lateFee" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "deposit" INTEGER NOT NULL DEFAULT 0,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "depositStatus" "DepositStatus" NOT NULL DEFAULT 'NONE',
    "paymentRef" TEXT,
    "paymentMethod" "PaymentMethod",
    "trackingNumber" TEXT,
    "courier" TEXT,
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "returnScannedAt" TIMESTAMP(3),
    "lateNotifiedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "refundAmount" INTEGER NOT NULL DEFAULT 0,
    "cleaningCompleteAt" TIMESTAMP(3),
    "shipName" TEXT NOT NULL,
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "city" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'United States',
    "notes" TEXT,
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingEvent" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "type" "BookingEventType" NOT NULL,
    "fromValue" TEXT,
    "toValue" TEXT,
    "summary" TEXT NOT NULL,
    "detail" TEXT,
    "staffId" TEXT,
    "visibleToCustomer" BOOLEAN NOT NULL DEFAULT false,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Accessory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "AddOnCategory" NOT NULL DEFAULT 'ACCESSORY',
    "description" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "dressId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Accessory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingAddOn" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "accessoryId" TEXT,
    "label" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "BookingAddOn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT,
    "customerId" TEXT NOT NULL,
    "kind" "PaymentKind" NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'STUDIO',
    "method" "PaymentMethod" NOT NULL DEFAULT 'CARD',
    "providerRef" TEXT,
    "cardLast4" TEXT,
    "capturedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inquiry" (
    "id" TEXT NOT NULL DEFAULT 'INQ-0000',
    "customerId" TEXT,
    "guestName" TEXT NOT NULL,
    "guestEmail" TEXT NOT NULL,
    "guestPhone" TEXT,
    "subject" TEXT NOT NULL,
    "topic" "InquiryTopic" NOT NULL,
    "channel" "InquiryChannel" NOT NULL DEFAULT 'CONTACT_FORM',
    "message" TEXT NOT NULL,
    "status" "InquiryStatus" NOT NULL DEFAULT 'OPEN',
    "assignedToId" TEXT,
    "resolvedById" TEXT,
    "bookingId" TEXT,
    "firstReplyAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "repliesCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Inquiry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reply" (
    "id" TEXT NOT NULL,
    "inquiryId" TEXT NOT NULL,
    "staffId" TEXT,
    "body" TEXT NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "channel" TEXT NOT NULL DEFAULT 'email',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "staffId" TEXT,
    "actorLabel" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudioSettings" (
    "id" TEXT NOT NULL DEFAULT 'studio',
    "rentalPeriods" INTEGER[] DEFAULT ARRAY[4, 8]::INTEGER[],
    "bufferDays" INTEGER NOT NULL DEFAULT 1,
    "prepDays" INTEGER NOT NULL DEFAULT 1,
    "lateFeePerDay" INTEGER NOT NULL DEFAULT 2500,
    "lateGraceDays" INTEGER NOT NULL DEFAULT 1,
    "depositPercent" INTEGER NOT NULL DEFAULT 20,
    "insuranceFee" INTEGER NOT NULL DEFAULT 1500,
    "cancellationWindowDays" INTEGER NOT NULL DEFAULT 7,
    "cleaningTurnaroundHours" INTEGER NOT NULL DEFAULT 48,
    "businessHours" JSONB NOT NULL,
    "deliveryZones" JSONB NOT NULL,
    "studioEmail" TEXT NOT NULL DEFAULT 'studio@maisonreve.com',
    "studioPhone" TEXT NOT NULL DEFAULT '(617) 555-0148',
    "studioAddress" TEXT NOT NULL DEFAULT '418 Newbury Street, Floor 3, Boston, MA 02115',
    "replyTargetHours" INTEGER NOT NULL DEFAULT 2,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudioSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" "TemplateChannel" NOT NULL DEFAULT 'EMAIL',
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "dressId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventList" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "eventDate" DATE,
    "occasion" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventListItem" (
    "id" TEXT NOT NULL,
    "eventListId" TEXT NOT NULL,
    "dressId" TEXT NOT NULL,
    "size" TEXT,
    "note" TEXT,

    CONSTRAINT "EventListItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'home',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscriber_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffUser_email_key" ON "StaffUser"("email");

-- CreateIndex
CREATE INDEX "StaffUser_role_idx" ON "StaffUser"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

-- CreateIndex
CREATE INDEX "Customer_tier_idx" ON "Customer"("tier");

-- CreateIndex
CREATE INDEX "Customer_name_idx" ON "Customer"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Measurement_customerId_key" ON "Measurement"("customerId");

-- CreateIndex
CREATE INDEX "CustomerNote_customerId_createdAt_idx" ON "CustomerNote"("customerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Dress_slug_key" ON "Dress"("slug");

-- CreateIndex
CREATE INDEX "Dress_category_idx" ON "Dress"("category");

-- CreateIndex
CREATE INDEX "Dress_status_idx" ON "Dress"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DressSize_dressId_size_key" ON "DressSize"("dressId", "size");

-- CreateIndex
CREATE INDEX "DressImage_dressId_position_idx" ON "DressImage"("dressId", "position");

-- CreateIndex
CREATE INDEX "DressBlock_dressId_startDate_endDate_idx" ON "DressBlock"("dressId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "CleaningRecord_dressId_startedAt_idx" ON "CleaningRecord"("dressId", "startedAt");

-- CreateIndex
CREATE INDEX "ConditionLog_dressId_loggedAt_idx" ON "ConditionLog"("dressId", "loggedAt");

-- CreateIndex
CREATE INDEX "Booking_status_idx" ON "Booking"("status");

-- CreateIndex
CREATE INDEX "Booking_dressId_size_deliveryDate_returnDate_idx" ON "Booking"("dressId", "size", "deliveryDate", "returnDate");

-- CreateIndex
CREATE INDEX "Booking_returnDate_idx" ON "Booking"("returnDate");

-- CreateIndex
CREATE INDEX "Booking_customerId_idx" ON "Booking"("customerId");

-- CreateIndex
CREATE INDEX "BookingEvent_bookingId_occurredAt_idx" ON "BookingEvent"("bookingId", "occurredAt");

-- CreateIndex
CREATE INDEX "Accessory_category_idx" ON "Accessory"("category");

-- CreateIndex
CREATE INDEX "BookingAddOn_bookingId_idx" ON "BookingAddOn"("bookingId");

-- CreateIndex
CREATE INDEX "Payment_bookingId_idx" ON "Payment"("bookingId");

-- CreateIndex
CREATE INDEX "Payment_customerId_createdAt_idx" ON "Payment"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "Inquiry_status_receivedAt_idx" ON "Inquiry"("status", "receivedAt");

-- CreateIndex
CREATE INDEX "Reply_inquiryId_sentAt_idx" ON "Reply"("inquiryId", "sentAt");

-- CreateIndex
CREATE INDEX "AuditLog_entity_entityId_timestamp_idx" ON "AuditLog"("entity", "entityId", "timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_customerId_dressId_key" ON "Favorite"("customerId", "dressId");

-- CreateIndex
CREATE INDEX "EventList_customerId_idx" ON "EventList"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "EventListItem_eventListId_dressId_key" ON "EventListItem"("eventListId", "dressId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscriber_email_key" ON "Subscriber"("email");

-- AddForeignKey
ALTER TABLE "Measurement" ADD CONSTRAINT "Measurement_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerNote" ADD CONSTRAINT "CustomerNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerNote" ADD CONSTRAINT "CustomerNote_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DressSize" ADD CONSTRAINT "DressSize_dressId_fkey" FOREIGN KEY ("dressId") REFERENCES "Dress"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DressImage" ADD CONSTRAINT "DressImage_dressId_fkey" FOREIGN KEY ("dressId") REFERENCES "Dress"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DressBlock" ADD CONSTRAINT "DressBlock_dressId_fkey" FOREIGN KEY ("dressId") REFERENCES "Dress"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DressBlock" ADD CONSTRAINT "DressBlock_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleaningRecord" ADD CONSTRAINT "CleaningRecord_dressId_fkey" FOREIGN KEY ("dressId") REFERENCES "Dress"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleaningRecord" ADD CONSTRAINT "CleaningRecord_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleaningRecord" ADD CONSTRAINT "CleaningRecord_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConditionLog" ADD CONSTRAINT "ConditionLog_dressId_fkey" FOREIGN KEY ("dressId") REFERENCES "Dress"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConditionLog" ADD CONSTRAINT "ConditionLog_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConditionLog" ADD CONSTRAINT "ConditionLog_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_dressId_fkey" FOREIGN KEY ("dressId") REFERENCES "Dress"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingEvent" ADD CONSTRAINT "BookingEvent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingEvent" ADD CONSTRAINT "BookingEvent_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Accessory" ADD CONSTRAINT "Accessory_dressId_fkey" FOREIGN KEY ("dressId") REFERENCES "Dress"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingAddOn" ADD CONSTRAINT "BookingAddOn_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingAddOn" ADD CONSTRAINT "BookingAddOn_accessoryId_fkey" FOREIGN KEY ("accessoryId") REFERENCES "Accessory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inquiry" ADD CONSTRAINT "Inquiry_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reply" ADD CONSTRAINT "Reply_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "Inquiry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reply" ADD CONSTRAINT "Reply_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_dressId_fkey" FOREIGN KEY ("dressId") REFERENCES "Dress"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventList" ADD CONSTRAINT "EventList_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventListItem" ADD CONSTRAINT "EventListItem_eventListId_fkey" FOREIGN KEY ("eventListId") REFERENCES "EventList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventListItem" ADD CONSTRAINT "EventListItem_dressId_fkey" FOREIGN KEY ("dressId") REFERENCES "Dress"("id") ON DELETE CASCADE ON UPDATE CASCADE;

