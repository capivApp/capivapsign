-- CreateEnum
CREATE TYPE "SignerPlatform" AS ENUM ('WINDOWS', 'MACOS', 'LINUX');

-- CreateTable
CREATE TABLE "SignerRelease" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "platform" "SignerPlatform" NOT NULL,
    "version" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "key" TEXT NOT NULL,

    CONSTRAINT "SignerRelease_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SignerRelease_platform_idx" ON "SignerRelease"("platform");
