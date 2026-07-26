import { IsArray, IsEnum, IsISO8601, IsOptional, IsString } from "class-validator";
import { ConfidentialityLevel } from "@keyvantic/types";

export class UpdateDocumentDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsString()
  approverId?: string;

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
}
