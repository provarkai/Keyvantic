import { IsEnum, IsOptional, IsString } from "class-validator";
import { ApprovalDecision } from "@keyvantic/types";

export class DecideApprovalDto {
  @IsEnum(ApprovalDecision)
  decision!: ApprovalDecision;

  @IsOptional()
  @IsString()
  comment?: string;
}
