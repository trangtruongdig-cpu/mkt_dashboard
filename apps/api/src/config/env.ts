import { z } from "zod";

/**
 * Coi chuỗi rỗng là KHÔNG KHAI.
 *
 * Biến môi trường không có khái niệm "vắng mặt" khi đi qua docker-compose hay một
 * tệp `.env`: nơi nào không điền thì giá trị là chuỗi rỗng. Mọi biến tuỳ chọn có ràng
 * buộc độ dài đều phải đi qua đây, nếu không ràng buộc đó sẽ bắn vào đúng người chọn
 * không dùng tính năng.
 */
function rong_thanh_thieu<T extends z.ZodTypeAny>(
  schema: T,
): z.ZodOptional<T> | z.ZodPipe<z.ZodTransform<unknown, unknown>, z.ZodOptional<T>> {
  return z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    schema.optional(),
  ) as never;
}

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
  /**
   * Bỏ trống = TẮT phần quản trị, không phải cấu hình sai.
   *
   * `rong_thanh_thieu` chứ không phải `.optional()` trần: biến môi trường đặt bằng
   * chuỗi rỗng là chuyện bình thường — `.env.example` để trống, và docker-compose
   * truyền `ADMIN_PASSWORD=` khi người dùng chưa điền. Với `.optional()` trần thì
   * chuỗi rỗng KHÔNG phải `undefined` nên nó rơi vào `.min(12)` và api ngã ngay lúc
   * khởi động với "Mật khẩu quản trị phải từ 12 ký tự" — một thông điệp khiến người
   * đọc đi đặt mật khẩu dài hơn, trong khi thứ họ muốn là không bật quản trị.
   *
   * Quy ước này giống hệt các biến GOOGLE_* bên dưới: chuỗi rỗng nghĩa là "chưa có".
   */
  ADMIN_PASSWORD: rong_thanh_thieu(
    z.string().min(12, "Mật khẩu quản trị phải từ 12 ký tự"),
  ),
  ADMIN_DISPLAY_NAME: z.string().default("Quản trị viên"),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().max(720).default(12),
  SESSION_COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),

  /**
   * Uỷ quyền Google Analytics. Bí mật chỉ được nằm ở đây, không có đường nào khác —
   * CLAUDE.md mục 4. Để trống khi chưa đấu nối; màn hình Kết nối vẫn dựng được và
   * hướng dẫn từng bước.
   *
   * Chuỗi rỗng nghĩa là "chưa có", `CredentialStoreService` quy đổi sang `null`.
   */
  GOOGLE_CLIENT_ID: z.string().default(""),
  GOOGLE_CLIENT_SECRET: z.string().default(""),
  /** Lấy được sau khi chạy xong luồng OAuth ở trang /ket-noi. */
  GOOGLE_REFRESH_TOKEN: z.string().default(""),
  /** Property GA4 chọn để đồng bộ, dạng số thuần (ví dụ 464491273). */
  GA4_PROPERTY_ID: z.string().default(""),
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
