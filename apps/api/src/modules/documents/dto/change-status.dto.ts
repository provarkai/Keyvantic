import { IsEnum, IsOptional, IsString } from "class-validator";
import { DocumentStatus } from "@keyvantic/types";

export class ChangeStatusDto {
  @IsEnum(DocumentStatus)
  status!: DocumentStatus;

  @IsOptional()
  @IsString()
  comment?: string;
}
