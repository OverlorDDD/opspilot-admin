-- CreateEnum
CREATE TYPE "ConfigRevisionStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CONFIG_CREATED', 'DRAFT_CREATED', 'DRAFT_UPDATED', 'DRAFT_SUBMITTED', 'DRAFT_APPROVED', 'DRAFT_REJECTED', 'CONFIG_PUBLISHED');

-- AlterTable
ALTER TABLE "config_entries" ADD COLUMN     "is_published" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "config_revisions" (
    "id" TEXT NOT NULL,
    "config_entry_id" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "status" "ConfigRevisionStatus" NOT NULL DEFAULT 'DRAFT',
    "value" JSONB NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "rejection_reason" TEXT,
    "created_by_id" TEXT,
    "reviewed_by_id" TEXT,
    "published_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "reviewed_at" TIMESTAMP(3),
    "published_at" TIMESTAMP(3),

    CONSTRAINT "config_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "config_entry_id" TEXT,
    "actor_user_id" TEXT,
    "action" "AuditAction" NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "config_revisions_config_entry_id_status_idx" ON "config_revisions"("config_entry_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "config_revisions_config_entry_id_version_key" ON "config_revisions"("config_entry_id", "version");

-- CreateIndex
CREATE INDEX "audit_logs_workspace_id_created_at_idx" ON "audit_logs"("workspace_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_config_entry_id_created_at_idx" ON "audit_logs"("config_entry_id", "created_at");

-- AddForeignKey
ALTER TABLE "config_revisions" ADD CONSTRAINT "config_revisions_config_entry_id_fkey" FOREIGN KEY ("config_entry_id") REFERENCES "config_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "config_revisions" ADD CONSTRAINT "config_revisions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "config_revisions" ADD CONSTRAINT "config_revisions_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "config_revisions" ADD CONSTRAINT "config_revisions_published_by_id_fkey" FOREIGN KEY ("published_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_config_entry_id_fkey" FOREIGN KEY ("config_entry_id") REFERENCES "config_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
