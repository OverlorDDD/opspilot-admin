import { IsOptional, IsString, MaxLength } from "class-validator";

export class RejectDraftDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
