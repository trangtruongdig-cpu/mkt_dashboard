import { z } from "zod";

/**
 * BẢN ĐỒ ĐƯỜNG ỐNG DỮ LIỆU — từ bảng thô tới con số trên màn hình.
 *
 * Vì sao màn hình này tồn tại: hội đồng nghiệm thu phải lần được từ một con số bất kỳ
 * về đúng bảng đã sinh ra nó, và thấy được nó đi qua những bước biến đổi nào. Một
 * dashboard không cho làm việc đó thì mọi con số đều phải tin bằng niềm tin.
 *
 * Bốn tầng, đúng thứ tự dữ liệu chảy:
 *
 *     raw          →  staging      →  intermediate  →  mart
 *     job thu thập    ép kiểu,        logic dùng       hợp đồng dữ liệu
 *     ghi thẳng       đổi tên cột     chung nhiều nơi  với backend
 */

export const PipelineStageSchema = z.enum([
  "raw",
  "staging",
  "intermediate",
  "mart",
]);
export type PipelineStage = z.infer<typeof PipelineStageSchema>;

export const PIPELINE_STAGE_LABELS: Record<PipelineStage, string> = {
  raw: "Dữ liệu thô",
  staging: "Chuẩn hoá",
  intermediate: "Trung gian",
  mart: "Hợp đồng dữ liệu",
};

export const PIPELINE_STAGE_NOTES: Record<PipelineStage, string> = {
  raw: "Job thu thập ghi thẳng, không biến đổi gì. Không ai được sửa tay ở tầng này.",
  staging: "Ép kiểu và đổi tên cột sang tiếng Việt. Một bảng thô một view, không gộp.",
  intermediate: "Logic dùng chung cho nhiều mart, tách ra để không lặp lại.",
  mart: "Bảng backend đọc. Đây là hợp đồng dữ liệu — đổi cột là đổi hợp đồng.",
};

/** Mức độ nhạy cảm, quyết định có cho xem dữ liệu mẫu hay không. */
export const DataSensitivitySchema = z.enum([
  /** Nguồn công khai: tin bài, tài liệu công khai bắt buộc, Wikipedia. Xem mẫu được. */
  "public",
  /** Dữ liệu vận hành của Học viện hoặc nội dung người dùng. KHÔNG hiện mẫu. */
  "internal",
]);
export type DataSensitivity = z.infer<typeof DataSensitivitySchema>;

export const DatasetSchema = z.object({
  /** Tên bảng, không kèm lược đồ. */
  name: z.string().min(1),
  stage: PipelineStageSchema,
  /** Số dòng hiện có. `null` khi không đếm được (bảng chưa dựng). */
  rowCount: z.number().int().nonnegative().nullable(),
  /** Mô tả bằng tiếng Việt: bảng này chứa gì và ai sinh ra nó. */
  description: z.string().min(1),
  /** Lệnh tạo ra bảng này, để người đọc chạy lại được. `null` với bảng do dbt dựng. */
  producedBy: z.string().nullable(),
  sensitivity: DataSensitivitySchema,
});
export type Dataset = z.infer<typeof DatasetSchema>;

/** Một cạnh của đồ thị: `from` chảy vào `to`. */
export const LineageEdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
});
export type LineageEdge = z.infer<typeof LineageEdgeSchema>;

/** Chỉ số nào đọc bảng mart nào — mắt xích cuối của chuỗi truy vết. */
export const KpiSourceLinkSchema = z.object({
  kpiKey: z.string().min(1),
  dataset: z.string().min(1),
});
export type KpiSourceLink = z.infer<typeof KpiSourceLinkSchema>;

/** Vài dòng đầu của một bảng công khai, để nhìn tận mắt dữ liệu thô. */
export const DatasetSampleSchema = z.object({
  dataset: z.string().min(1),
  columns: z.array(z.string()),
  /** Mỗi dòng là mảng chuỗi đã ép kiểu, cùng thứ tự với `columns`. */
  rows: z.array(z.array(z.string().nullable())),
  /** Số dòng lấy về, luôn nhỏ hơn nhiều so với `rowCount` của bảng. */
  limit: z.number().int().positive(),
});
export type DatasetSample = z.infer<typeof DatasetSampleSchema>;

export const DataLineageResponseSchema = z
  .object({
    updatedAt: z.string(),
    datasets: z.array(DatasetSchema).min(1),
    edges: z.array(LineageEdgeSchema),
    kpiLinks: z.array(KpiSourceLinkSchema),
    samples: z.array(DatasetSampleSchema),
  })
  .superRefine((data, ctx) => {
    const ten = new Set(data.datasets.map((d) => d.name));

    // Cạnh trỏ vào bảng không tồn tại nghĩa là bản đồ sai — và một bản đồ sai còn tệ
    // hơn không có bản đồ, vì người đọc tin vào nó.
    data.edges.forEach((canh, i) => {
      if (!ten.has(canh.from)) {
        ctx.addIssue({
          code: "custom",
          path: ["edges", i, "from"],
          message: `Cạnh trỏ từ bảng không có trong danh sách: ${canh.from}.`,
        });
      }
      if (!ten.has(canh.to)) {
        ctx.addIssue({
          code: "custom",
          path: ["edges", i, "to"],
          message: `Cạnh trỏ tới bảng không có trong danh sách: ${canh.to}.`,
        });
      }
    });

    data.kpiLinks.forEach((lien_ket, i) => {
      if (!ten.has(lien_ket.dataset)) {
        ctx.addIssue({
          code: "custom",
          path: ["kpiLinks", i, "dataset"],
          message: `Chỉ số ${lien_ket.kpiKey} trỏ tới bảng không tồn tại: ${lien_ket.dataset}.`,
        });
      }
    });

    // Chỉ bảng nguồn công khai mới được hiện dữ liệu mẫu. Ràng buộc đặt ở tầng hợp
    // đồng chứ không ở giao diện: một lần sửa nhầm ở tầng trình bày là lộ dữ liệu vận
    // hành của Học viện ra ngoài.
    const nhay_cam = new Map(data.datasets.map((d) => [d.name, d.sensitivity]));
    data.samples.forEach((mau, i) => {
      if (nhay_cam.get(mau.dataset) !== "public") {
        ctx.addIssue({
          code: "custom",
          path: ["samples", i, "dataset"],
          message: `Bảng ${mau.dataset} không thuộc nhóm nguồn công khai nên không được hiện dữ liệu mẫu.`,
        });
      }
    });
  });
export type DataLineageResponse = z.infer<typeof DataLineageResponseSchema>;

/** Gom bảng theo tầng, giữ nguyên thứ tự dòng chảy của dữ liệu. */
export function datasetsByStage(
  lineage: DataLineageResponse,
): { stage: PipelineStage; datasets: Dataset[] }[] {
  return PipelineStageSchema.options.map((stage) => ({
    stage,
    datasets: lineage.datasets.filter((d) => d.stage === stage),
  }));
}

/** Chuỗi bảng dẫn tới một bảng đích, lần ngược về tầng thô. */
export function upstreamOf(
  lineage: DataLineageResponse,
  dataset: string,
): string[] {
  const chuoi: string[] = [];
  const da_xet = new Set<string>();
  let hang_doi = [dataset];

  while (hang_doi.length > 0) {
    const tiep: string[] = [];
    for (const ten of hang_doi) {
      for (const canh of lineage.edges) {
        if (canh.to !== ten || da_xet.has(canh.from)) continue;
        da_xet.add(canh.from);
        chuoi.push(canh.from);
        tiep.push(canh.from);
      }
    }
    hang_doi = tiep;
  }

  return chuoi;
}
