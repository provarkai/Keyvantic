import { Body, Controller, Get, Post, Req, Res, UnauthorizedException } from "@nestjs/common";
import type { Request, Response } from "express";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { Public } from "../../common/decorators/public.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { JwtUserPayload } from "@keyvantic/types";
import { UsersService } from "../users/users.service";

const REFRESH_COOKIE = "kos_refresh_token";
const ACCESS_COOKIE = "kos_access_token";

@Controller("auth")
export class AuthController {
  constructor(
    private authService: AuthService,
    private config: ConfigService,
    private usersService: UsersService,
  ) {}

  private cookieOptions(maxAgeMs: number) {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      domain: this.config.get<string>("COOKIE_DOMAIN", "localhost"),
      maxAge: maxAgeMs,
      path: "/",
    };
  }

  @Public()
  @Post("login")
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto.email, dto.password, req.ip);
    res.cookie(ACCESS_COOKIE, result.accessToken, this.cookieOptions(15 * 60 * 1000));
    res.cookie(REFRESH_COOKIE, result.refreshToken, this.cookieOptions(7 * 24 * 60 * 60 * 1000));
    return { user: result.user, accessToken: result.accessToken };
  }

  @Public()
  @Post("refresh")
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken = req.cookies?.[REFRESH_COOKIE];
    if (!refreshToken) throw new UnauthorizedException("No refresh token");
    const tokens = await this.authService.refresh(refreshToken);
    res.cookie(ACCESS_COOKIE, tokens.accessToken, this.cookieOptions(15 * 60 * 1000));
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, this.cookieOptions(7 * 24 * 60 * 60 * 1000));
    return { accessToken: tokens.accessToken };
  }

  @Post("logout")
  async logout(
    @CurrentUser() user: JwtUserPayload,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(req.cookies?.[REFRESH_COOKIE], user.sub);
    res.clearCookie(ACCESS_COOKIE);
    res.clearCookie(REFRESH_COOKIE);
    return { success: true };
  }

  @Get("me")
  async me(@CurrentUser() user: JwtUserPayload) {
    const profile = await this.usersService.findById(user.sub);
    return { ...profile, role: user.role, permissions: user.permissions };
  }
}
