import { z } from "zod";
import { PeriodSchema } from "./common";

/**
 * Phân bố sắc thái thảo luận về Học viện.
 *
 * Ở hệ thống thật, các con số này do worker Python chấm bằng PhoBERT sinh ra;
 * `modelVersion` bắt buộc có để truy vết điểm nào do phiên bản model nào tạo.
 */
export const SentimentBucketSchema = z.object({
  positive: z.number(),
  neutral: z.number(),
  negative: z.number(),
});
export type SentimentBucket = z.infer<typeof SentimentBucketSchema>;

export const SentimentByWeekSchema = SentimentBucketSchema.extend({
  weekLabel: z.string(),
});
export type SentimentByWeek = z.infer<typeof SentimentByWeekSchema>;

export const SentimentResponseSchema = z.object({
  period: PeriodSchema,
  modelVersion: z.string(),
  totalMentions: z.number(),
  total: SentimentBucketSchema,
  byWeek: z.array(SentimentByWeekSchema),
});
export type SentimentResponse = z.infer<typeof SentimentResponseSchema>;
