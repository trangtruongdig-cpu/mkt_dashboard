import { z } from "zod";
import { PeriodSchema } from "./common";

/**
 * TỪNG Ý KIẾN MỘT, ĐỌC ĐƯỢC NGUYÊN VĂN.
 *
 * Đây là thứ trả lời đúng câu hỏi đã đặt ra khi dựng mảng lắng nghe: "người ta bàn tán
 * gì về Học viện". Biểu đồ tỷ lệ sắc thái trả lời một câu khác — "dư luận đang tốt hay
 * xấu" — và không thay thế được câu này.
 *
 * Một con số "6% tiêu cực" không cho ai biết phải sửa cái gì. Sáu câu tiêu cực đọc được,
 * kèm link về bình luận gốc, thì có.
 */
export const SocialPlatformSchema = z.enum(["youtube", "reddit", "forum"]);
export type SocialPlatform = z.infer<typeof SocialPlatformSchema>;

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  youtube: "YouTube",
  reddit: "Reddit",
  forum: "Diễn đàn",
};

export const SocialContentTypeSchema = z.enum(["comment", "post", "thread"]);
export type SocialContentType = z.infer<typeof SocialContentTypeSchema>;

export const SOCIAL_CONTENT_TYPE_LABELS: Record<SocialContentType, string> = {
  comment: "Bình luận",
  post: "Bài đăng",
  thread: "Chủ đề",
};

export const SentimentLabelSchema = z.enum(["positive", "neutral", "negative"]);
export type SentimentLabel = z.infer<typeof SentimentLabelSchema>;

export const SENTIMENT_LABEL_TEXT: Record<SentimentLabel, string> = {
  positive: "Tích cực",
  neutral: "Trung tính",
  negative: "Tiêu cực",
};

/**
 * Dưới ngưỡng này thì nhãn sắc thái phải hiển thị kèm dấu hiệu "model không chắc", và
 * người đọc nên đọc câu gốc trước khi tin nhãn.
 *
 * Đặt ở đây chứ không trong component: backend dùng nó để sắp xếp, frontend dùng nó để
 * hiển thị. Hai nơi đặt hai ngưỡng khác nhau thì bảng nói một đằng, màu nói một nẻo.
 */
export const MIN_CONFIDENCE = 0.6;

/**
 * Số bản ghi tối thiểu để tỷ lệ sắc thái của MỘT THÁNG được coi là đọc được.
 *
 * Dùng ở ba nơi và bắt buộc phải là cùng một con số:
 *   - `PostgresKpiRepository` — chọn tháng làm mốc so sánh cho KPI
 *   - `PostgresDashboardRepository` — giá trị `minSampleForTrend` trả cho giao diện
 *   - `SentimentChart` — quyết định làm mờ cột nào
 *
 * Ba nơi đặt ba ngưỡng khác nhau thì biểu đồ làm mờ một tháng trong khi cascade vẫn lấy
 * đúng tháng đó làm mốc so sánh — và không ai phát hiện được vì cả hai đều "có lý".
 *
 * Con số 10 đến từ dữ liệu thật: bản dựng theo tuần cho ra phần lớn tuần chỉ 1–5 bản ghi,
 * khiến tỷ lệ nhảy 100% → 0% → 100% trong khi thực chất chỉ là một người bình luận.
 */
export const MIN_MONTHLY_SAMPLE = 10;

/**
 * VẾT TRUY NGUYÊN — mở từ một câu trích dẫn ra đúng bản ghi thô đã sinh ra nó.
 *
 * Đây là yêu cầu của hồ sơ nghiệm thu chứ không phải tính năng phụ: hội đồng phải kiểm
 * được một con số trên màn hình mà không cần mở cơ sở dữ liệu. Không có khối này thì
 * "80% tích cực" là một khẳng định không ai phản bác được, và một khẳng định không phản
 * bác được thì cũng không đáng tin.
 */
export const MentionProvenanceSchema = z.object({
  /** Khoá tự nhiên: băm của (nền tảng, định danh gốc). Tra thẳng được trong kho. */
  mentionKey: z.string().min(1),
  /** Tài khoản người viết, đã băm ngay từ lúc thu thập. `null` khi nguồn không cho biết. */
  authorRef: z.string().nullable(),
  /** Cách hệ thống tìm ra bản ghi này, ví dụ "youtube:comment", "reddit:search". */
  discoveredVia: z.string().min(1),
  /** Từ khoá đã dẫn tới bản ghi. `null` với bình luận — chúng đi kèm video, không tự tìm. */
  searchTerm: z.string().nullable(),
  /** Lần đầu hệ thống nhìn thấy, ISO. Khác `occurredAt` là ngày đăng trên nền tảng. */
  firstSeenAt: z.string(),
  /**
   * CẢ BA điểm, không chỉ nhãn thắng.
   *
   * Chỉ hiện nhãn thắng là giấu mất thông tin: một câu 0,34/0,33/0,33 và một câu
   * 0,99/0,01/0,00 đều ra "tích cực", nhưng mức độ chắc chắn khác hẳn nhau.
   */
  scores: z.object({
    positive: z.number().min(0).max(1),
    neutral: z.number().min(0).max(1),
    negative: z.number().min(0).max(1),
  }),
});
export type MentionProvenance = z.infer<typeof MentionProvenanceSchema>;

export const SocialMentionSchema = z.object({
  key: z.string().min(1),
  platform: SocialPlatformSchema,
  /** Kênh YouTube, subreddit hoặc tên miền diễn đàn. */
  sourceName: z.string().min(1),
  contentType: SocialContentTypeSchema,
  /**
   * Link về đúng bình luận gốc. `null` khi nguồn không cho link trực tiếp.
   *
   * Người xem phải kiểm chứng được mọi câu hiển thị trên dashboard — một trích dẫn
   * không tra ngược được thì không khác gì một câu bịa.
   */
  url: z.string().nullable(),
  text: z.string().min(1),
  /** ISO. Nguồn không cho biết ngày đăng thì đây là lần đầu hệ thống nhìn thấy. */
  occurredAt: z.string(),
  /** Đúng khi `occurredAt` là mốc suy ra chứ không phải ngày đăng thật. */
  occurredAtEstimated: z.boolean(),
  likeCount: z.number().int().nonnegative(),
  sentiment: SentimentLabelSchema,
  /** Thang 0–1. So với `MIN_CONFIDENCE` để biết có nên tin nhãn không. */
  confidence: z.number().min(0).max(1),
  /** Nội dung dài quá giới hạn token, model chỉ chấm phần đầu. */
  truncated: z.boolean(),
  /** Bằng chứng đi kèm mỗi câu. Xem `MentionProvenanceSchema`. */
  provenance: MentionProvenanceSchema,
});
export type SocialMention = z.infer<typeof SocialMentionSchema>;

/**
 * MỘT BƯỚC trong phễu LỌC BẢN GHI, kèm số bản ghi còn lại sau bước đó.
 *
 * Khác hẳn `PipelineStage` ở `data-lineage.ts`, và hai thứ bổ sung cho nhau:
 *   · `PipelineStage`      — dữ liệu đi qua NHỮNG BẢNG NÀO (raw → staging → int → mart)
 *   · `MentionFunnelStage` — mỗi bước lọc còn lại BAO NHIÊU bản ghi, và vì sao rơi
 *
 * Hiện phễu chứ không chỉ hiện con số cuối: người xem thấy 90 ý kiến mà không biết hệ
 * thống đã thu 208 thì sẽ tưởng độ phủ chỉ có vậy. Thấy cả 208 → 90 kèm lý do từng bước
 * thì mới đánh giá được là lọc đúng hay lọc quá tay.
 */
export const MentionFunnelStageSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  count: z.number().int().nonnegative(),
  /** Vì sao bước này loại bớt bản ghi. Bước đầu tiên không loại gì nên để `null`. */
  note: z.string().nullable(),
});
export type MentionFunnelStage = z.infer<typeof MentionFunnelStageSchema>;

export const SocialMentionsResponseSchema = z.object({
  period: PeriodSchema,
  /** Model đã chấm các nhãn trong danh sách này. */
  modelVersion: z.string(),
  /** Tổng số ý kiến trong kho sau khi lọc, KHÔNG phải số dòng trả về. */
  totalMatching: z.number().int().nonnegative(),
  /** Phân bố sắc thái của toàn bộ phần khớp bộ lọc, để hiện được mẫu số. */
  counts: z.object({
    positive: z.number().int().nonnegative(),
    neutral: z.number().int().nonnegative(),
    negative: z.number().int().nonnegative(),
  }),
  mentions: z.array(SocialMentionSchema),
  /** Ngưỡng dùng chung, gửi kèm để giao diện không tự đặt một ngưỡng khác. */
  confidenceThreshold: z.number().min(0).max(1),
  /**
   * Phễu xử lý từ dữ liệu thô tới danh sách đang hiển thị.
   *
   * KHÔNG phụ thuộc bộ lọc người dùng đang chọn: đây là phễu của cả kho, trả lời câu
   * "hệ thống thu được bao nhiêu và loại đi những gì", không phải "bộ lọc này còn mấy dòng".
   */
  funnel: z.array(MentionFunnelStageSchema),
});
export type SocialMentionsResponse = z.infer<typeof SocialMentionsResponseSchema>;

/**
 * Tham số lọc.
 *
 * `coerce` vì tham số truy vấn luôn về dưới dạng chuỗi. Không có nó thì `limit=50` bị
 * từ chối vì "50" không phải số — lỗi chỉ lộ ra lúc chạy thật, không lộ lúc biên dịch.
 */
export const SocialMentionsQuerySchema = z.object({
  sentiment: SentimentLabelSchema.optional(),
  platform: SocialPlatformSchema.optional(),
  /**
   * Trần 200: danh sách này để ĐỌC, không phải để xuất dữ liệu. Cho phép kéo cả kho về
   * một lần là mở đường cho một truy vấn vô tình làm nghẽn cả API.
   */
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type SocialMentionsQuery = z.infer<typeof SocialMentionsQuerySchema>;
