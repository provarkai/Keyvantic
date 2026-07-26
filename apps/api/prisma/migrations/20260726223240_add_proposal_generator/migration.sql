-- CreateEnum
CREATE TYPE "ProposalRunStatus" AS ENUM ('GENERATING', 'DRAFTED', 'FAILED');

-- CreateTable
CREATE TABLE "ProposalTemplateSection" (
    "id" TEXT NOT NULL,
    "templateDocId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "promptHint" TEXT,
    "requiresHuman" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalTemplateSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalRun" (
    "id" TEXT NOT NULL,
    "templateDocId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "resultDocumentId" TEXT,
    "status" "ProposalRunStatus" NOT NULL DEFAULT 'GENERATING',
    "sourceDocumentIds" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ProposalRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProposalTemplateSection_templateDocId_idx" ON "ProposalTemplateSection"("templateDocId");

-- CreateIndex
CREATE UNIQUE INDEX "ProposalTemplateSection_templateDocId_key_key" ON "ProposalTemplateSection"("templateDocId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "ProposalRun_resultDocumentId_key" ON "ProposalRun"("resultDocumentId");

-- CreateIndex
CREATE INDEX "ProposalRun_clientId_idx" ON "ProposalRun"("clientId");

-- CreateIndex
CREATE INDEX "ProposalRun_templateDocId_idx" ON "ProposalRun"("templateDocId");

-- AddForeignKey
ALTER TABLE "ProposalTemplateSection" ADD CONSTRAINT "ProposalTemplateSection_templateDocId_fkey" FOREIGN KEY ("templateDocId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalRun" ADD CONSTRAINT "ProposalRun_templateDocId_fkey" FOREIGN KEY ("templateDocId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalRun" ADD CONSTRAINT "ProposalRun_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalRun" ADD CONSTRAINT "ProposalRun_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalRun" ADD CONSTRAINT "ProposalRun_resultDocumentId_fkey" FOREIGN KEY ("resultDocumentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
