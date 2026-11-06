import { relations } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * Lược đồ các BẢNG NGHIỆP VỤ CỦA ỨNG DỤNG.
 *
 * Ở đây chỉ có bảng do chính API sở hữu: tài khoản, phiên đăng nhập, cấu hình nguồn
 * thu thập, nhật ký chạy và mức cần đạt đã sửa từ giao diện.
 *
 * KHÔNG khai báo ở đây:
 *   - `mart__*`, `stg__*`  — do dbt sinh ra, đọc bằng SQL thô trong repository.
 *   - `raw_news_mention`   — do worker Python sở hữu và tự tạo.
 * Nếu `drizzle-kit generate` sinh migration định xoá những bảng đó thì nghĩa là
 * ai đó đã khai báo nhầm vào file này.
 */

export const adminUser = pgTable(
  "admin_user",
  {
    id: serial("id").primaryKey(),
    username: text("username").notNull(),
    /** Dạng `scrypt$N$r$p$<salt base64>$<hash base64>`. Không bao giờ trả ra qua API. */
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name").notNull(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("admin_user_username_key").on(t.username)],
);

export const adminSession = pgTable(
  "admin_session",
  {
    id: serial("id").primaryKey(),
    /**
     * SHA-256 của mã phiên, không phải mã phiên gốc. Lộ cơ sở dữ liệu thì kẻ đọc được
     * vẫn không mạo danh được ai, vì không dựng ngược ra mã gốc để đặt vào cookie.
     */
    tokenHash: text("token_hash").notNull(),
    userId: integer("user_id")
      .notNull()
      .references(() => adminUser.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("admin_session_token_key").on(t.tokenHash),
    index("admin_session_expires_idx").on(t.expiresAt),
  ],
);

export const crawlerSource = pgTable(
  "crawler_source",
  {
    id: serial("id").primaryKey(),
    /** `bing_news` | `google_news` | `rss` — đối chiếu với CrawlerSourceKindSchema. */
    kind: text("kind").notNull(),
    /** Khoá tự nhiên, trùng với `name` trong file mồi `config/media-sources.json`. */
    name: text("name").notNull(),
    publisher: text("publisher").notNull(),
    /** `null` với nguồn là công cụ tìm kiếm — chúng không có địa chỉ feed cố định. */
    url: text("url"),
    enabled: boolean("enabled").notNull().default(true),
    pages: integer("pages").notNull().default(1),
    /** `tat` | `moi_gio` | `moi_6_gio` | `hang_ngay` | `hang_tuan`. */
    schedule: text("schedule").notNull().default("tat"),
    note: text("note"),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    lastRunStatus: text("last_run_status"),
    /** Tên đăng nhập của người sửa gần nhất. `null` = do nạp dữ liệu mồi, chưa ai đụng vào. */
    updatedBy: text("updated_by"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("crawler_source_name_key").on(t.name),
    index("crawler_source_enabled_idx").on(t.enabled),
  ],
);

export const crawlerRun = pgTable(
  "crawler_run",
  {
    id: serial("id").primaryKey(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    /** `lich` = do APScheduler kích hoạt, `thu_cong` = quản trị viên bấm nút. */
    trigger: text("trigger").notNull(),
    /** `dang_chay` | `thanh_cong` | `that_bai`. */
    status: text("status").notNull(),
    /** `null` nghĩa là lượt chạy quét toàn bộ nguồn đang bật. */
    sourceName: text("source_name"),
    mentionsFound: integer("mentions_found").notNull().default(0),
    mentionsNew: integer("mentions_new").notNull().default(0),
    extractedOk: integer("extracted_ok").notNull().default(0),
    extractedFailed: integer("extracted_failed").notNull().default(0),
    errorMessage: text("error_message"),
  },
  (t) => [index("crawler_run_started_idx").on(t.startedAt)],
);

/**
 * MỨC CẦN ĐẠT ĐÃ SỬA TỪ GIAO DIỆN.
 *
 * Giá trị mặc định của mọi chỉ số vẫn nằm trong mã nguồn (`buildDemoCascade`) để hệ
 * thống chạy được khi chưa có cơ sở dữ liệu; bảng này chỉ chứa phần đã bị người dùng
 * sửa, chồng lên trên.
 *
 * Trước đây dữ liệu này nằm trong `data/kpi-targets.json` do một route handler của
 * Next.js ghi ra. Cách đó mất sạch khi dựng lại container và không ghi được ai sửa —
 * `updated_by` khi ấy là chuỗi "chưa xác thực". Đưa về đây vì sửa mức cần đạt là sửa
 * cam kết của Học viện, phải bền và phải truy được người chịu trách nhiệm.
 */
export const kpiTargetOverride = pgTable(
  "kpi_target_override",
  {
    /** Khoá tự nhiên: `key` của chỉ số trong cây cascade. Một chỉ số chỉ có một bản ghi đè. */
    kpiKey: text("kpi_key").primaryKey(),
    /** `null` = gỡ mục tiêu, đưa chỉ số về trạng thái chờ chốt. */
    target: doublePrecision("target"),
    /** Đối chiếu với `TargetBasisSchema`. */
    rationaleBasis: text("rationale_basis").notNull(),
    /** Diễn giải cách ra con số. Bắt buộc không rỗng — ép ở tầng zod. */
    rationaleNote: text("rationale_note").notNull(),
    /** Tên đăng nhập của người sửa. Luôn có vì endpoint ghi nằm sau `AuthGuard`. */
    updatedBy: text("updated_by").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("kpi_target_override_updated_idx").on(t.updatedAt)],
);

export const adminUserRelations = relations(adminUser, ({ many }) => ({
  sessions: many(adminSession),
}));

export const adminSessionRelations = relations(adminSession, ({ one }) => ({
  user: one(adminUser, { fields: [adminSession.userId], references: [adminUser.id] }),
}));
