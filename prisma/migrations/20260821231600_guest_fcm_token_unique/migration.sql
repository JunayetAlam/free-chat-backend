-- Null empty tokens so they cannot collide on the unique index.
UPDATE "guests"
SET "fcmToken" = NULL
WHERE "fcmToken" IS NOT NULL AND btrim("fcmToken") = '';

-- Keep the newest guest per token; detach the rest.
UPDATE "guests" AS g
SET "fcmToken" = NULL,
    "notificationsEnabled" = false
FROM (
  SELECT id,
    ROW_NUMBER() OVER (PARTITION BY "fcmToken" ORDER BY "updatedAt" DESC) AS rn
  FROM "guests"
  WHERE "fcmToken" IS NOT NULL
) AS ranked
WHERE g.id = ranked.id AND ranked.rn > 1;

-- CreateIndex
CREATE UNIQUE INDEX "guests_fcmToken_key" ON "guests"("fcmToken");
