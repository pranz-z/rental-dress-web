-- Settings: rental rules, staff lifecycle flags, and settings-driven pricing.
-- Rental prices and deposits now derive from the dress retail value via the
-- percentages below, so the per-dress price columns are retired.

ALTER TABLE "StudioSettings" ADD COLUMN "rentalPercent4" INTEGER NOT NULL DEFAULT 35;
ALTER TABLE "StudioSettings" ADD COLUMN "rentalPercent8" INTEGER NOT NULL DEFAULT 55;
ALTER TABLE "StudioSettings" ADD COLUMN "extensionFeePerDay" INTEGER NOT NULL DEFAULT 4500;
ALTER TABLE "StudioSettings" ADD COLUMN "cancellationRefundPercent" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "StudioSettings" ADD COLUMN "autoConfirmBookings" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "StaffUser" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StaffUser" ADD COLUMN "twoFactorRequired" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Dress" DROP COLUMN "rentalPrice4";
ALTER TABLE "Dress" DROP COLUMN "rentalPrice8";
ALTER TABLE "Dress" DROP COLUMN "deposit";
