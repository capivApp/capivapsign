-- CreateTable
CREATE TABLE "DesktopSession" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "deviceName" TEXT NOT NULL,
    "deviceFingerprint" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "DesktopSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IcpSignSession" (
    "id" TEXT NOT NULL,
    "envelopeId" TEXT NOT NULL,
    "signingTime" TIMESTAMP(3) NOT NULL,
    "itemsJson" JSONB NOT NULL,
    "certChainJson" JSONB NOT NULL,
    "certType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recipientId" INTEGER NOT NULL,

    CONSTRAINT "IcpSignSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IcpSignatureEvidence" (
    "id" TEXT NOT NULL,
    "envelopeId" TEXT NOT NULL,
    "recipientId" INTEGER NOT NULL,
    "envelopeItemId" TEXT NOT NULL,
    "certType" TEXT NOT NULL,
    "signerCommonName" TEXT NOT NULL,
    "signerCpfCnpj" TEXT,
    "certSerial" TEXT NOT NULL,
    "issuerDn" TEXT NOT NULL,
    "certNotAfter" TIMESTAMP(3) NOT NULL,
    "digestAlgorithm" TEXT NOT NULL,
    "signatureAlgorithm" TEXT NOT NULL,
    "signingTime" TIMESTAMP(3) NOT NULL,
    "tsaUrl" TEXT,
    "padesLevel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IcpSignatureEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DesktopSession_tokenHash_key" ON "DesktopSession"("tokenHash");

-- CreateIndex
CREATE INDEX "DesktopSession_userId_idx" ON "DesktopSession"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "IcpSignSession_recipientId_key" ON "IcpSignSession"("recipientId");

-- CreateIndex
CREATE INDEX "IcpSignatureEvidence_envelopeId_idx" ON "IcpSignatureEvidence"("envelopeId");

-- AddForeignKey
ALTER TABLE "DesktopSession" ADD CONSTRAINT "DesktopSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IcpSignSession" ADD CONSTRAINT "IcpSignSession_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Recipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IcpSignatureEvidence" ADD CONSTRAINT "IcpSignatureEvidence_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "Recipient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
