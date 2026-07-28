import { z } from "zod";
import { PeriodSchema } from "./common";

/**
 * Sắc thái thảo luận về Học viện.
 *
 * Hai NGUỒN riêng biệt, KHÔNG gộp được vào một con số:
 *
 *   news    Báo chí viết về Học viện, chấm bằng PhoBERT (văn phong chuẩn).
 *   social  Người dùng thường nói về Học viện trên mạng xã hội và diễn đàn,
 *           chấm bằng ViSoBERT (teencode, không dấu, emoji).
 *
 * Đo trên dữ liệu thật, hai nguồn cho ra 56,9% và 80,0% tích cực. Chênh lệch đó chính
 * là thông tin: báo chí đưa tin điểm chuẩn và thông báo nên trung tính hơn hẳn, còn dư
 * luận thì ấm hơn. Trộn hai nguồn vào một tỷ lệ là xoá mất đúng cái khác biệt cần thấy.
 * Vì vậy mỗi phản hồi buộc phải khai rõ mình là nguồn nào.
 */
export const SentimentSourceSchema = z.enum(["news", "social"]);
export type SentimentSource = z.infer<typeof SentimentSourceSchema>;

export const SENTIMENT_SOURCE_LABELS: Record<SentimentSource, string> = {
  news: "Báo chí viết về Học viện",
  social: "Người ngoài nói về Học viện",
};

export const SentimentBucketSchema = z.object({
  positive: z.number(),
  neutral: z.number(),
  negative: z.number(),
});
export type SentimentBucket = z.infer<typeof SentimentBucketSchema>;

/**
 * Một tháng trong biểu đồ.
 *
 * Gộp theo THÁNG chứ không theo tuần, và đây là kết luận rút từ dữ liệu thật: bản dựng
 * theo tuần cho ra phần lớn tuần chỉ 1–5 bản ghi, khiến đường xu hướng nhảy
 * 100% → 0% → 100% trong khi thực chất chỉ là một người bình luận.
 */
export const SentimentByMonthSchema = SentimentBucketSchema.extend({
  /** Nhãn hiển thị trên trục, dạng "07/2026". */
  monthLabel: z.string(),
  /** Ngày đầu tháng, ISO. Dùng để sắp xếp và để đối chiếu ngược về kho. */
  monthStart: z.string(),
  /**
   * Mẫu số. BẮT BUỘC hiển thị kèm mọi tỷ lệ phần trăm — một tháng 2 bản ghi và một tháng
   * 200 bản ghi cùng cho ra 100% tích cực, nhưng chỉ một trong hai là thông tin.
   */
  total: z.number().int().nonnegative(),
});
export type SentimentByMonth = z.infer<typeof SentimentByMonthSchema>;

export const SentimentResponseSchema = z
  .object({
    period: PeriodSchema,
    source: SentimentSourceSchema,
    /**
     * Model và bản trọng số đã sinh ra các điểm này. Bắt buộc có để truy vết được điểm
     * nào do phiên bản nào tạo — đổi model là đổi cách đọc số.
     */
    modelVersion: z.string(),
    totalMentions: z.number().int().nonnegative(),
    total: SentimentBucketSchema,
    byMonth: z.array(SentimentByMonthSchema),
    /**
     * Dưới ngưỡng này thì tỷ lệ của tháng đó không đủ để kết luận, giao diện phải làm mờ
     * và ghi chú. Đặt ở tầng dữ liệu chứ không phải trong component, để backend và
     * frontend không tự đặt hai ngưỡng khác nhau.
     */
    minSampleForTrend: z.number().int().positive(),
  })
  .superRefine((data, ctx) => {
    // Tổng phải khớp với tổng các tháng. Lệch nghĩa là hai bên được tính riêng — đúng
    // loại lỗi khiến con số trên thẻ tóm tắt không khớp với biểu đồ ngay bên dưới nó.
    const cong = data.byMonth.reduce((acc, m) => acc + m.total, 0);
    if (cong !== data.totalMentions) {
      ctx.addIssue({
        code: "custom",
        path: ["totalMentions"],
        message: `Tổng lượt nhắc (${data.totalMentions}) không khớp tổng các tháng (${cong}).`,
      });
    }
  });
export type SentimentResponse = z.infer<typeof SentimentResponseSchema>;
