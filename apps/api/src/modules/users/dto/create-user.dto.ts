import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { RoleName } from "@keyvantic/types";

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsString()
  fullName!: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsEnum(RoleName)
  role!: RoleName;
}
