-- AlterTable
ALTER TABLE "ApiToken" ADD COLUMN     "organisationId" TEXT;

-- CreateIndex
CREATE INDEX "ApiToken_organisationId_idx" ON "ApiToken"("organisationId");

-- AddForeignKey
ALTER TABLE "ApiToken" ADD CONSTRAINT "ApiToken_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "Organisation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
