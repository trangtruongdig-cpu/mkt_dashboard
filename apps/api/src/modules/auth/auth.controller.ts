import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { LoginRequestSchema, SessionSchema, type LoginRequest, type Session } from "@ptit/shared";
import type { FastifyReply, FastifyRequest } from "fastify";
import { ZodOkResponse } from "../../common/openapi";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import type { Env } from "../../config/env";
import { AuthGuard, CurrentSession } from "./auth.guard";
import { AuthService, SESSION_COOKIE } from "./auth.service";

@ApiTags("Quản trị — Đăng nhập")
@Controller("v1/auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Post("login")
  @HttpCode(200)
  @ApiOperation({
    summary: "Đăng nhập quản trị viên",
    description:
      "Trả về phiên và đặt cookie HttpOnly. Trình duyệt tự gửi kèm cookie ở các lần gọi sau, " +
      "giao diện không cần lưu gì trong localStorage.",
  })
  @ZodOkResponse(SessionSchema, "Phiên đăng nhập vừa tạo")
  async login(
    @Body(new ZodValidationPipe(LoginRequestSchema)) body: LoginRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<Session> {
    const { token, session } = await this.auth.login(body.username, body.password);

    reply.setCookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: this.config.get("SESSION_COOKIE_SECURE", { infer: true }),
      path: "/",
      expires: new Date(session.expiresAt),
    });

    return session;
  }

  @Post("logout")
  @HttpCode(204)
  @ApiOperation({ summary: "Đăng xuất và huỷ phiên hiện tại" })
  async logout(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    await this.auth.logout(request.cookies?.[SESSION_COOKIE]);
    reply.clearCookie(SESSION_COOKIE, { path: "/" });
  }

  @Get("me")
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: "Thông tin phiên đang đăng nhập",
    description: "Giao diện gọi khi tải trang để biết có cần hiện màn hình đăng nhập không.",
  })
  @ZodOkResponse(SessionSchema, "Phiên còn hiệu lực")
  me(@CurrentSession() session: Session): Session {
    return session;
  }
}
