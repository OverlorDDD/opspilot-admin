import { IsDefined, IsIn, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { CONFIG_KEY_TYPES, EnvironmentName } from "@opspilot/contracts";

export class CreateConfigDto {
  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @IsIn(["development", "staging", "production"])
  environment!: EnvironmentName;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsIn(CONFIG_KEY_TYPES)
  type!: (typeof CONFIG_KEY_TYPES)[number];

  @IsDefined()
  value!: unknown;

  @IsOptional()
  @IsString()
  description?: string;
}
