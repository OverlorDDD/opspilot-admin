import { Controller, Get } from "@nestjs/common";
import type { RuntimeConfigResponse } from "@opspilot/contracts";
import { ConfigsService } from "../configs/configs.service";

@Controller("demo/portal")
export class PortalDemoController {
  constructor(private readonly configs: ConfigsService) {}

  @Get("runtime")
  runtime(): Promise<RuntimeConfigResponse> {
    return this.configs.getRuntimeForProject(
      "flowline-customer-portal",
      "staging",
    );
  }
}
