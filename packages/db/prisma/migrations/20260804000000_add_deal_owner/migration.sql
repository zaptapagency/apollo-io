-- AlterTable
ALTER TABLE "deals" ADD COLUMN "ownerId" TEXT;

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "deals_organizationId_ownerId_idx" ON "deals"("organizationId", "ownerId");
