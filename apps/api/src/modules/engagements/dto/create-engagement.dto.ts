import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class CreateEngagementDto {
  @ApiProperty()
  @IsString()
  clientId!: string;

  @ApiProperty({ description: "The firm's own matter/engagement number", example: "M-2026-0142" })
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  reference!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  practiceArea?: string;

  @ApiPropertyOptional({ description: "Defaults to the creating user" })
  @IsOptional()
  @IsString()
  leadId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  openedAt?: string;
}
