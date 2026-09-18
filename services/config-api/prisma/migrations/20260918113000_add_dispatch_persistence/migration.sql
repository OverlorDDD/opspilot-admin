-- CreateEnum
CREATE TYPE "DispatchTaskStatus" AS ENUM ('QUEUED', 'IN_PROGRESS', 'DONE');

-- CreateEnum
CREATE TYPE "DispatchEventType" AS ENUM ('TASK_CREATED', 'TASK_COMPLETED', 'DIGEST_QUEUED', 'CARRIER_SYNC_SUCCEEDED', 'CARRIER_SYNC_FAILED');

-- CreateTable
CREATE TABLE "dispatch_tasks" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "DispatchTaskStatus" NOT NULL DEFAULT 'QUEUED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispatch_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispatch_events" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "type" "DispatchEventType" NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dispatch_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dispatch_tasks_project_id_status_idx" ON "dispatch_tasks"("project_id", "status");

-- CreateIndex
CREATE INDEX "dispatch_events_project_id_created_at_idx" ON "dispatch_events"("project_id", "created_at");

-- AddForeignKey
ALTER TABLE "dispatch_tasks" ADD CONSTRAINT "dispatch_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispatch_events" ADD CONSTRAINT "dispatch_events_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
