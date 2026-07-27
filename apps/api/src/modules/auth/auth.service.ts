import {
  Injectable,
  Logger,
  UnauthorizedException,
  type OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AdminUser, Session } from "@ptit/shared";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Env } from "../../config/env";
import { AuthRepository, type AdminUserRow } from "./auth.repository";
import { hashPassword, verifyPassword } from "./password";

/** Tên cookie chứa mã phiên. */
export const SESSION_COOKIE = "ptit_admin_session";

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly repo: AuthRepository,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Tạo tài khoản quản trị từ biến môi trường và dọn phiên cũ, ngay khi API khởi động. */
  async onModuleInit(): Promise<void> {
    const username = this.config.get("ADMIN_USERNAME", { infer: true });
    const password = this.config.get("ADMIN_PASSWORD", { infer: true });
    const displayName = this.config.get("ADMIN_DISPLAY_NAME", { infer: true });

    if (!password) return;

    await this.repo.upsertAdmin({
      username,
      passwordHash: await hashPassword(password),
      displayName,
    });
    this.logger.log(`Đã sẵn sàng tài khoản quản trị "${username}".`);

    const da_don = await this.repo.deleteExpiredSessions(new Date());
    if (da_don > 0) this.logger.log(`Đã dọn ${da_don} phiên hết hạn.`);
  }

  /**
   * Kiểm tra tên đăng nhập và mật khẩu, tạo phiên mới.
   *
   * Trả về mã phiên gốc để controller đặt vào cookie; cơ sở dữ liệu chỉ giữ giá trị băm.
   */
  async login(username: string, password: string): Promise<{ token: string; session: Session }> {
    const user = await this.repo.findUserByUsername(username);

    // Sai tên và sai mật khẩu phải mất thời gian như nhau, nếu không kẻ tấn công dò
    // được tên đăng nhập nào có thật chỉ bằng cách đo thời gian phản hồi.
    const hop_le = user
      ? await verifyPassword(password, user.passwordHash)
      : await this.burnTime(password);

    if (!user || !hop_le) {
      throw new UnauthorizedException("Tên đăng nhập hoặc mật khẩu không đúng");
    }

    const token = randomBytes(32).toString("base64url");
    const ttlGio = this.config.get("SESSION_TTL_HOURS", { infer: true });
    const expiresAt = new Date(Date.now() + ttlGio * 60 * 60 * 1000);

    await this.repo.createSession({ tokenHash: hashToken(token), userId: user.id, expiresAt });

    const bay_gio = new Date();
    await this.repo.touchLastLogin(user.id, bay_gio);
    this.logger.log(`Quản trị viên "${username}" đăng nhập.`);

    return {
      token,
      session: {
        user: toAdminUser({ ...user, lastLoginAt: bay_gio }),
        expiresAt: expiresAt.toISOString(),
      },
    };
  }

  async logout(token: string | undefined): Promise<void> {
    if (token) await this.repo.deleteSession(hashToken(token));
  }

  /** Trả về phiên nếu mã còn hiệu lực, `null` nếu không. Guard dùng hàm này. */
  async resolveSession(token: string | undefined): Promise<Session | null> {
    if (!token) return null;

    const row = await this.repo.findValidSession(hashToken(token), new Date());
    if (!row) return null;

    return { user: toAdminUser(row.user), expiresAt: row.expiresAt.toISOString() };
  }

  /**
   * Băm một mật khẩu rồi vứt kết quả đi, chỉ để tiêu tốn cùng lượng thời gian như
   * một lần kiểm tra thật. Luôn trả về `false`.
   */
  private async burnTime(password: string): Promise<boolean> {
    const gia = await hashPassword(password);
    // So với chính nó cho trình biên dịch khỏi loại bỏ lời gọi trên.
    return timingSafeEqual(Buffer.from(gia), Buffer.from(gia)) && false;
  }
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function toAdminUser(row: AdminUserRow): AdminUser {
  return {
    username: row.username,
    displayName: row.displayName,
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
  };
}
