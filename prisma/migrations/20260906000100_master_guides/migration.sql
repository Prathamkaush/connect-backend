ALTER TABLE "Master"
ADD COLUMN "tradition" TEXT,
ADD COLUMN "era" TEXT,
ADD COLUMN "guideTitle" TEXT,
ADD COLUMN "guideContent" JSONB NOT NULL DEFAULT '[]'::jsonb;
