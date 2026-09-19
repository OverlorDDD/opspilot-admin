import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import type { RuntimeConfigResponse } from "@opspilot/contracts";
import { ConfigsService } from "../configs/configs.service";
import {
  ServiceApiKeyGuard,
  ServiceAuthenticatedRequest,
} from "./service-api-key.guard";

@Controller("runtime/v1")
export class ConsumerRuntimeController {
  constructor(private readonly configs: ConfigsService) {}

  @Get("config")
  @UseGuards(ServiceApiKeyGuard)
  getConfig(
    @Req() request: ServiceAuthenticatedRequest,
  ): Promise<RuntimeConfigResponse> {
    const key = request.serviceKey!;
    return this.configs.getRuntimeForProject(key.projectId, key.environment);
  }
}
