import { IsBoolean, IsInt, IsOptional, IsString, Min } from "class-validator";

export class CreateTemplateSectionDto {
  @IsString()
  key!: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsString()
  promptHint?: string;

  @IsOptional()
  @IsBoolean()
  requiresHuman?: boolean;
}
