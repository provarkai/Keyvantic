import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, MaxLength } from "class-validator";
import { ConfidentialityLevel } from "@keyvantic/types";
import { FileClassification } from "@prisma/client";

export class UploadFileDto {
  @ApiPropertyOptional({ description: "Defaults to the uploaded filename" })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ description: "Files the upload behind an engagement's boundary" })
  @IsOptional()
  @IsString()
  engagementId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  categoryId?: string;

  @ApiPropertyOptional({ description: "Attach to an authored document" })
  @IsOptional()
  @IsString()
  documentId?: string;

  @ApiPropertyOptional({
    enum: FileClassification,
    description:
      "WORKING files are encrypted at rest and readable by the platform, so they are " +
      "searchable and available to the assistant. SEALED is reserved for browser-side " +
      "encryption and is not yet accepted.",
  })
  @IsOptional()
  @IsEnum(FileClassification)
  classification?: FileClassification;

  @ApiPropertyOptional({ enum: ConfidentialityLevel })
  @IsOptional()
  @IsEnum(ConfidentialityLevel)
  confidentiality?: ConfidentialityLevel;
}
