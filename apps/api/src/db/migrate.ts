import { Logger } from "@nestjs/common";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import postgres from "postgres";

const logger = new Logger("Migration");

/**
 * Chạy migration lúc khởi động.
 *
 * `docker compose up -d` phải dựng được toàn hệ thống trong một lệnh — bắt người dùng
 * chạy thêm `drizzle-kit migrate` bằng tay là một bước thủ công không ghi tài liệu.
 *
 * Dùng kết nối riêng với `max: 1` rồi đóng ngay: migration chạy tuần tự, không cần pool,
 * và giữ nó tách khỏi pool chính để lỗi migration không làm hỏng kết nối của ứng dụng.
 */
export async function runMigrations(databaseUrl: string): Promise<void> {
  const folder = findMigrationsFolder();
  if (!folder) {
    logger.warn("Không tìm thấy thư mục migration — bỏ qua.");
    return;
  }

  const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });
  try {
    await migrate(drizzle(sql), { migrationsFolder: folder });
    logger.log("Đã áp dụng migration cơ sở dữ liệu.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

/**
 * Tìm thư mục migration cho cả hai trường hợp: chạy từ mã nguồn (`src/db/migrations`)
 * và chạy từ bản build (`dist/db/migrations`).
 */
function findMigrationsFolder(): string | null {
  const ung_vien = [
    join(__dirname, "migrations"),
    join(resolve(__dirname, "..", ".."), "src", "db", "migrations"),
    join(process.cwd(), "src", "db", "migrations"),
    join(dirname(process.cwd()), "api", "src", "db", "migrations"),
  ];
  return ung_vien.find((p) => existsSync(p)) ?? null;
}
