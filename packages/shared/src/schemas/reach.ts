import { z } from "zod";
import { IsoDateSchema, PeriodSchema, PlatformSchema } from "./common";

/**
 * Chuỗi thời gian lượt tiếp cận theo kênh.
 *
 * Giới hạn tối đa 3 chuỗi: bảng màu chỉ bảo đảm phân biệt được cho người mù màu
 * ở 3 khe đầu tiên. Cần hơn 3 kênh thì tách thành nhiều biểu đồ nhỏ, không thêm màu.
 */
export const ReachSeriesSchema = z.object({
  platform: PlatformSchema,
  label: z.string(),
  values: z.array(z.number()),
});
export type ReachSeries = z.infer<typeof ReachSeriesSchema>;

export const ReachResponseSchema = z.object({
  period: PeriodSchema,
  dates: z.array(IsoDateSchema),
  series: z.array(ReachSeriesSchema).max(3),
});
export type ReachResponse = z.infer<typeof ReachResponseSchema>;
