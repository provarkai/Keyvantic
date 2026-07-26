import { IsArray, IsEnum, IsISO8601, IsOptional, IsString } from "class-validator";
import { ConfidentialityLevel } from "@keyvantic/types";

export class CreateDocumentDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsString()
  categoryId!: string;

  @IsOptional()
  @IsEnum(ConfidentialityLevel)
  confidentiality?: ConfidentialityLevel;

  @IsOptional()
  @IsISO8601()
  reviewDate?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsString()
  contentMarkdown?: string;
}
