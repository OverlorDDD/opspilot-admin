import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateProfileDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  firstName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;
}
