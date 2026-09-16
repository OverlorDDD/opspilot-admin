-- CreateEnum
CREATE TYPE "Environment" AS ENUM ('development', 'staging', 'production');

-- CreateEnum
CREATE TYPE "ConfigKeyType" AS ENUM ('number', 'boolean', 'string', 'json');

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_entries" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "environment" "Environment" NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ConfigKeyType" NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "config_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "config_entries_project_id_environment_idx" ON "config_entries"("project_id", "environment");

-- CreateIndex
CREATE UNIQUE INDEX "config_entries_project_id_environment_name_key" ON "config_entries"("project_id", "environment", "name");

-- AddForeignKey
ALTER TABLE "config_entries" ADD CONSTRAINT "config_entries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
