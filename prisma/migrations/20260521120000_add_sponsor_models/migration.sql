-- Idempotent: safe if tables were created earlier via db push in dev.

DO $$ BEGIN
  CREATE TYPE "SponsorMediaType" AS ENUM ('IMAGE', 'VIDEO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "event_sponsor_media" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "sponsorName" TEXT,
    "mediaType" "SponsorMediaType" NOT NULL,
    "mediaUrl" TEXT NOT NULL,
    "linkUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_sponsor_media_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "platform_sponsors" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logoUrl" TEXT NOT NULL,
    "linkUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_sponsors_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "platform_banner_media" (
    "id" TEXT NOT NULL,
    "sponsorName" TEXT,
    "mediaType" "SponsorMediaType" NOT NULL,
    "mediaUrl" TEXT NOT NULL,
    "linkUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_banner_media_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "event_sponsor_media_eventId_sortOrder_idx" ON "event_sponsor_media"("eventId", "sortOrder");
CREATE INDEX IF NOT EXISTS "event_sponsor_media_isActive_idx" ON "event_sponsor_media"("isActive");
CREATE INDEX IF NOT EXISTS "platform_sponsors_isActive_sortOrder_idx" ON "platform_sponsors"("isActive", "sortOrder");
CREATE INDEX IF NOT EXISTS "platform_banner_media_isActive_sortOrder_idx" ON "platform_banner_media"("isActive", "sortOrder");

DO $$ BEGIN
  ALTER TABLE "event_sponsor_media" ADD CONSTRAINT "event_sponsor_media_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
