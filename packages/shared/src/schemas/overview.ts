import { z } from "zod";
import { MetricUnitSchema, PeriodSchema } from "./common";

/**
 * Một ô chỉ số trên dashboard (stat tile).
 *
 * `higherIsBetter` để frontend biết `deltaPct` dương là tốt hay xấu — không được
 * suy đoán từ dấu, vì có chỉ số càng thấp càng tốt (ví dụ chi phí trên mỗi hồ sơ).
 */
export const KpiMetricSchema = z.object({
  key: z.string(),
  label: z.string(),
  value: z.number(),
  unit: MetricUnitSchema,
  /** Biến động so với kỳ liền trước, đơn vị %. `null` khi chưa đủ dữ liệu đối chiếu. */
  deltaPct: z.number().nullable(),
  higherIsBetter: z.boolean(),
  /** Diễn giải ngắn hiển thị dưới ô chỉ số. */
  hint: z.string().optional(),
});
export type KpiMetric = z.infer<typeof KpiMetricSchema>;

export const OverviewResponseSchema = z.object({
  period: PeriodSchema,
  updatedAt: z.string(),
  /** Chỉ số dẫn dắt toàn trang — đúng một cái. */
  headline: KpiMetricSchema,
  metrics: z.array(KpiMetricSchema),
});
export type OverviewResponse = z.infer<typeof OverviewResponseSchema>;
