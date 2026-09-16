import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const project = {
  id: "flowline-service",
  name: "Flowline Service",
};

const workspace = {
  id: "flowline-workspace",
  name: "Flowline Operations",
  slug: "flowline-operations",
};

const seededEntries = [
  {
    id: "cfg-max-tasks",
    environment: "staging" as const,
    name: "limits.maxTasksPerUser",
    type: "number" as const,
    value: 25,
    description: "Maximum number of active tasks for one workspace member.",
  },
  {
    id: "cfg-maintenance-mode",
    environment: "staging" as const,
    type: "boolean" as const,
    name: "service.maintenanceMode",
    value: false,
    description: "Temporarily pauses customer actions during maintenance.",
  },
  {
    id: "cfg-weekly-digest",
    environment: "staging" as const,
    name: "notifications.weeklyDigest",
    type: "boolean" as const,
    value: true,
    description: "Controls weekly summary emails for workspace members.",
  },
];

async function main(): Promise<void> {
  await prisma.workspace.upsert({
    where: { id: workspace.id },
    update: {
      name: workspace.name,
      slug: workspace.slug,
    },
    create: workspace,
  });

  await prisma.project.upsert({
    where: { id: project.id },
    update: { name: project.name, workspaceId: workspace.id },
    create: { ...project, workspaceId: workspace.id },
  });

  for (const entry of seededEntries) {
    const config = await prisma.configEntry.upsert({
      where: { id: entry.id },
      // Existing values are intentionally not reset here. Once the workflow exists,
      // published configuration should only change through the publish operation.
      update: {
        projectId: project.id,
        environment: entry.environment,
        name: entry.name,
        type: entry.type,
      },
      create: {
        ...entry,
        projectId: project.id,
        isPublished: true,
      },
    });

    const revisionCount = await prisma.configRevision.count({
      where: { configEntryId: config.id },
    });

    // This backfills the first revision for databases created before versioning
    // existed. It is safe to run the seed repeatedly because we only add it when
    // a configuration has no revision history at all.
    if (revisionCount === 0) {
      await prisma.configRevision.create({
        data: {
          configEntryId: config.id,
          version: 1,
          status: "PUBLISHED",
          value: config.value as Prisma.InputJsonValue,
          description: config.description,
          publishedAt: config.updatedAt,
        },
      });
    }
  }

  console.log(
    `Seeded project '${project.name}' with ${seededEntries.length} config entries and baseline revisions.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
