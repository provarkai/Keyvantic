-- CreateEnum
CREATE TYPE "FileClassification" AS ENUM ('WORKING', 'SEALED');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'SKIPPED');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "wrappedDek" BYTEA;

-- CreateTable
CREATE TABLE "VaultItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT,
    "engagementId" TEXT,
    "documentId" TEXT,
    "classification" "FileClassification" NOT NULL DEFAULT 'WORKING',
    "confidentiality" "ConfidentialityLevel" NOT NULL DEFAULT 'INTERNAL',
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "VaultItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VaultFileVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "vaultItemId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "wrappedDek" BYTEA NOT NULL,
    "iv" BYTEA NOT NULL,
    "authTag" BYTEA NOT NULL,
    "extractedText" TEXT,
    "scanStatus" "ScanStatus" NOT NULL DEFAULT 'PENDING',
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VaultFileVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VaultItem_tenantId_idx" ON "VaultItem"("tenantId");

-- CreateIndex
CREATE INDEX "VaultItem_engagementId_idx" ON "VaultItem"("engagementId");

-- CreateIndex
CREATE INDEX "VaultItem_categoryId_idx" ON "VaultItem"("categoryId");

-- CreateIndex
CREATE INDEX "VaultItem_documentId_idx" ON "VaultItem"("documentId");

-- CreateIndex
CREATE INDEX "VaultFileVersion_tenantId_idx" ON "VaultFileVersion"("tenantId");

-- CreateIndex
CREATE INDEX "VaultFileVersion_vaultItemId_idx" ON "VaultFileVersion"("vaultItemId");

-- CreateIndex
CREATE UNIQUE INDEX "VaultFileVersion_vaultItemId_versionNumber_key" ON "VaultFileVersion"("vaultItemId", "versionNumber");

-- AddForeignKey
ALTER TABLE "VaultItem" ADD CONSTRAINT "VaultItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultItem" ADD CONSTRAINT "VaultItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultItem" ADD CONSTRAINT "VaultItem_engagementId_fkey" FOREIGN KEY ("engagementId") REFERENCES "Engagement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultItem" ADD CONSTRAINT "VaultItem_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultItem" ADD CONSTRAINT "VaultItem_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultFileVersion" ADD CONSTRAINT "VaultFileVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultFileVersion" ADD CONSTRAINT "VaultFileVersion_vaultItemId_fkey" FOREIGN KEY ("vaultItemId") REFERENCES "VaultItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VaultFileVersion" ADD CONSTRAINT "VaultFileVersion_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ── Row-Level Security for the new tables ──────────────────────────────────
-- Same policy shape as every other tenant-scoped table. Easy to forget on a new
-- table, and forgetting it means the table is readable across tenants — the
-- vault-isolation test asserts this is present.
DO $rls$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['VaultItem','VaultFileVersion']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format($p$
      CREATE POLICY tenant_isolation ON %I
        USING (
          current_setting('app.bypass_rls', true) = 'on'
          OR "tenantId" = current_setting('app.tenant_id', true)
        )
        WITH CHECK (
          current_setting('app.bypass_rls', true) = 'on'
          OR "tenantId" = current_setting('app.tenant_id', true)
        )
    $p$, t);
  END LOOP;
END
$rls$;

-- New tables need the same grants as the rest; ALTER DEFAULT PRIVILEGES only
-- applies to roles that existed when it was set, so be explicit.
DO $grant$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kos_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "VaultItem", "VaultFileVersion" TO kos_app;
  END IF;
END
$grant$;
