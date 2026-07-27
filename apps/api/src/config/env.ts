import { z } from "zod";

/**
 * Biến môi trường của API. Kiểm tra ngay lúc khởi động — thiếu hoặc sai thì
 * tiến trình dừng luôn, không chạy tiếp với cấu hình nửa vời.
 */
export const EnvSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().default(3001),
  /** Danh sách origin được phép gọi API, ngăn cách bằng dấu phẩy. `*` = mở cho mọi origin (chỉ dùng khi demo). */
  CORS_ORIGINS: z.string().default("*"),
  /**
   * `demo`     — đọc bộ số liệu giả lập trong @ptit/shared (chưa đấu nối dữ liệu thật).
   * `postgres` — đọc các bảng `mart__*` do dbt sinh ra.
   */
  DATA_SOURCE: z.enum(["demo", "postgres"]).default("demo"),

  /** Chuỗi kết nối PostgreSQL. Bắt buộc khi DATA_SOURCE=postgres. */
  DATABASE_URL: z.string().optional(),

  WEB_URL: z.string().default("http://localhost:3000"),
  /** Phải trùng KHÍT với URI chuyển hướng đã khai trên Google Cloud. */
  API_PUBLIC_URL: z.string().default("http://localhost:3002"),

  ADMIN_USERNAME: z.string().min(1).default("admin"),
  ADMIN_PASSWORD: z.string().min(12, "Mật khẩu quản trị phải từ 12 ký tự").optional(),
  ADMIN_DISPLAY_NAME: z.string().default("Quản trị viên"),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().max(720).default(12),
  SESSION_COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
});

export type Env = z.infer<typeof EnvSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = EnvSchema.safeParse(raw);
  if (!parsed.success) {
    const chi_tiet = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Cấu hình môi trường không hợp lệ:\n${chi_tiet}`);
  }
  return parsed.data;
}

export function loadEnv(): Env {
  return validateEnv(process.env as Record<string, unknown>);
}
