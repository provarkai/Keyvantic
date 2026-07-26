import { IsEnum, IsOptional, IsString } from "class-validator";
import { RelationshipType } from "@keyvantic/types";

export class CreateRelationshipDto {
  @IsString()
  targetDocumentId!: string;

  @IsEnum(RelationshipType)
  type!: RelationshipType;

  @IsOptional()
  @IsString()
  note?: string;
}
