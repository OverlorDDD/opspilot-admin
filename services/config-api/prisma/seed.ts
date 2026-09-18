import { Prisma, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const workspace = {
  id: "flowline-workspace",
  name: "Flowline Operations",
  slug: "flowline-operations",
};

const projects = [
  {
    id: "flowline-service",
    name: "Flowline Dispatch",
  },
  {
    id: "flowline-customer-portal",
    name: "Flowline Customer Portal",
  },
];

const seededEntries = [
  {
    id: "cfg-max-tasks",
    projectId: "flowline-service",
    environment: "staging" as const,
    name: "limits.maxTasksPerUser",
    type: "number" as const,
    value: 25,
    description: "Maximum number of active tasks for one operations manager.",
  },
  {
    id: "cfg-maintenance-mode",
    projectId: "flowline-service",
    environment: "staging" as const,
    type: "boolean" as const,
    name: "service.maintenanceMode",
    value: false,
    description: "Temporarily makes Dispatch read-only during maintenance.",
  },
  {
    id: "cfg-weekly-digest",
    projectId: "flowline-service",
    environment: "staging" as const,
    name: "notifications.weeklyDigest",
    type: "boolean" as const,
    value: true,
    description: "Controls whether operations can queue the weekly digest.",
  },
  {
    id: "cfg-max-retries",
    projectId: "flowline-service",
    environment: "staging" as const,
    name: "limits.maxRetries",
    type: "number" as const,
    value: 3,
    description: "Maximum retry count after the first failed carrier request.",
  },
  {
    id: "cfg-portal-returns",
    projectId: "flowline-customer-portal",
    environment: "staging" as const,
    name: "portal.selfServiceReturns",
    type: "boolean" as const,
    value: true,
    description: "Enables the self-service return flow in the customer portal.",
  },
  {
    id: "cfg-portal-max-tickets",
    projectId: "flowline-customer-portal",
    environment: "staging" as const,
    name: "portal.maxOpenTickets",
    type: "number" as const,
    value: 5,
    description: "Maximum number of open support tickets per customer.",
  },
  {
    id: "cfg-portal-maintenance",
    projectId: "flowline-customer-portal",
    environment: "staging" as const,
    name: "portal.maintenanceMode",
    type: "boolean" as const,
    value: false,
    description: "Puts the customer portal into a read-only maintenance state.",
  },
];

const initialTasks = [
  {
    id: "dispatch-task-1",
    title: "Review delayed shipment #4182",
    status: "IN_PROGRESS" as const,
  },
  {
    id: "dispatch-task-2",
    title: "Confirm warehouse inventory",
    status: "QUEUED" as const,
  },
  {
    id: "dispatch-task-3",
    title: "Call carrier about route 12",
    status: "QUEUED" as const,
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

  for (const project of projects) {
    await prisma.project.upsert({
      where: { id: project.id },
      update: { name: project.name, workspaceId: workspace.id },
      create: { ...project, workspaceId: workspace.id },
    });
  }

  for (const entry of seededEntries) {
    const config = await prisma.configEntry.upsert({
      where: {
        projectId_environment_name: {
          projectId: entry.projectId,
          environment: entry.environment,
          name: entry.name,
        },
      },
      // Existing values are intentionally not reset. Once a key exists,
      // published configuration changes only through the workflow.
      update: {
        type: entry.type,
      },
      create: {
        id: entry.id,
        projectId: entry.projectId,
        environment: entry.environment,
        name: entry.name,
        type: entry.type,
        value: entry.value,
        description: entry.description,
        isPublished: true,
      },
    });

    const revisionCount = await prisma.configRevision.count({
      where: { configEntryId: config.id },
    });

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

  for (const task of initialTasks) {
    await prisma.dispatchTask.upsert({
      where: { id: task.id },
      update: {},
      create: {
        ...task,
        projectId: "flowline-service",
      },
    });
  }

  console.log(
    `Seeded ${projects.length} projects, ${seededEntries.length} config keys and persistent Dispatch demo data.`,
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
