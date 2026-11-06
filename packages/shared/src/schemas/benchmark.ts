import { z } from "zod";
import { BrandSchema } from "./brand-share";
import { MetricUnitSchema, PeriodSchema } from "./common";
import { BenchmarkCoverageSchema, DataProvenanceSchema } from "./kpi-cascade";

/**
 * BẢNG ĐỐI SÁNH — Học viện đứng ở đâu so với nhóm trường cạnh tranh.
 *
 * Vì sao cần một hợp đồng riêng thay vì nhét vào cascade: cascade trả lời "chỉ số của
 * TA đang ở đâu so với mục tiêu của TA". Khung IBMC đòi thêm một câu nữa mà cascade
 * không trả lời được — bài 2.2: bán hết hàng không phải là thoả mãn mục tiêu nếu phần
 * của mình trong thị trường đang nhỏ lại. Muốn biết điều đó thì phải có số của cả
 * nhóm, không chỉ số của mình.
 *
 * Dữ liệu vốn đã nằm sẵn trong các bảng mart theo từng trường (`ma_truong`); trước đây
 * tầng đọc lọc lấy mỗi dòng của Học viện rồi bỏ phần còn lại.
 */

export const BenchmarkRowSchema = z.object({
  brand: BrandSchema,
  /** `null` khi trường này chưa có số ở chiều đó — KHÔNG được thay bằng 0. */
  value: z.number().nullable(),
  /** Hạng trong nhóm, 1 là cao nhất. `null` khi chưa có số nên chưa xếp được. */
  rank: z.number().int().min(1).nullable(),
});
export type BenchmarkRow = z.infer<typeof BenchmarkRowSchema>;

export const BenchmarkDimensionSchema = z
  .object({
    key: z.string().min(1),
    /** Tên chiều, tiếng Việt, đủ làm tiêu đề biểu đồ. */
    label: z.string().min(1),
    /** Mục tiêu trong khung IBMC mà chiều này đo — nối bảng đối sánh về cây mục tiêu. */
    objectiveKey: z.string().min(1),
    unit: MetricUnitSchema,
    /** Với điểm chuẩn và thị phần thì cao hơn là tốt; để sẵn cho chiều chi phí sau này. */
    higherIsBetter: z.boolean(),
    /** Kỳ của riêng chiều này — mỗi mart có nhịp riêng, không có một kỳ chung. */
    periodLabel: z.string().min(1),
    provenance: DataProvenanceSchema,
    /** Mức phủ nhóm đối sánh, nói thẳng khi mẫu số chưa đủ. */
    coverage: BenchmarkCoverageSchema,
    /** Vì sao thiếu, hoặc điều kiện để con số đọc được. */
    note: z.string().min(1),
    /** Mọi trường trong nhóm, kể cả trường chưa có số. Sắp giảm dần theo giá trị. */
    rows: z.array(BenchmarkRowSchema).min(2),
  })
  .superRefine((dim, ctx) => {
    const us = dim.rows.filter((r) => r.brand.isUs);
    if (us.length !== 1) {
      ctx.addIssue({
        code: "custom",
        path: ["rows"],
        message: `Chiều ${dim.key}: phải có đúng một trường đánh dấu isUs, đang có ${us.length}.`,
      });
    }

    // Trường có số thì phải có hạng, và ngược lại. Lệch nghĩa là bước xếp hạng bỏ sót
    // một dòng — khi đó biểu đồ vẽ ra một cột không có vị trí, người xem không biết đọc.
    const lech = dim.rows.filter(
      (r) => (r.value === null) !== (r.rank === null),
    );
    if (lech.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["rows"],
        message: `Chiều ${dim.key}: ${lech.map((r) => r.brand.key).join(", ")} có giá trị mà không có hạng, hoặc ngược lại.`,
      });
    }

    // Nói "đủ nhóm đối sánh" mà vẫn còn trường trống là tự khai sai mức phủ — đúng cái
    // bẫy khiến một con số thị phần tính trên 2 trong 6 trường trông như tính trên cả 6.
    const thieu = dim.rows.filter((r) => r.value === null).length;
    if (dim.coverage === "full" && thieu > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["coverage"],
        message: `Chiều ${dim.key} khai phủ đủ nhóm nhưng còn ${thieu} trường chưa có số.`,
      });
    }
  });
export type BenchmarkDimension = z.infer<typeof BenchmarkDimensionSchema>;

export const BenchmarkScorecardResponseSchema = z.object({
  period: PeriodSchema,
  updatedAt: z.string(),
  dimensions: z.array(BenchmarkDimensionSchema).min(1),
});
export type BenchmarkScorecardResponse = z.infer<
  typeof BenchmarkScorecardResponseSchema
>;

/** Hạng của Học viện trong một chiều. `null` khi chiều đó chưa xếp được. */
export function ourRank(dimension: BenchmarkDimension): number | null {
  return dimension.rows.find((r) => r.brand.isUs)?.rank ?? null;
}

/** Số trường đã có số — mẫu số thật của phép so sánh, luôn hiện cạnh thứ hạng. */
export function rankedCount(dimension: BenchmarkDimension): number {
  return dimension.rows.filter((r) => r.value !== null).length;
}

/**
 * Xếp hạng một danh sách đã có giá trị thô.
 *
 * Gom vào đây để backend, dữ liệu giả lập và test dùng chung đúng một quy tắc: trường
 * chưa có số KHÔNG bị coi là bằng 0 mà bị loại khỏi phép xếp hạng, và thứ tự trả về
 * luôn là giảm dần theo giá trị với các dòng chưa có số nằm cuối.
 */
export function rankRows(
  raw: readonly { brand: BenchmarkRow["brand"]; value: number | null }[],
  higherIsBetter = true,
): BenchmarkRow[] {
  const coSo = raw
    .filter((r) => r.value !== null)
    .sort((a, b) =>
      higherIsBetter ? b.value! - a.value! : a.value! - b.value!,
    );

  const hang = new Map(coSo.map((r, i) => [r.brand.key, i + 1]));

  return [
    ...coSo.map((r) => ({ ...r, rank: hang.get(r.brand.key) ?? null })),
    ...raw.filter((r) => r.value === null).map((r) => ({ ...r, rank: null })),
  ];
}
