-- CreateTable
CREATE TABLE "guest_fcm_tokens" (
    "id" TEXT NOT NULL,
    "guestId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "guest_fcm_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "guest_fcm_tokens_token_key" ON "guest_fcm_tokens"("token");

-- CreateIndex
CREATE INDEX "guest_fcm_tokens_guestId_idx" ON "guest_fcm_tokens"("guestId");

-- AddForeignKey
ALTER TABLE "guest_fcm_tokens" ADD CONSTRAINT "guest_fcm_tokens_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "guests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing single tokens onto the new table.
INSERT INTO "guest_fcm_tokens" ("id", "guestId", "token", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, "id", "fcmToken", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "guests"
WHERE "fcmToken" IS NOT NULL AND btrim("fcmToken") <> '';

-- DropIndex
DROP INDEX IF EXISTS "guests_fcmToken_key";

-- AlterTable
ALTER TABLE "guests" DROP COLUMN "fcmToken";
