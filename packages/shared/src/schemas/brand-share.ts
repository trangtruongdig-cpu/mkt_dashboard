import { z } from "zod";
import { IsoDateSchema, PeriodSchema } from "./common";
import { DataProvenanceSchema } from "./kpi-cascade";

/**
 * THỊ PHẦN TÌM KIẾM (Share of Search).
 *
 * Chỉ số này đo tỷ trọng mức độ quan tâm tìm kiếm dành cho Học viện so với nhóm
 * trường đối sánh. Lấy được hoàn toàn từ dữ liệu công khai (Google Trends), không
 * cần tài khoản quảng cáo, không cần dữ liệu nội bộ — nên nó là chỉ số đầu tiên
 * chạy được của hệ thống.
 *
 * Giá trị của nó nằm ở chỗ đi TRƯỚC kết quả tuyển sinh: thị phần tìm kiếm biến động
 * theo tuần, trong khi số nhập học mỗi năm mới công bố một lần.
 */

export const BrandSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  /** Đúng một thương hiệu được đánh dấu — Học viện. Giao diện chỉ làm nổi đường này. */
  isUs: z.boolean(),
});
export type Brand = z.infer<typeof BrandSchema>;

export const ShareOfSearchSeriesSchema = z.object({
  brand: BrandSchema,
  /** Tỷ trọng theo %, cùng độ dài và cùng thứ tự với `weeks`. */
  values: z.array(z.number().min(0).max(100)),
});
export type ShareOfSearchSeries = z.infer<typeof ShareOfSearchSeriesSchema>;

export const BrandRankSchema = z.object({
  brand: BrandSchema,
  sharePct: z.number().min(0).max(100),
  /** Thay đổi so với tuần đầu kỳ, tính bằng ĐIỂM PHẦN TRĂM (không phải %). */
  deltaPoints: z.number().nullable(),
});
export type BrandRank = z.infer<typeof BrandRankSchema>;

/** Sai số cho phép khi cộng tỷ trọng các thương hiệu trong một tuần. */
const SHARE_SUM_TOLERANCE = 0.5;

export const ShareOfSearchResponseSchema = z
  .object({
    period: PeriodSchema,
    updatedAt: z.string(),
    /** Ngày thứ Hai của từng tuần, tăng dần. */
    weeks: z.array(IsoDateSchema).min(1),
    series: z.array(ShareOfSearchSeriesSchema).min(2),
    /** Xếp hạng tuần gần nhất, giảm dần theo tỷ trọng. */
    latest: z.array(BrandRankSchema).min(2),
    provenance: DataProvenanceSchema,
  })
  .superRefine((data, ctx) => {
    data.series.forEach((series, index) => {
      if (series.values.length !== data.weeks.length) {
        ctx.addIssue({
          code: "custom",
          path: ["series", index, "values"],
          message: `Chuỗi ${series.brand.key} có ${series.values.length} điểm nhưng kỳ báo cáo có ${data.weeks.length} tuần.`,
        });
      }
    });

    const us = data.series.filter((s) => s.brand.isUs);
    if (us.length !== 1) {
      ctx.addIssue({
        code: "custom",
        path: ["series"],
        message: `Phải có đúng một thương hiệu được đánh dấu isUs, đang có ${us.length}.`,
      });
    }

    // Tỷ trọng là phép chia trên tổng nhóm đối sánh nên mỗi tuần phải cộng lại thành 100.
    // Lệch nghĩa là job tính sai hoặc thiếu mất một thương hiệu.
    data.weeks.forEach((week, weekIndex) => {
      const total = data.series.reduce(
        (sum, series) => sum + (series.values[weekIndex] ?? 0),
        0,
      );
      if (Math.abs(total - 100) > SHARE_SUM_TOLERANCE) {
        ctx.addIssue({
          code: "custom",
          path: ["series"],
          message: `Tuần ${week}: tổng tỷ trọng là ${total.toFixed(2)}%, phải xấp xỉ 100%.`,
        });
      }
    });
  });
export type ShareOfSearchResponse = z.infer<typeof ShareOfSearchResponseSchema>;
