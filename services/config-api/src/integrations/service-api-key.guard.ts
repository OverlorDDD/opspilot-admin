import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import {
  ServiceApiKeyContext,
  ServiceApiKeysService,
} from "./service-api-keys.service";

export type ServiceAuthenticatedRequest = Request & {
  serviceKey?: ServiceApiKeyContext;
};

@Injectable()
export class ServiceApiKeyGuard implements CanActivate {
  constructor(private readonly serviceApiKeys: ServiceApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request =
      context.switchToHttp().getRequest<ServiceAuthenticatedRequest>();
    const authorization = request.header("authorization");

    if (!authorization?.startsWith("Bearer ")) {
      throw new UnauthorizedException(
        "Authorization: Bearer <service-api-key> is required",
      );
    }

    const secret = authorization.slice("Bearer ".length).trim();
    request.serviceKey = await this.serviceApiKeys.authenticate(secret);
    return true;
  }
}
