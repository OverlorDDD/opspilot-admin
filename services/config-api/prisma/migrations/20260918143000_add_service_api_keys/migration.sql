-- Extend audit actions for integration key lifecycle.
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SERVICE_KEY_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'SERVICE_KEY_REVOKED';

-- CreateTable
CREATE TABLE "service_api_keys" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "environment" "Environment" NOT NULL,
    "name" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'runtime:read',
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "service_api_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "service_api_keys_key_hash_key" ON "service_api_keys"("key_hash");
CREATE INDEX "service_api_keys_workspace_id_project_id_environment_idx" ON "service_api_keys"("workspace_id", "project_id", "environment");
CREATE INDEX "service_api_keys_project_id_environment_revoked_at_idx" ON "service_api_keys"("project_id", "environment", "revoked_at");

ALTER TABLE "service_api_keys"
ADD CONSTRAINT "service_api_keys_workspace_id_fkey"
FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "service_api_keys"
ADD CONSTRAINT "service_api_keys_project_id_fkey"
FOREIGN KEY ("project_id") REFERENCES "projects"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "service_api_keys"
ADD CONSTRAINT "service_api_keys_created_by_id_fkey"
FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
