-- CreateIndex
CREATE INDEX "joined_rooms_roomId_isDeleted_isArchived_idx" ON "joined_rooms"("roomId", "isDeleted", "isArchived");
