import { IsOptional, IsString } from "class-validator";

export class UpdateConfigDto {
  @IsOptional()
  value?: unknown;

  @IsOptional()
  @IsString()
  description?: string;
}
