import { Global, Inject, Logger, Module, type OnApplicationShutdown } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { Env } from "../config/env";
import * as schema from "./schema";

export const DB = Symbol("DB");
export const SQL_CLIENT = Symbol("SQL_CLIENT");

export type Database = PostgresJsDatabase<typeof schema>;

/**
 * Kết nối PostgreSQL dùng chung cho toàn API.
 *
 * Phạm vi Global vì nhiều module cần; vẫn tách thành provider riêng để test thay
 * được bằng kết nối tới cơ sở dữ liệu tạm.
 */
@Global()
@Module({
  providers: [
    {
      provide: SQL_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): postgres.Sql => {
        const url = config.get("DATABASE_URL", { infer: true });
        if (!url) {
          throw new Error(
            "Thiếu DATABASE_URL. Đặt biến này hoặc bỏ ADMIN_PASSWORD để tắt phần quản trị.",
          );
        }
        // onnotice để trống: PostgreSQL gửi NOTICE cho mọi `IF NOT EXISTS`, không phải lỗi.
        return postgres(url, { max: 10, onnotice: () => {} });
      },
    },
    {
      provide: DB,
      inject: [SQL_CLIENT],
      useFactory: (sql: postgres.Sql): Database => drizzle(sql, { schema }),
    },
  ],
  exports: [DB, SQL_CLIENT],
})
export class DbModule implements OnApplicationShutdown {
  private readonly logger = new Logger(DbModule.name);

  constructor(@Inject(SQL_CLIENT) private readonly sql: postgres.Sql) {}

  /** Đóng pool khi tiến trình dừng, tránh để lại kết nối treo phía PostgreSQL. */
  async onApplicationShutdown(): Promise<void> {
    await this.sql.end({ timeout: 5 });
    this.logger.log("Đã đóng kết nối PostgreSQL.");
  }
}
