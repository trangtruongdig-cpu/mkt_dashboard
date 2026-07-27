import { z } from "zod";
import {
  evaluateStatus,
  type CascadeKpi,
  type KpiCascadeResponse,
} from "./kpi-cascade";

/**
 * GIÁ TRỊ THẬT ĐO ĐƯỢC TỪ KHO DỮ LIỆU.
 *
 * Phân vai rõ ràng giữa hai thứ:
 *
 *   - CẤU TRÚC (mục tiêu, diễn giải tích cực/tiêu cực, mức cần đạt, căn cứ so sánh)
 *     là quyết định của con người, nằm trong mã nguồn.
 *   - GIÁ TRỊ và MỐC SO SÁNH là số đo, đến từ các bảng `mart__*` do dbt sinh ra.
 *
 * Trộn hai thứ này vào một chỗ là cách nhanh nhất để không ai còn phân biệt được đâu
 * là cam kết, đâu là kết quả.
 */
export const KpiMeasuredValueSchema = z.object({
  kpiKey: z.string().min(1),
  /** `null` khi kỳ này chưa có dữ liệu — ví dụ mùa tuyển sinh chưa tới bậc đó. */
  value: z.number().nullable(),
  baseline: z.number().nullable(),
});
export type KpiMeasuredValue = z.infer<typeof KpiMeasuredValueSchema>;

/**
 * Chồng giá trị đo được lên cascade.
 *
 * Cũng như `applyTargetOverrides`, hàm này **bắt buộc tính lại `status`**. Đổi giá trị
 * mà giữ trạng thái cũ là cách một bảng điều khiển nói dối mà không ai nhận ra.
 *
 * Chỉ số nào không có trong danh sách đo được thì giữ nguyên — phần lớn cascade vẫn
 * đang chờ nguồn, không phải cái gì cũng có số.
 */
export function applyMeasuredValues(
  cascade: KpiCascadeResponse,
  values: readonly KpiMeasuredValue[],
): KpiCascadeResponse {
  if (values.length === 0) return cascade;

  const theoKhoa = new Map(values.map((v) => [v.kpiKey, v]));

  const kpis: CascadeKpi[] = cascade.kpis.map((kpi) => {
    const do_duoc = theoKhoa.get(kpi.key);
    if (!do_duoc) return kpi;

    return {
      ...kpi,
      value: do_duoc.value,
      baseline: do_duoc.baseline,
      status: evaluateStatus(do_duoc.value, kpi.target, kpi.higherIsBetter),
    };
  });

  return { ...cascade, kpis };
}
