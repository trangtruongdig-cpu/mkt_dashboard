import { z } from "zod";

/**
 * Hợp đồng dữ liệu cho màn hình quản trị nguồn thu thập tin bài.
 *
 * Luồng điều khiển đi một chiều, KHÔNG có lời gọi HTTP nào từ API sang worker Python:
 *
 *   Quản trị viên bấm bật/tắt  →  NestJS ghi vào PostgreSQL
 *                                        ↓
 *                              Worker đọc trước mỗi lượt chạy
 *
 * Nhờ vậy worker chạy độc lập: API tắt thì lịch thu thập vẫn chạy đúng cấu hình
 * đã lưu, và ngược lại.
 */

/** Cách một nguồn được thu thập. Trùng với `kind` trong bảng `crawler_source`. */
export const CrawlerSourceKindSchema = z.enum([
  /** Tìm theo từ khoá trên Bing News. Trả về URL thật của báo nên lấy được toàn văn. */
  "bing_news",
  /** Tìm theo từ khoá trên Google News. Chỉ có tiêu đề, báo và ngày đăng. */
  "google_news",
  /** Feed RSS chuyên mục của một tờ báo cụ thể. */
  "rss",
]);
export type CrawlerSourceKind = z.infer<typeof CrawlerSourceKindSchema>;

export const CRAWLER_SOURCE_KIND_LABELS: Record<CrawlerSourceKind, string> = {
  bing_news: "Bing News",
  google_news: "Google News",
  rss: "RSS chuyên mục",
};

/**
 * Tần suất tự chạy. Dùng danh sách chọn sẵn thay vì để người dùng gõ biểu thức cron —
 * cán bộ vận hành không cần biết cú pháp cron, và gõ sai cron là job im lặng không chạy.
 */
export const CrawlerScheduleSchema = z.enum([
  "tat",
  "moi_gio",
  "moi_6_gio",
  "hang_ngay",
  "hang_tuan",
]);
export type CrawlerSchedule = z.infer<typeof CrawlerScheduleSchema>;

export const CRAWLER_SCHEDULE_LABELS: Record<CrawlerSchedule, string> = {
  tat: "Không tự chạy",
  moi_gio: "Mỗi giờ",
  moi_6_gio: "Mỗi 6 giờ",
  hang_ngay: "Hằng ngày lúc 2h sáng",
  hang_tuan: "Thứ Hai hằng tuần lúc 2h sáng",
};

/**
 * Quy đổi sang biểu thức cron cho APScheduler ở worker.
 * Để chung một chỗ với nhãn tiếng Việt để hai bên không bao giờ lệch nhau.
 * Giờ hiểu theo múi giờ khai trong biến `CRAWLER_TIMEZONE` của worker (mặc định Asia/Ho_Chi_Minh).
 */
export const CRAWLER_SCHEDULE_CRON: Record<CrawlerSchedule, string | null> = {
  tat: null,
  moi_gio: "0 * * * *",
  moi_6_gio: "0 */6 * * *",
  hang_ngay: "0 2 * * *",
  hang_tuan: "0 2 * * 1",
};

/**
 * `cho_chay` là mấu chốt của việc "Chạy ngay" hoạt động được khi API và worker là hai
 * container riêng: API không gọi sang worker, nó chỉ ghi một dòng chờ vào PostgreSQL.
 * Worker tự nhặt dòng đó lên và chạy. Bấm nút lúc worker đang tắt thì lượt chạy vẫn còn
 * đó, chạy ngay khi worker bật lại.
 */
export const CrawlerRunStatusSchema = z.enum([
  "cho_chay",
  "dang_chay",
  "thanh_cong",
  "that_bai",
]);
export type CrawlerRunStatus = z.infer<typeof CrawlerRunStatusSchema>;

export const CRAWLER_RUN_STATUS_LABELS: Record<CrawlerRunStatus, string> = {
  cho_chay: "Đang chờ worker",
  dang_chay: "Đang chạy",
  thanh_cong: "Thành công",
  that_bai: "Thất bại",
};

/** Lượt chạy do lịch kích hoạt hay do quản trị viên bấm nút. */
export const CrawlerTriggerSchema = z.enum(["lich", "thu_cong"]);
export type CrawlerTrigger = z.infer<typeof CrawlerTriggerSchema>;

export const CrawlerSourceSchema = z.object({
  id: z.number().int().positive(),
  kind: CrawlerSourceKindSchema,
  /** Định danh không đổi, dùng làm khoá tự nhiên khi nạp dữ liệu mồi. */
  name: z.string(),
  /** Tên báo hiển thị cho người đọc. Với công cụ tìm kiếm thì là tên công cụ. */
  publisher: z.string(),
  /** Địa chỉ feed RSS. `null` với nguồn là công cụ tìm kiếm. */
  url: z.string().nullable(),
  enabled: z.boolean(),
  /** Số trang kết quả cần lấy. Chỉ có ý nghĩa với công cụ tìm kiếm. */
  pages: z.number().int().min(1).max(10),
  schedule: CrawlerScheduleSchema,
  /** Lý do một nguồn bị tắt, ví dụ "feed rỗng từ 27/07/2026". Hiện ra cho quản trị viên. */
  note: z.string().nullable(),
  lastRunAt: z.string().nullable(),
  lastRunStatus: CrawlerRunStatusSchema.nullable(),
  /** Tên đăng nhập của người sửa gần nhất — vết kiểm toán tối thiểu. */
  updatedBy: z.string().nullable(),
  updatedAt: z.string(),
});
export type CrawlerSource = z.infer<typeof CrawlerSourceSchema>;

export const CrawlerSourceListSchema = z.object({
  sources: z.array(CrawlerSourceSchema),
});
export type CrawlerSourceList = z.infer<typeof CrawlerSourceListSchema>;

/** Thân yêu cầu khi quản trị viên sửa một nguồn. Mọi trường đều tuỳ chọn. */
export const UpdateCrawlerSourceSchema = z
  .object({
    enabled: z.boolean().optional(),
    pages: z.number().int().min(1).max(10).optional(),
    schedule: CrawlerScheduleSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "Phải có ít nhất một trường cần sửa",
  });
export type UpdateCrawlerSource = z.infer<typeof UpdateCrawlerSourceSchema>;

export const CrawlerRunSchema = z.object({
  id: z.number().int().positive(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  trigger: CrawlerTriggerSchema,
  status: CrawlerRunStatusSchema,
  /** Tên nguồn đã chạy. `null` nghĩa là chạy toàn bộ nguồn đang bật. */
  sourceName: z.string().nullable(),
  mentionsFound: z.number().int().min(0),
  mentionsNew: z.number().int().min(0),
  extractedOk: z.number().int().min(0),
  extractedFailed: z.number().int().min(0),
  /** Đã lọc bỏ mọi chuỗi trông giống bí mật trước khi lưu. */
  errorMessage: z.string().nullable(),
});
export type CrawlerRun = z.infer<typeof CrawlerRunSchema>;

export const CrawlerRunListSchema = z.object({
  runs: z.array(CrawlerRunSchema),
});
export type CrawlerRunList = z.infer<typeof CrawlerRunListSchema>;

/** Tổng quan hiện ra đầu trang quản trị. */
export const CrawlerOverviewSchema = z.object({
  totalSources: z.number().int().min(0),
  enabledSources: z.number().int().min(0),
  scheduledSources: z.number().int().min(0),
  /** Tổng số bài đã thu về, tính cả owned lẫn earned. */
  totalMentions: z.number().int().min(0),
  lastRun: CrawlerRunSchema.nullable(),
  /**
   * Có lượt nào đang chờ hoặc đang chạy không — giao diện dựa vào đây để khoá
   * nút "Chạy ngay", tránh xếp chồng nhiều lượt.
   */
  running: z.boolean(),
});
export type CrawlerOverview = z.infer<typeof CrawlerOverviewSchema>;
