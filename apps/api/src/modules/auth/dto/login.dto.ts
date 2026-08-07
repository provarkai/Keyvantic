import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class LoginDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  password!: string;

  /**
   * Which firm to sign in to. Normally resolved from the request's subdomain; this
   * field is the fallback for local development and for users who belong to more
   * than one tenant.
   */
  @ApiPropertyOptional({ description: "Tenant slug, e.g. 'alpha' for alpha.example.com" })
  @IsOptional()
  @IsString()
  tenantSlug?: string;
}
