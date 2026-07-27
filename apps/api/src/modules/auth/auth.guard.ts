import {
  CanActivate,
  createParamDecorator,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Session } from "@ptit/shared";
import type { FastifyRequest } from "fastify";
import { AuthService, SESSION_COOKIE } from "./auth.service";

/** Request đã qua guard thì chắc chắn có phiên đính kèm. */
export interface RequestWithSession extends FastifyRequest {
  session?: Session;
}

/**
 * Chặn mọi endpoint quản trị. Không có cookie phiên hợp lệ thì trả 401.
 *
 * Đặt ở tầng controller bằng `@UseGuards(AuthGuard)` — không đăng ký toàn cục,
 * vì các endpoint đọc dashboard vẫn phải mở cho người xem không đăng nhập.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithSession>();
    const token = request.cookies?.[SESSION_COOKIE];

    const session = await this.auth.resolveSession(token);
    if (!session) {
      throw new UnauthorizedException("Cần đăng nhập quản trị viên");
    }

    request.session = session;
    return true;
  }
}

/** Lấy phiên hiện tại trong controller: `@CurrentSession() session: Session`. */
export const CurrentSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Session => {
    const request = context.switchToHttp().getRequest<RequestWithSession>();
    if (!request.session) {
      // Không xảy ra nếu controller có AuthGuard. Nếu xảy ra là quên gắn guard.
      throw new UnauthorizedException("Thiếu phiên đăng nhập");
    }
    return request.session;
  },
);
