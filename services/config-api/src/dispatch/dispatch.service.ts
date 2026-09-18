import {
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  CarrierSyncAttempt,
  CarrierSyncResponse,
  DigestQueueResponse,
  DispatchEvent,
  DispatchStateResponse,
  DispatchTask,
} from "@opspilot/contracts";
import { ConfigsService } from "../configs/configs.service";
import { PrismaService } from "../database/prisma.service";

const DISPATCH_PROJECT_ID = "flowline-service";
const DISPATCH_ENVIRONMENT = "staging" as const;
const SYNC_FAILURES_BEFORE_SUCCESS = 3;

@Injectable()
export class DispatchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configs: ConfigsService,
  ) {}

  async getState(): Promise<DispatchStateResponse> {
    const [runtime, tasks, events] = await Promise.all([
      this.configs.getRuntime(DISPATCH_ENVIRONMENT, DISPATCH_PROJECT_ID),
      this.prisma.dispatchTask.findMany({
        where: { projectId: DISPATCH_PROJECT_ID },
        orderBy: { createdAt: "asc" },
        take: 50,
      }),
      this.prisma.dispatchEvent.findMany({
        where: { projectId: DISPATCH_PROJECT_ID },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);

    return {
      runtime,
      tasks: tasks.map((task) => this.toTask(task)),
      events: events.map((event) => this.toEvent(event)),
    };
  }

  async createTask(): Promise<DispatchTask> {
    const runtime = await this.configs.getRuntime(
      DISPATCH_ENVIRONMENT,
      DISPATCH_PROJECT_ID,
    );
    this.assertWritable(runtime.values["service.maintenanceMode"]);

    const maxTasks = Math.max(
      0,
      Math.floor(this.numberValue(runtime.values["limits.maxTasksPerUser"], 25)),
    );
    const activeCount = await this.prisma.dispatchTask.count({
      where: {
        projectId: DISPATCH_PROJECT_ID,
        status: { not: "DONE" },
      },
    });

    if (activeCount >= maxTasks) {
      throw new ConflictException(
        `Task creation is blocked by limits.maxTasksPerUser = ${maxTasks}`,
      );
    }

    const totalCount = await this.prisma.dispatchTask.count({
      where: { projectId: DISPATCH_PROJECT_ID },
    });
    const title = `Investigate operations alert #${4201 + totalCount}`;

    const task = await this.prisma.$transaction(async (tx) => {
      const created = await tx.dispatchTask.create({
        data: {
          projectId: DISPATCH_PROJECT_ID,
          title,
          status: "QUEUED",
        },
      });

      await tx.dispatchEvent.create({
        data: {
          projectId: DISPATCH_PROJECT_ID,
          type: "TASK_CREATED",
          message: `Created "${title}"`,
          metadata: { taskId: created.id } as Prisma.InputJsonValue,
        },
      });

      return created;
    });

    return this.toTask(task);
  }

  async completeTask(taskId: string): Promise<DispatchTask> {
    const runtime = await this.configs.getRuntime(
      DISPATCH_ENVIRONMENT,
      DISPATCH_PROJECT_ID,
    );
    this.assertWritable(runtime.values["service.maintenanceMode"]);

    const task = await this.prisma.dispatchTask.findFirst({
      where: { id: taskId, projectId: DISPATCH_PROJECT_ID },
    });

    if (!task) {
      throw new NotFoundException("Dispatch task was not found");
    }

    if (task.status === "DONE") {
      return this.toTask(task);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const completed = await tx.dispatchTask.update({
        where: { id: task.id },
        data: { status: "DONE" },
      });

      await tx.dispatchEvent.create({
        data: {
          projectId: DISPATCH_PROJECT_ID,
          type: "TASK_COMPLETED",
          message: `Completed "${task.title}"`,
          metadata: { taskId: task.id } as Prisma.InputJsonValue,
        },
      });

      return completed;
    });

    return this.toTask(updated);
  }

  async queueDigest(): Promise<DigestQueueResponse> {
    const runtime = await this.configs.getRuntime(
      DISPATCH_ENVIRONMENT,
      DISPATCH_PROJECT_ID,
    );
    this.assertWritable(runtime.values["service.maintenanceMode"]);

    const enabled = this.booleanValue(
      runtime.values["notifications.weeklyDigest"],
      true,
    );
    if (!enabled) {
      throw new ConflictException(
        "Weekly digest is disabled by notifications.weeklyDigest",
      );
    }

    const activeCount = await this.prisma.dispatchTask.count({
      where: {
        projectId: DISPATCH_PROJECT_ID,
        status: { not: "DONE" },
      },
    });
    const message = `Weekly digest queued for ${activeCount} active tasks.`;

    const event = await this.prisma.dispatchEvent.create({
      data: {
        projectId: DISPATCH_PROJECT_ID,
        type: "DIGEST_QUEUED",
        message,
        metadata: { activeTaskCount: activeCount } as Prisma.InputJsonValue,
      },
    });

    return { message, event: this.toEvent(event) };
  }

  async runCarrierSync(): Promise<CarrierSyncResponse> {
    const runtime = await this.configs.getRuntime(
      DISPATCH_ENVIRONMENT,
      DISPATCH_PROJECT_ID,
    );
    this.assertWritable(runtime.values["service.maintenanceMode"]);

    const maxRetries = Math.max(
      0,
      Math.floor(this.numberValue(runtime.values["limits.maxRetries"], 3)),
    );
    const totalAttemptsAllowed = 1 + maxRetries;
    const attempts: CarrierSyncAttempt[] = [];

    for (let attempt = 1; attempt <= totalAttemptsAllowed; attempt += 1) {
      const success = attempt > SYNC_FAILURES_BEFORE_SUCCESS;
      attempts.push({
        number: attempt,
        result: success ? "success" : "failed",
      });
      if (success) break;
    }

    const success = attempts.some((attempt) => attempt.result === "success");
    const message = success
      ? `Carrier sync succeeded on attempt ${attempts.length}.`
      : `Carrier sync failed after ${attempts.length} attempts.`;

    const event = await this.prisma.dispatchEvent.create({
      data: {
        projectId: DISPATCH_PROJECT_ID,
        type: success ? "CARRIER_SYNC_SUCCEEDED" : "CARRIER_SYNC_FAILED",
        message,
        metadata: {
          maxRetries,
          attempts,
          simulatedFailuresBeforeSuccess: SYNC_FAILURES_BEFORE_SUCCESS,
        } as Prisma.InputJsonValue,
      },
    });

    return {
      attempts,
      success,
      maxRetries,
      event: this.toEvent(event),
    };
  }

  private assertWritable(value: unknown): void {
    if (this.booleanValue(value, false)) {
      throw new ServiceUnavailableException(
        "Flowline Dispatch is read-only because service.maintenanceMode is enabled",
      );
    }
  }

  private numberValue(value: unknown, fallback: number): number {
    return typeof value === "number" && Number.isFinite(value)
      ? value
      : fallback;
  }

  private booleanValue(value: unknown, fallback: boolean): boolean {
    return typeof value === "boolean" ? value : fallback;
  }

  private toTask(task: {
    id: string;
    projectId: string;
    title: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }): DispatchTask {
    return {
      id: task.id,
      projectId: task.projectId,
      title: task.title,
      status: task.status as DispatchTask["status"],
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }

  private toEvent(event: {
    id: string;
    projectId: string;
    type: string;
    message: string;
    metadata: Prisma.JsonValue | null;
    createdAt: Date;
  }): DispatchEvent {
    return {
      id: event.id,
      projectId: event.projectId,
      type: event.type as DispatchEvent["type"],
      message: event.message,
      metadata: event.metadata,
      createdAt: event.createdAt.toISOString(),
    };
  }
}
