-- Additive migration: existing text balances, prices and subscription periods stay unchanged.
ALTER TABLE "Master" ADD COLUMN "voiceEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "voice" TEXT NOT NULL DEFAULT 'marin', ADD COLUMN "voiceInstructions" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SubscriptionPlan" ADD COLUMN "voiceEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "voiceSeconds" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "UserSubscription" ADD COLUMN "voiceSecondsTotal" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "voiceSecondsUsed" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "voiceSecondsReserved" INTEGER NOT NULL DEFAULT 0;
-- Orders snapshot voice entitlements; orders already created get zero, too.
ALTER TABLE "Payment" ADD COLUMN "voiceSeconds" INTEGER NOT NULL DEFAULT 0;

CREATE TYPE "VoiceCallStatus" AS ENUM ('CONNECTING', 'READY', 'ACTIVE', 'STOPPING', 'ENDED', 'FAILED');
CREATE TABLE "VoiceCall" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "masterId" TEXT NOT NULL REFERENCES "Master"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "subscriptionId" TEXT REFERENCES "UserSubscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "requestId" TEXT NOT NULL,
  "activeUserId" TEXT,
  "isAdminTest" BOOLEAN NOT NULL DEFAULT false,
  "status" "VoiceCallStatus" NOT NULL DEFAULT 'CONNECTING',
  "providerCallId" TEXT,
  "model" TEXT NOT NULL,
  "reservedSeconds" INTEGER NOT NULL,
  "billableSeconds" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "connectedAt" TIMESTAMP(3),
  "endRequestedAt" TIMESTAMP(3),
  "endedAt" TIMESTAMP(3),
  "deadlineAt" TIMESTAMP(3) NOT NULL,
  "periodEndsAt" TIMESTAMP(3) NOT NULL,
  "heartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "controlHeartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endReason" TEXT,
  "terminationAttempts" INTEGER NOT NULL DEFAULT 0,
  "lastTerminationError" TEXT
);
CREATE UNIQUE INDEX "VoiceCall_activeUserId_key" ON "VoiceCall"("activeUserId");
CREATE UNIQUE INDEX "VoiceCall_providerCallId_key" ON "VoiceCall"("providerCallId");
CREATE UNIQUE INDEX "VoiceCall_userId_requestId_key" ON "VoiceCall"("userId", "requestId");
CREATE INDEX "VoiceCall_status_deadlineAt_idx" ON "VoiceCall"("status", "deadlineAt");
CREATE INDEX "VoiceCall_userId_createdAt_idx" ON "VoiceCall"("userId", "createdAt" DESC);
CREATE TABLE "VoiceResponseUsage" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "callId" TEXT NOT NULL REFERENCES "VoiceCall"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "responseId" TEXT NOT NULL,
  "usage" JSONB NOT NULL,
  "transcript" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "VoiceResponseUsage_callId_responseId_key" ON "VoiceResponseUsage"("callId", "responseId");

ALTER TABLE "SubscriptionPlan" ADD CONSTRAINT "voice_plan_nonnegative" CHECK ("voiceSeconds" >= 0);
ALTER TABLE "UserSubscription" ADD CONSTRAINT "voice_quota_valid" CHECK (
  "voiceSecondsTotal" >= 0 AND "voiceSecondsUsed" >= 0 AND "voiceSecondsReserved" >= 0
  AND "voiceSecondsUsed" + "voiceSecondsReserved" <= "voiceSecondsTotal"
);
ALTER TABLE "VoiceCall" ADD CONSTRAINT "voice_call_quota_valid" CHECK (
  "reservedSeconds" > 0 AND "billableSeconds" >= 0 AND "billableSeconds" <= "reservedSeconds"
);
