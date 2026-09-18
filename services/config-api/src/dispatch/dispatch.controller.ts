import { Controller, Get, Param, Patch, Post } from "@nestjs/common";
import type {
  CarrierSyncResponse,
  DigestQueueResponse,
  DispatchStateResponse,
  DispatchTask,
} from "@opspilot/contracts";
import { DispatchService } from "./dispatch.service";

@Controller("demo/dispatch")
export class DispatchController {
  constructor(private readonly dispatch: DispatchService) {}

  @Get()
  getState(): Promise<DispatchStateResponse> {
    return this.dispatch.getState();
  }

  @Post("tasks")
  createTask(): Promise<DispatchTask> {
    return this.dispatch.createTask();
  }

  @Patch("tasks/:taskId/complete")
  completeTask(@Param("taskId") taskId: string): Promise<DispatchTask> {
    return this.dispatch.completeTask(taskId);
  }

  @Post("digest")
  queueDigest(): Promise<DigestQueueResponse> {
    return this.dispatch.queueDigest();
  }

  @Post("carrier-sync")
  runCarrierSync(): Promise<CarrierSyncResponse> {
    return this.dispatch.runCarrierSync();
  }
}
