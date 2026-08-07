import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { EngagementAccessLevel } from "@keyvantic/types";

export class SetMemberDto {
  @ApiProperty()
  @IsString()
  userId!: string;

  @ApiProperty({
    enum: EngagementAccessLevel,
    description:
      "DENIED is an ethical wall — it blocks access to the engagement's documents " +
      "regardless of the role the user holds.",
  })
  @IsEnum(EngagementAccessLevel)
  accessLevel!: EngagementAccessLevel;

  @ApiPropertyOptional({ description: "Why, e.g. the conflict that prompted a wall" })
  @IsOptional()
  @IsString()
  note?: string;
}
