import { IsIn, IsNotEmpty, IsString, MaxLength } from "class-validator";
import type { EnvironmentName } from "@opspilot/contracts";

export class CreateServiceApiKeyDto {
  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @IsIn(["development", "staging", "production"])
  environment!: EnvironmentName;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;
}
