import { z } from "zod";

/**
 * Danh mục kênh marketing số của Học viện.
 * Giá trị phải trùng với cột `platform` của các bảng `mart__*` do dbt sinh ra.
 */
export const PlatformSchema = z.enum([
  "facebook",
  "youtube",
  "tiktok",
  "website",
  "zalo",
]);
export type Platform = z.infer<typeof PlatformSchema>;

export const PLATFORM_LABELS: Record<Platform, string> = {
  facebook: "Facebook",
  youtube: "YouTube",
  tiktok: "TikTok",
  website: "Website",
  zalo: "Zalo OA",
};

/** Đơn vị của một chỉ số — quyết định cách frontend định dạng số. */
export const MetricUnitSchema = z.enum(["count", "percent", "currency"]);
export type MetricUnit = z.infer<typeof MetricUnitSchema>;

/** Ngày ở dạng `YYYY-MM-DD`. */
export const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày phải ở định dạng YYYY-MM-DD");

/** Khoảng thời gian báo cáo, dùng chung cho mọi endpoint. */
export const PeriodSchema = z.object({
  from: IsoDateSchema,
  to: IsoDateSchema,
  label: z.string(),
});
export type Period = z.infer<typeof PeriodSchema>;
