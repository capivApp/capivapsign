-- CreateTable
CREATE TABLE "SigningCertificate" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fileName" TEXT NOT NULL,
    "encryptedData" TEXT NOT NULL,
    "encryptedPassword" TEXT NOT NULL,

    CONSTRAINT "SigningCertificate_pkey" PRIMARY KEY ("id")
);
