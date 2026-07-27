import { z } from "zod";
import { PeriodSchema, PlatformSchema } from "./common";

/** Hiệu quả từng kênh trong kỳ báo cáo. */
export const ChannelPerformanceSchema = z.object({
  platform: PlatformSchema,
  label: z.string(),
  reach: z.number(),
  engagement: z.number(),
  /** Tương tác / tiếp cận, đơn vị %. */
  engagementRate: z.number(),
  /** Số lượt vào trang tuyển sinh bắt nguồn từ kênh này. */
  admissionVisits: z.number(),
  /** Số hồ sơ đăng ký xét tuyển quy về kênh này. */
  applications: z.number(),
});
export type ChannelPerformance = z.infer<typeof ChannelPerformanceSchema>;

export const ChannelsResponseSchema = z.object({
  period: PeriodSchema,
  channels: z.array(ChannelPerformanceSchema),
});
export type ChannelsResponse = z.infer<typeof ChannelsResponseSchema>;
