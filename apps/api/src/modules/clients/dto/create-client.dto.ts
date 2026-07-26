import { IsOptional, IsString } from "class-validator";

export class CreateClientDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  primaryContact?: string;

  @IsOptional()
  @IsString()
  logoUrl?: string;
}
