import { IsBoolean, IsEnum, IsOptional, IsString } from "class-validator";
import { RoleName } from "@keyvantic/types";

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsEnum(RoleName)
  role?: RoleName;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
