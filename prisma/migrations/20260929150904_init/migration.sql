-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANUFACTURER');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'RECALLED');

-- CreateEnum
CREATE TYPE "CodeStatus" AS ENUM ('ACTIVE', 'DEACTIVATED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "VerificationResult" AS ENUM ('GENUINE', 'SUSPICIOUS', 'INVALID', 'DEACTIVATED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "manufacturerId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Manufacturer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "logo" TEXT,
    "registrationNumber" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Manufacturer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "productCode" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "batchNumber" TEXT NOT NULL,
    "serialNumber" TEXT,
    "manufactureDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductVerificationCode" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "verificationToken" TEXT NOT NULL,
    "qrCodeUrl" TEXT,
    "status" "CodeStatus" NOT NULL DEFAULT 'ACTIVE',
    "verificationCount" INTEGER NOT NULL DEFAULT 0,
    "firstVerifiedAt" TIMESTAMP(3),
    "lastVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductVerificationCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationLog" (
    "id" TEXT NOT NULL,
    "verificationCodeId" TEXT,
    "enteredCode" TEXT,
    "result" "VerificationResult" NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "country" TEXT,
    "city" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_manufacturerId_idx" ON "User"("manufacturerId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_productCode_key" ON "Product"("productCode");

-- CreateIndex
CREATE INDEX "Product_manufacturerId_idx" ON "Product"("manufacturerId");

-- CreateIndex
CREATE INDEX "Product_batchNumber_idx" ON "Product"("batchNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVerificationCode_verificationToken_key" ON "ProductVerificationCode"("verificationToken");

-- CreateIndex
CREATE INDEX "ProductVerificationCode_productId_idx" ON "ProductVerificationCode"("productId");

-- CreateIndex
CREATE INDEX "VerificationLog_verificationCodeId_verifiedAt_idx" ON "VerificationLog"("verificationCodeId", "verifiedAt");

-- CreateIndex
CREATE INDEX "VerificationLog_result_idx" ON "VerificationLog"("result");

-- CreateIndex
CREATE INDEX "VerificationLog_verifiedAt_idx" ON "VerificationLog"("verifiedAt");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "Manufacturer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductVerificationCode" ADD CONSTRAINT "ProductVerificationCode_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationLog" ADD CONSTRAINT "VerificationLog_verificationCodeId_fkey" FOREIGN KEY ("verificationCodeId") REFERENCES "ProductVerificationCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
