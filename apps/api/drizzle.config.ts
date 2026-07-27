import type { Config } from "drizzle-kit";

/**
 * Cấu hình cho `drizzle-kit generate` và `drizzle-kit migrate`.
 *
 * `schema` chỉ trỏ tới bảng nghiệp vụ của ứng dụng. Bảng `mart__*` / `stg__*` do dbt
 * sinh ra và `raw_news_mention` do worker Python sở hữu đều KHÔNG khai ở đây —
 * nếu drizzle-kit sinh ra migration định xoá chúng thì có khai báo sai.
 */
export default {
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://ptit:ptit@localhost:5432/ptit_dashboard",
  },
  strict: true,
  verbose: true,
} satisfies Config;
