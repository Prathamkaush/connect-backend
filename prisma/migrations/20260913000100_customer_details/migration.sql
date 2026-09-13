ALTER TABLE "User" ADD COLUMN "phone" TEXT,
                   ADD COLUMN "city" TEXT,
                   ADD COLUMN "postalCode" TEXT;

ALTER TABLE "Invoice" ADD COLUMN "billingDetails" JSONB;
