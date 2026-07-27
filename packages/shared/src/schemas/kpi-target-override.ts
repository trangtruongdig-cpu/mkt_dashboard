import { z } from "zod";
import {
  evaluateStatus,
  TargetRationaleSchema,
  type CascadeKpi,
  type KpiCascadeResponse,
} from "./kpi-cascade";

/**
 * SỬA MỨC CẦN ĐẠT TỪ GIAO DIỆN.
 *
 * Mức cần đạt là cam kết của Học viện, không phải hằng số kỹ thuật — nên phải sửa
 * được mà không cần lập trình viên. Nhưng sửa cam kết là việc có hệ quả, nên mỗi
 * lần sửa buộc phải kèm căn cứ và ghi lại ai sửa, sửa lúc nào.
 *
 * Giá trị mặc định vẫn nằm trong mã nguồn để hệ thống chạy được ngay khi chưa có
 * cơ sở dữ liệu; bản ghi đè chỉ chồng lên trên.
 */
export const KpiTargetOverrideSchema = z.object({
  kpiKey: z.string().min(1),
  /** `null` = gỡ mục tiêu, đưa chỉ số về trạng thái chờ chốt. */
  target: z.number().nullable(),
  targetRationale: TargetRationaleSchema,
  updatedBy: z.string().min(1),
  updatedAt: z.string(),
});
export type KpiTargetOverride = z.infer<typeof KpiTargetOverrideSchema>;

/** Dữ liệu người dùng gửi lên khi bấm lưu. Máy chủ tự điền `updatedBy` và `updatedAt`. */
export const UpdateKpiTargetSchema = z.object({
  target: z.number().nullable(),
  targetRationale: TargetRationaleSchema,
});
export type UpdateKpiTarget = z.infer<typeof UpdateKpiTargetSchema>;

export const KpiTargetOverrideListSchema = z.object({
  overrides: z.array(KpiTargetOverrideSchema),
});
export type KpiTargetOverrideList = z.infer<typeof KpiTargetOverrideListSchema>;

/**
 * Chồng bản ghi đè lên cascade gốc.
 *
 * Điểm mấu chốt: đổi mục tiêu thì **bắt buộc tính lại `status`** bằng
 * `evaluateStatus`, không được giữ trạng thái cũ. Nếu để tầng giao diện tự xử lý,
 * sẽ có lúc một chỉ số bị hạ mục tiêu xuống cho vừa số hiện tại mà vẫn hiện nhãn
 * "có rủi ro" của mức cũ — hoặc tệ hơn, ngược lại.
 */
export function applyTargetOverrides(
  cascade: KpiCascadeResponse,
  overrides: readonly KpiTargetOverride[],
): KpiCascadeResponse {
  if (overrides.length === 0) return cascade;

  const theoKhoa = new Map(overrides.map((o) => [o.kpiKey, o]));

  const kpis: CascadeKpi[] = cascade.kpis.map((kpi) => {
    const ghi_de = theoKhoa.get(kpi.key);
    if (!ghi_de) return kpi;

    return {
      ...kpi,
      target: ghi_de.target,
      targetRationale: ghi_de.targetRationale,
      status: evaluateStatus(kpi.value, ghi_de.target, kpi.higherIsBetter),
    };
  });

  return { ...cascade, kpis };
}

/** Bản ghi đè trỏ tới chỉ số không tồn tại là dấu hiệu dữ liệu đã trôi — nói ra thay vì bỏ qua. */
export function findOrphanOverrides(
  cascade: KpiCascadeResponse,
  overrides: readonly KpiTargetOverride[],
): string[] {
  const co = new Set(cascade.kpis.map((k) => k.key));
  return overrides.map((o) => o.kpiKey).filter((key) => !co.has(key));
}
