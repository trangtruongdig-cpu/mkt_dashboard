import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gt, lt } from "drizzle-orm";
import { DB, type Database } from "../../db/db.module";
import { adminSession, adminUser } from "../../db/schema";

export type AdminUserRow = typeof adminUser.$inferSelect;

/** Phiên còn hiệu lực kèm chủ nhân của nó. */
export interface SessionWithUser {
  user: AdminUserRow;
  expiresAt: Date;
}

/** Mọi truy vấn cơ sở dữ liệu của module auth nằm ở đây, không rải ra service. */
@Injectable()
export class AuthRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  async findUserByUsername(username: string): Promise<AdminUserRow | undefined> {
    const [row] = await this.db
      .select()
      .from(adminUser)
      .where(eq(adminUser.username, username))
      .limit(1);
    return row;
  }

  /**
   * Tạo hoặc cập nhật tài khoản quản trị từ biến môi trường.
   *
   * Idempotent: khởi động lại nhiều lần không sinh thêm tài khoản. Đổi ADMIN_PASSWORD
   * rồi khởi động lại là đổi được mật khẩu.
   */
  async upsertAdmin(input: {
    username: string;
    passwordHash: string;
    displayName: string;
  }): Promise<AdminUserRow> {
    const [row] = await this.db
      .insert(adminUser)
      .values(input)
      .onConflictDoUpdate({
        target: adminUser.username,
        set: { passwordHash: input.passwordHash, displayName: input.displayName },
      })
      .returning();

    // Không thể undefined: RETURNING của một INSERT ... ON CONFLICT DO UPDATE luôn trả một dòng.
    return row as AdminUserRow;
  }

  async createSession(input: {
    tokenHash: string;
    userId: number;
    expiresAt: Date;
  }): Promise<void> {
    await this.db.insert(adminSession).values(input);
  }

  /** Trả về phiên kèm người dùng, chỉ khi phiên chưa hết hạn. */
  async findValidSession(tokenHash: string, now: Date): Promise<SessionWithUser | undefined> {
    const [row] = await this.db
      .select({ user: adminUser, expiresAt: adminSession.expiresAt })
      .from(adminSession)
      .innerJoin(adminUser, eq(adminSession.userId, adminUser.id))
      .where(and(eq(adminSession.tokenHash, tokenHash), gt(adminSession.expiresAt, now)))
      .limit(1);
    return row;
  }

  async deleteSession(tokenHash: string): Promise<void> {
    await this.db.delete(adminSession).where(eq(adminSession.tokenHash, tokenHash));
  }

  /** Dọn phiên đã hết hạn. Gọi lúc khởi động để bảng không phình vô hạn. */
  async deleteExpiredSessions(now: Date): Promise<number> {
    const rows = await this.db
      .delete(adminSession)
      .where(lt(adminSession.expiresAt, now))
      .returning({ id: adminSession.id });
    return rows.length;
  }

  async touchLastLogin(userId: number, at: Date): Promise<void> {
    await this.db.update(adminUser).set({ lastLoginAt: at }).where(eq(adminUser.id, userId));
  }
}
