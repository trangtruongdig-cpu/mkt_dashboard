import { z } from "zod";
import { MetricUnitSchema, PeriodSchema } from "./common";

/**
 * MÔ HÌNH CASCADE MỤC TIÊU — nguồn sự thật của logic dashboard.
 *
 * Toàn bộ dashboard dựng trên một chuỗi suy diễn duy nhất:
 *
 *     Mục tiêu kinh doanh  →  Mục tiêu marketing  →  Mục tiêu truyền thông  →  KPI
 *
 * Nội dung từng tầng lấy từ khung IBMC (xem `docs/ly-thuyet/ibmc-khung-dat-muc-tieu.md`):
 *
 *     kinh doanh    : Sale · Share · Growth · Profit          (số liệu của Học viện)
 *     marketing     : Penetration · Frequency · Consumption ·
 *                     Choice · Loyalty                        (hành vi người học)
 *     truyền thông  : Awareness · Key attributes ·
 *                     Creative quality · Hiệu quả kênh        (nhận thức người học)
 *
 * Mỗi KPI bắt buộc trỏ về một mục tiêu (`objectiveKey`), mỗi mục tiêu marketing và
 * truyền thông bắt buộc trỏ về mục tiêu tầng trên (`parentKey`). Ràng buộc này được
 * kiểm ở tầng schema, không phải ở tầng giao diện — nghĩa là một chỉ số không gắn
 * mục tiêu nào thì API trả về sẽ hỏng ngay, không thể lọt lên màn hình.
 *
 * Đây là điểm khác biệt với một dashboard chỉ biểu diễn số liệu: ở đây không tồn tại
 * "chỉ số mồ côi".
 */

/** Ba tầng của cascade. Thứ tự trong enum chính là thứ tự suy diễn. */
export const ObjectiveTierSchema = z.enum([
  "business",
  "marketing",
  "communication",
]);
export type ObjectiveTier = z.infer<typeof ObjectiveTierSchema>;

export const OBJECTIVE_TIER_LABELS: Record<ObjectiveTier, string> = {
  business: "Mục tiêu kinh doanh",
  marketing: "Mục tiêu marketing",
  communication: "Mục tiêu truyền thông",
};

/** Tầng cha hợp lệ của mỗi tầng. `null` = tầng gốc, không có cha. */
export const PARENT_TIER: Record<ObjectiveTier, ObjectiveTier | null> = {
  business: null,
  marketing: "business",
  communication: "marketing",
};

/**
 * NGUỒN TĂNG TRƯỞNG — thuộc tầng MARKETING, không phải tầng kinh doanh.
 *
 * Đây là bốn mục tiêu marketing của khung IBMC (bài 3.1), thứ Ehrenberg gọi là phép
 * phân rã hành vi mua: doanh số thương hiệu = thâm nhập × tần suất × lượng mỗi lần.
 * Tầng kinh doanh là chuyện khác — Sale, Share, Growth, Profit.
 *
 * Trước đây các giá trị này được khai ở tầng `business`, lệch một tầng so với khung
 * gốc; xem `docs/ly-thuyet/ibmc-doi-chieu-cascade.md` điểm 1.
 *
 * HAI CHỖ CỐ Ý ĐI KHÁC BÀI GIẢNG — đừng "sửa lại cho đúng lý thuyết":
 *
 *  1. Bài 3.3 gộp Choice và Loyalty thành MỘT nguồn (thị phần trong giỏ hàng). Ở đây
 *     tách thành hai, vì với đào tạo *được chọn lúc xét tuyển* và *giữ chân sau khi
 *     nhập học* cách nhau 4–5 năm và dùng nguồn dữ liệu khác nhau.
 *  2. Bài giảng dùng một từ `consumption` cho cả hai nửa. Ở đây giữ đúng tên đó,
 *     nhưng lưu ý nửa đầu (lượng dùng mỗi lần) hiện CHƯA ánh xạ được sang giáo dục
 *     đại học — chỉ nửa sau (giá trị mỗi lần, tức premiumisation) là đo được.
 *
 * Khung gốc sinh ra cho ngành hàng tiêu dùng nhanh; diễn giải lại cho giáo dục
 * đại học — nơi người học "mua" một lần với giá trị rất lớn — như sau:
 */
export const GrowthSourceSchema = z.enum([
  /** Thâm nhập: tỷ lệ thí sinh trong tập cầu đặt ít nhất một nguyện vọng vào Học viện. */
  "penetration",
  /** Tần suất: số lần một người học quay lại Học viện (đại học → sau đại học → ngắn hạn). */
  "frequency",
  /**
   * Lượng tiêu dùng, hai nửa theo bài 3.3:
   * — *consumption volume* (lượng mỗi lần dùng): chưa ánh xạ được, cần dữ liệu nội bộ;
   * — *consumption value* (giá trị mỗi lần): tỷ trọng hệ chất lượng cao và liên kết
   *   quốc tế, tức giá trị vòng đời một người học. Đây là nửa đang đo.
   */
  "consumption",
  /** Lựa chọn: trong tập cân nhắc, thí sinh chọn Học viện ở thứ hạng nào. */
  "choice",
  /** Trung thành: giữ chân người học và mức độ cựu người học giới thiệu lại. */
  "loyalty",
]);
export type GrowthSource = z.infer<typeof GrowthSourceSchema>;

export const GROWTH_SOURCE_LABELS: Record<GrowthSource, string> = {
  penetration: "Thâm nhập",
  frequency: "Tần suất",
  consumption: "Lượng tiêu dùng",
  choice: "Lựa chọn",
  loyalty: "Trung thành",
};

/**
 * Bốn nhóm mục tiêu truyền thông (bài 5.1, 5.2).
 *
 * Lưu ý về bản chất: bốn nhóm này là bốn CHIỀU ĐÁNH GIÁ của mọi chiến dịch, không
 * phải bốn mục tiêu con của bốn mục tiêu marketing khác nhau. Mô hình dữ liệu ở đây
 * chỉ cho mỗi mục tiêu một cha, nên `parentKey` của tầng truyền thông phải đọc là
 * *nhánh chịu ảnh hưởng chính*, KHÔNG phải *phạm vi áp dụng*. Xem
 * `docs/ly-thuyet/ibmc-doi-chieu-cascade.md` điểm 6.
 */
export const CommunicationGoalSchema = z.enum([
  "awareness",
  "attributes",
  "effectiveness",
  "creative",
]);
export type CommunicationGoal = z.infer<typeof CommunicationGoalSchema>;

export const COMMUNICATION_GOAL_LABELS: Record<CommunicationGoal, string> = {
  awareness: "Nhận biết",
  attributes: "Thuộc tính thương hiệu",
  effectiveness: "Hiệu quả truyền thông",
  creative: "Chất lượng sáng tạo",
};

/**
 * Trạng thái của một KPI so với mục tiêu đã đặt.
 *
 * `baseline_pending` không phải lỗi — nhiệm vụ khởi động khi chưa có mùa dữ liệu nào,
 * phần lớn chỉ số phải đo một mùa mới có gốc so sánh. Hiện trạng thái này ra màn hình
 * trung thực hơn là để trống hoặc điền số bịa.
 */
export const KpiStatusSchema = z.enum([
  "on_track",
  "at_risk",
  "off_track",
  "baseline_pending",
]);
export type KpiStatus = z.infer<typeof KpiStatusSchema>;

export const KPI_STATUS_LABELS: Record<KpiStatus, string> = {
  on_track: "Đúng hướng",
  at_risk: "Cần chú ý",
  off_track: "Lệch mục tiêu",
  baseline_pending: "Chờ dữ liệu gốc",
};

/** Nhịp cập nhật của chỉ số — quyết định người xem nên kỳ vọng số mới lúc nào. */
export const KpiCadenceSchema = z.enum(["daily", "weekly", "annual"]);
export type KpiCadence = z.infer<typeof KpiCadenceSchema>;

export const KPI_CADENCE_LABELS: Record<KpiCadence, string> = {
  daily: "Hằng ngày",
  weekly: "Hằng tuần",
  annual: "Hằng năm",
};

/**
 * Xuất xứ dữ liệu của một chỉ số.
 *
 * Bắt buộc với mọi KPI. Hội đồng nghiệm thu phải lần được từ con số trên màn hình
 * về tới văn bản hoặc nguồn công khai sinh ra nó; `legalBasis` ghi căn cứ pháp lý
 * buộc công khai (ví dụ Thông tư 09/2024/TT-BGDĐT) khi có.
 */
/**
 * Nguồn này có phủ NHÓM ĐỐI SÁNH không.
 *
 * Khung IBMC không chạy được mà không có số của đối thủ: thị phần cần mẫu số, tăng
 * trưởng cần mốc ngành, premiumisation cần biết đối thủ định giá thế nào. Trường này
 * nói thẳng mỗi nguồn đang ở đâu trên thang đó — vì một con số thị phần tính trên
 * 2 trong 6 trường trông y hệt một con số tính trên cả 6.
 */
export const BenchmarkCoverageSchema = z.enum([
  /** Đủ cả nhóm đối sánh — tính được thị phần và vị trí. */
  "full",
  /** Mới một phần nhóm — con số so sánh còn sai mẫu số, không được công bố như thật. */
  "partial",
  /** Chỉ có số của Học viện; không có đường lấy số đối thủ từ nguồn này. */
  "us_only",
  /** Chỉ số nội bộ, không tồn tại khái niệm đối thủ. */
  "not_applicable",
]);
export type BenchmarkCoverage = z.infer<typeof BenchmarkCoverageSchema>;

export const BENCHMARK_COVERAGE_LABELS: Record<BenchmarkCoverage, string> = {
  full: "Đủ nhóm đối sánh",
  partial: "Mới một phần nhóm",
  us_only: "Chỉ có số của Học viện",
  not_applicable: "Không có đối thủ",
};

export const DataProvenanceSchema = z.object({
  label: z.string().min(1),
  url: z.url().optional(),
  legalBasis: z.string().optional(),
  /**
   * Mức phủ đối thủ của nguồn này.
   *
   * Để `optional` ở tầng schema vì `brand-share` cũng dùng lại hình dạng này, nhưng
   * MỌI chỉ số trong cascade bắt buộc phải khai — ràng buộc đó nằm ở
   * `kpi-cascade-structure.spec.ts`.
   */
  benchmark: z
    .object({
      coverage: BenchmarkCoverageSchema,
      /** Cụ thể là bao nhiêu trường có số, hoặc vì sao không lấy được. */
      note: z.string().min(1),
    })
    .optional(),
});
export type DataProvenance = z.infer<typeof DataProvenanceSchema>;

/**
 * XUẤT XỨ LÝ THUYẾT của một mục tiêu — song song với xuất xứ dữ liệu.
 *
 * `DataProvenance` trả lời "con số này ở đâu ra". Trường này trả lời câu còn lại,
 * câu mà hội đồng nghiệm thu sẽ hỏi: **căn cứ nào để chọn đo thứ này?**
 *
 * Khung IBMC là bản tổng hợp, không phải nguồn gốc của các lý thuyết thành phần, nên
 * mỗi mục tiêu phải trả được nợ nguồn tới tác giả thật. Xem
 * `docs/ly-thuyet/ibmc-xuat-xu-ly-thuyet.md`.
 */
export const TheoryRefSchema = z.object({
  /** Khái niệm gốc, giữ nguyên thuật ngữ tiếng Anh khi đó là tên chuẩn trong văn liệu. */
  concept: z.string().min(1),
  /** Tác giả hoặc truyền thống nghiên cứu sinh ra khái niệm. */
  origin: z.string().min(1),
  /** Công trình kèm năm, đủ để tra lại. */
  work: z.string().min(1),
  /** Bài trong khoá IBMC, ví dụ "3.3" — để lần về `docs/ly-thuyet/ibmc-nguon/`. */
  lesson: z.string().min(1),
  /**
   * Cảnh báo khi **lý thuyết gốc phản bác bài giảng**, hoặc khi phép dịch sang giáo
   * dục đại học bị lệch. `null` khi không có.
   *
   * Đây là trường quan trọng nhất của cả khối: một khung tổng hợp che mất các tranh
   * luận còn mở trong văn liệu, và người đặt mục tiêu cần biết mình đang đứng ở phía
   * nào của tranh luận đó.
   */
  caveat: z.string().nullable(),
});
export type TheoryRef = z.infer<typeof TheoryRefSchema>;

/**
 * Mức sẵn sàng của nguồn dữ liệu nuôi một chỉ số.
 *
 * Cột "nền tảng và kỹ thuật" trên bảng điều khiển đọc thẳng từ đây. Chỉ số chưa có
 * nguồn không bị giấu đi — nó hiện ra kèm việc còn phải làm, để khoảng trống trở
 * thành hàng đợi công việc chứ không phải chỗ trống vô nghĩa.
 */
export const DataReadinessSchema = z.enum([
  /** Dữ liệu đã chảy về kho, chỉ số tính được. */
  "connected",
  /** Nguồn công khai, mã đã viết, chỉ chờ chạy đủ kỳ để có gốc so sánh. */
  "public_ready",
  /** Nguồn công khai và không cần xin phép, nhưng chưa viết mã thu thập. */
  "needs_build",
  /** Xác định được nguồn nhưng phải xin quyền truy cập trước. */
  "needs_access",
  /** Chưa có phương án thu thập nào. */
  "not_planned",
  /**
   * Con số đang hiện là ƯỚC LƯỢNG theo một công thức đã nêu, KHÔNG phải số đo.
   *
   * Tách thành một mức riêng chứ không mượn `connected`: một con số ước lượng nằm cạnh
   * một con số đo được, cùng kiểu chữ, cùng ô, thì không ai phân biệt nổi — và đó đúng
   * là cách một bảng điều khiển mất uy tín. Mức này buộc chỉ số phải khai `estimateBasis`,
   * và mọi chỗ hiển thị mức sẵn sàng sẽ tự động nói ra.
   */
  "estimated",
]);
export type DataReadiness = z.infer<typeof DataReadinessSchema>;

export const DATA_READINESS_LABELS: Record<DataReadiness, string> = {
  connected: "Đã kết nối",
  public_ready: "Nguồn công khai, chờ chạy đủ kỳ",
  needs_build: "Nguồn công khai, chờ viết mã thu thập",
  needs_access: "Cần xin quyền truy cập",
  not_planned: "Chưa có phương án",
  estimated: "Ước lượng, chưa phải số đo",
};

/** Nền tảng và phần việc kỹ thuật cần có để một chỉ số chạy được. */
export const KpiRequirementSchema = z.object({
  /** Tên nền tảng hoặc hệ thống cấp số. `null` khi chưa xác định được nguồn nào. */
  platform: z.string().nullable(),
  /** Các trường dữ liệu cụ thể phải lấy về. Rỗng khi chưa xác định. */
  fields: z.array(z.string()),
  readiness: DataReadinessSchema,
  /** Việc kỹ thuật còn lại. `null` khi không còn việc gì. */
  todo: z.string().nullable(),
});
export type KpiRequirement = z.infer<typeof KpiRequirementSchema>;

/**
 * Căn cứ so sánh của một chỉ số.
 *
 * `calendar` — so cùng ngày cùng tháng năm trước.
 * `admission_cycle` — so theo mốc của chu kỳ tuyển sinh (ngày mở cổng đăng ký,
 *   ngày công bố điểm thi…), vì lịch tuyển sinh dịch vài tuần mỗi năm.
 */
export const ComparisonBasisSchema = z.enum(["calendar", "admission_cycle"]);
export type ComparisonBasis = z.infer<typeof ComparisonBasisSchema>;

export const COMPARISON_BASIS_LABELS: Record<ComparisonBasis, string> = {
  calendar: "So cùng kỳ theo lịch",
  admission_cycle: "So theo mốc chu kỳ tuyển sinh",
};

/**
 * Điều kiện để con số này SO SÁNH ĐƯỢC giữa hai kỳ.
 *
 * Ra đời sau khi hai chỉ số suýt lên bảng với kết luận ngược hẳn thực tế:
 *
 *   - "Ý định nộp hồ sơ giảm 78%" — thật ra cả năm 2026 đã vượt cả năm 2025.
 *     Nguyên nhân: cổng đăng ký năm 2025 mở tháng 7, năm 2026 mở tháng 5–6, nên
 *     cửa sổ 30 ngày cố định bắt trúng đỉnh của năm này và trượt đỉnh của năm kia.
 *   - "Mất địa bàn tỉnh, 49% còn 14%" — thật ra GA4 hạ độ phân giải địa lý, tỷ lệ
 *     thành phố `(not set)` tăng từ 1,7% lên 24,6%, và phần bị che dồn vào tỉnh nhỏ.
 *
 * Một con số đúng nhưng so sai còn nguy hiểm hơn không có số: nó tạo ra hành động.
 */
/**
 * Căn cứ để đặt ra mức cần đạt.
 *
 * Mục tiêu không có căn cứ thì không tranh luận được, và cũng không sửa được một
 * cách có trách nhiệm — người sau chỉ biết con số chứ không biết vì sao là con số đó.
 */
export const TargetBasisSchema = z.enum([
  /** Mức cao nhất Học viện đã từng đạt trong dữ liệu sẵn có. */
  "historical_peak",
  /** Mức của phân khúc làm tốt nhất ngay trong nội bộ, dùng làm mốc để đuổi theo. */
  "internal_benchmark",
  /** Nền cộng tốc độ thay đổi quan sát được, giả định giữ nguyên đà. */
  "trend_continuation",
  /** Mức tạm do người dựng bảng đề xuất, chờ Học viện phê duyệt. */
  "pending_approval",
]);
export type TargetBasis = z.infer<typeof TargetBasisSchema>;

export const TARGET_BASIS_LABELS: Record<TargetBasis, string> = {
  historical_peak: "Mức cao nhất đã đạt",
  internal_benchmark: "Mốc nội bộ tốt nhất",
  trend_continuation: "Giữ nguyên đà hiện tại",
  pending_approval: "Đề xuất tạm, chờ phê duyệt",
};

export const TargetRationaleSchema = z.object({
  basis: TargetBasisSchema,
  /** Diễn giải cách ra con số, đủ để người khác kiểm lại hoặc phản bác. */
  note: z.string().min(1),
});
export type TargetRationale = z.infer<typeof TargetRationaleSchema>;

export const ComparabilitySchema = z.object({
  basis: ComparisonBasisSchema,
  /** Điều kiện phải thoả để phép so sánh có nghĩa. `null` khi không có ràng buộc nào. */
  caveat: z.string().nullable(),
});
export type Comparability = z.infer<typeof ComparabilitySchema>;

/**
 * Diễn giải chỉ số theo hướng mục tiêu.
 *
 * Bắt buộc, và đây là ràng buộc quan trọng nhất của cả mô hình: một con số thu về
 * từ nền tảng chỉ được lên bảng điều khiển khi nói được rõ ràng chiều nào của nó là
 * tích cực, chiều nào là tiêu cực CHO VIỆC ĐẠT MỤC TIÊU. Không diễn giải được nghĩa
 * là chưa biết đo nó để làm gì.
 */
export const KpiInterpretationSchema = z.object({
  positive: z.string().min(1),
  negative: z.string().min(1),
});
export type KpiInterpretation = z.infer<typeof KpiInterpretationSchema>;

/** Một chỉ số đo lường, luôn gắn với đúng một mục tiêu. */
export const CascadeKpiSchema = z
  .object({
    key: z.string().min(1),
    label: z.string().min(1),
    tier: ObjectiveTierSchema,
    /** Mục tiêu mà chỉ số này đo. Phải tồn tại trong danh sách `objectives`. */
    objectiveKey: z.string().min(1),
    /** `null` khi chưa có mùa dữ liệu nào để tính. */
    value: z.number().nullable(),
    unit: MetricUnitSchema,
    /** Mức cần đạt. `null` khi chưa chốt được mục tiêu định lượng. */
    target: z.number().nullable(),
    /** Mức của kỳ gốc dùng để so sánh. */
    baseline: z.number().nullable(),
    higherIsBetter: z.boolean(),
    status: KpiStatusSchema,
    cadence: KpiCadenceSchema,
    provenance: DataProvenanceSchema,
    requirement: KpiRequirementSchema,
    interpretation: KpiInterpretationSchema,
    /**
     * Bắt buộc với chỉ số có `baseline`. Có mốc so sánh mà không nói rõ so kiểu gì
     * là chỗ sinh ra kết luận ngược — xem ghi chú ở `ComparabilitySchema`.
     */
    comparability: ComparabilitySchema.optional(),
    /**
     * Công thức hoặc căn cứ của con số ước lượng. BẮT BUỘC khi `readiness = estimated`,
     * và phải là `null` ở mọi mức khác.
     *
     * Bắt buộc vì một ước lượng không nêu được cách tính thì không khác gì một con số
     * bịa: người đọc sau không kiểm lại được, không tranh luận được, và không biết nó
     * sai lệch bao nhiêu.
     */
    estimateBasis: z.string().min(1).nullable().default(null),
    /**
     * Bắt buộc với chỉ số có `target`. Một mức cần đạt không nêu được căn cứ thì
     * không ai dám sửa, mà cũng không ai dám tin.
     */
    targetRationale: TargetRationaleSchema.optional(),
    hint: z.string().optional(),
  })
  .superRefine((kpi, ctx) => {
    // Trạng thái không được khai bằng tay lệch khỏi quy tắc chung. Đây là chỗ dễ trôi
    // nhất khi ghép dữ liệu thật với dữ liệu giả lập: một chỉ số hụt mục tiêu vẫn có
    // thể bị gắn nhãn "đúng hướng" nếu để người viết tự điền.
    const expected = evaluateStatus(kpi.value, kpi.target, kpi.higherIsBetter);
    if (kpi.status !== expected) {
      ctx.addIssue({
        code: "custom",
        path: ["status"],
        message: `KPI ${kpi.key}: trạng thái phải là '${expected}' theo giá trị và mục tiêu hiện có, đang khai '${kpi.status}'.`,
      });
    }

    // Không thể có số nếu chưa lấy được dữ liệu từ đâu. Ràng buộc này chặn đúng cái
    // lỗi nguy hiểm nhất của một dashboard: một con số trông có vẻ thật nhưng thực ra
    // do người ta điền vào cho đỡ trống.
    const coNguon =
      kpi.requirement.readiness === "connected" ||
      kpi.requirement.readiness === "public_ready" ||
      kpi.requirement.readiness === "estimated";
    if (kpi.value !== null && !coNguon) {
      ctx.addIssue({
        code: "custom",
        path: ["requirement", "readiness"],
        message: `KPI ${kpi.key}: có giá trị nhưng nguồn dữ liệu đang ở mức '${kpi.requirement.readiness}' — số này lấy từ đâu ra?`,
      });
    }

    // Có mốc so sánh thì phải nói rõ so kiểu gì. Lịch tuyển sinh dịch vài tuần mỗi
    // năm, nên một phép so cùng ngày cùng tháng có thể bắt trúng đỉnh của năm này và
    // trượt đỉnh của năm kia — ra kết luận ngược hẳn thực tế.
    if (kpi.baseline !== null && !kpi.comparability) {
      ctx.addIssue({
        code: "custom",
        path: ["comparability"],
        message: `KPI ${kpi.key}: có mốc so sánh nhưng chưa khai căn cứ so sánh. Xem ComparabilitySchema.`,
      });
    }

    // Ước lượng phải nêu cách tính, và chỉ ước lượng mới được nêu. Thiếu chiều thứ hai
    // thì một chỉ số đo thật vẫn có thể mang chú thích "ước lượng" và gieo nghi ngờ sai chỗ.
    const laUocLuong = kpi.requirement.readiness === "estimated";
    if (laUocLuong && kpi.estimateBasis === null) {
      ctx.addIssue({
        code: "custom",
        path: ["estimateBasis"],
        message: `KPI ${kpi.key}: là ước lượng nhưng chưa nêu công thức hay căn cứ.`,
      });
    }
    if (!laUocLuong && kpi.estimateBasis !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["estimateBasis"],
        message: `KPI ${kpi.key}: nêu căn cứ ước lượng nhưng mức sẵn sàng là '${kpi.requirement.readiness}', không phải 'estimated'.`,
      });
    }

    // Chỉ siết với dữ liệu thật. Chỉ số còn chờ nguồn thì mức cần đạt
    // vẫn đang là dự kiến, chưa đến lúc đòi căn cứ.
    if (
      kpi.requirement.readiness === "connected" &&
      kpi.target !== null &&
      !kpi.targetRationale
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["targetRationale"],
        message: `KPI ${kpi.key}: đã có dữ liệu thật và có mức cần đạt, nhưng chưa nêu căn cứ đặt mức đó.`,
      });
    }
  });
export type CascadeKpi = z.infer<typeof CascadeKpiSchema>;

/** Một mục tiêu trong cascade. */
export const ObjectiveSchema = z.object({
  key: z.string().min(1),
  tier: ObjectiveTierSchema,
  /**
   * Tên ngắn — một tới ba từ, đủ nhét vừa một ô bảng hoặc một nhãn biểu đồ.
   *
   * Đây là tên của mục tiêu trong khung IBMC (Doanh số, Thị phần, Thâm nhập, Nhận
   * biết…). Nằm trong hợp đồng dữ liệu chứ không phải trong từng component: trước đây
   * mỗi chỗ cần tên ngắn lại tự viết một bảng ánh xạ khoá → tên, và những bảng đó im
   * lặng lệch đi khi cây mục tiêu đổi.
   */
  shortName: z.string().min(1),
  /** Phát biểu mục tiêu bằng tiếng Việt, đủ để đọc lên trong cuộc họp. */
  statement: z.string().min(1),
  /** Vì sao mục tiêu này tồn tại — hiện ra khi người xem hỏi "để làm gì". */
  rationale: z.string().min(1),
  /**
   * Khái niệm gốc mà mục tiêu này hiện thực hoá, và tác giả của nó. BẮT BUỘC.
   *
   * Bắt buộc vì cùng một lý do `provenance` bắt buộc với chỉ số: một mục tiêu không
   * nêu được căn cứ lý thuyết thì không tranh luận được, và rất dễ là mục tiêu đặt ra
   * vì có dữ liệu chứ không vì có lý do.
   */
  theory: TheoryRefSchema,
  /** Chỉ có ở tầng marketing — nguồn tăng trưởng mà mục tiêu này khai thác. */
  growthSource: GrowthSourceSchema.nullable(),
  /** Chỉ có ở tầng truyền thông. */
  communicationGoal: CommunicationGoalSchema.nullable(),
  /**
   * Mục tiêu tầng trên mà mục tiêu này phục vụ. `null` ở tầng kinh doanh.
   *
   * Ở tầng truyền thông, đây là *nhánh chịu ảnh hưởng chính*, không phải phạm vi áp
   * dụng duy nhất — xem ghi chú ở `CommunicationGoalSchema`.
   */
  parentKey: z.string().nullable(),
  /** Đánh dấu trọng tâm của kỳ — dùng để làm nổi trên giao diện. Tối đa một cái mỗi tầng. */
  isFocus: z.boolean(),
});
export type Objective = z.infer<typeof ObjectiveSchema>;

/**
 * Toàn bộ cascade của một kỳ báo cáo.
 *
 * Phần kiểm tra bên dưới là lý do schema này tồn tại: nó bảo đảm cây mục tiêu
 * luôn liền mạch trước khi bất kỳ pixel nào được vẽ.
 */
export const KpiCascadeResponseSchema = z
  .object({
    period: PeriodSchema,
    updatedAt: z.string(),
    objectives: z.array(ObjectiveSchema).min(1),
    kpis: z.array(CascadeKpiSchema).min(1),
  })
  .superRefine((data, ctx) => {
    const objectiveByKey = new Map(data.objectives.map((o) => [o.key, o]));

    if (objectiveByKey.size !== data.objectives.length) {
      ctx.addIssue({
        code: "custom",
        path: ["objectives"],
        message: "Có mục tiêu bị trùng key.",
      });
    }

    data.objectives.forEach((objective, index) => {
      const expectedParentTier = PARENT_TIER[objective.tier];

      if (expectedParentTier === null) {
        if (objective.parentKey !== null) {
          ctx.addIssue({
            code: "custom",
            path: ["objectives", index, "parentKey"],
            message: `Mục tiêu ${objective.key} ở tầng kinh doanh nên không được có mục tiêu cha.`,
          });
        }
      } else {
        const parent =
          objective.parentKey === null
            ? undefined
            : objectiveByKey.get(objective.parentKey);
        if (!parent) {
          ctx.addIssue({
            code: "custom",
            path: ["objectives", index, "parentKey"],
            message: `Mục tiêu ${objective.key} phải trỏ về một mục tiêu tầng ${OBJECTIVE_TIER_LABELS[expectedParentTier].toLowerCase()}.`,
          });
        } else if (parent.tier !== expectedParentTier) {
          ctx.addIssue({
            code: "custom",
            path: ["objectives", index, "parentKey"],
            message: `Mục tiêu ${objective.key} đang trỏ về tầng ${parent.tier}, phải là ${expectedParentTier}.`,
          });
        }
      }

      // `growthSource` chỉ có nghĩa ở tầng MARKETING — nguồn tăng trưởng là mục tiêu
      // marketing (bài 3.1), không phải mục tiêu kinh doanh. `communicationGoal` chỉ ở
      // tầng truyền thông. Gắn nhầm tầng là dấu hiệu cascade đã bị hiểu sai.
      if (
        (objective.tier === "marketing") !==
        (objective.growthSource !== null)
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["objectives", index, "growthSource"],
          message: `Mục tiêu ${objective.key}: nguồn tăng trưởng chỉ được khai ở tầng marketing, và tầng marketing bắt buộc phải khai.`,
        });
      }
      if (
        (objective.tier === "communication") !==
        (objective.communicationGoal !== null)
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["objectives", index, "communicationGoal"],
          message: `Mục tiêu ${objective.key}: nhóm mục tiêu truyền thông chỉ được khai ở tầng truyền thông, và tầng truyền thông bắt buộc phải khai.`,
        });
      }
    });

    // Mỗi tầng nhiều nhất một trọng tâm — nếu mọi thứ đều là trọng tâm thì không có
    // trọng tâm nào, và giao diện mất khả năng dẫn mắt người xem.
    ObjectiveTierSchema.options.forEach((tier) => {
      const focused = data.objectives.filter(
        (o) => o.tier === tier && o.isFocus,
      );
      if (focused.length > 1) {
        ctx.addIssue({
          code: "custom",
          path: ["objectives"],
          message: `Tầng ${tier} có ${focused.length} mục tiêu trọng tâm, chỉ được nhiều nhất 1.`,
        });
      }
    });

    const kpiKeys = new Set<string>();
    data.kpis.forEach((kpi, index) => {
      if (kpiKeys.has(kpi.key)) {
        ctx.addIssue({
          code: "custom",
          path: ["kpis", index, "key"],
          message: `KPI ${kpi.key} bị khai trùng.`,
        });
      }
      kpiKeys.add(kpi.key);

      const objective = objectiveByKey.get(kpi.objectiveKey);
      if (!objective) {
        ctx.addIssue({
          code: "custom",
          path: ["kpis", index, "objectiveKey"],
          message: `KPI ${kpi.key} trỏ về mục tiêu không tồn tại: ${kpi.objectiveKey}.`,
        });
        return;
      }
      if (objective.tier !== kpi.tier) {
        ctx.addIssue({
          code: "custom",
          path: ["kpis", index, "tier"],
          message: `KPI ${kpi.key} khai tầng ${kpi.tier} nhưng mục tiêu ${objective.key} thuộc tầng ${objective.tier}.`,
        });
      }
    });

    // Mục tiêu không có chỉ số nào đo được là mục tiêu không kiểm chứng được.
    const measured = new Set(data.kpis.map((k) => k.objectiveKey));
    data.objectives.forEach((objective, index) => {
      if (!measured.has(objective.key)) {
        ctx.addIssue({
          code: "custom",
          path: ["objectives", index],
          message: `Mục tiêu ${objective.key} chưa có KPI nào đo — không đưa lên dashboard được.`,
        });
      }
    });
  });
export type KpiCascadeResponse = z.infer<typeof KpiCascadeResponseSchema>;

/** Ngưỡng phân loại trạng thái, tính theo tỷ lệ hoàn thành mục tiêu. */
const ON_TRACK_RATIO = 0.95;
const AT_RISK_RATIO = 0.85;

/**
 * Tỷ lệ hoàn thành mục tiêu của một chỉ số. `null` khi chưa đủ dữ liệu để tính.
 *
 * Với chỉ số càng thấp càng tốt (tỷ lệ thôi học, chi phí), tỷ lệ được đảo lại:
 * vượt mục tiêu nghĩa là thấp hơn mục tiêu.
 */
export function completionRatio(
  value: number | null,
  target: number | null,
  higherIsBetter: boolean,
): number | null {
  if (value === null || target === null) {
    return null;
  }

  const ratio = higherIsBetter
    ? value / target
    : // Mục tiêu bằng 0 với chỉ số càng thấp càng tốt: chỉ đạt khi giá trị cũng bằng 0.
      target === 0
      ? value === 0
        ? 1
        : 0
      : target / value;

  return Number.isFinite(ratio) ? ratio : null;
}

/**
 * Suy ra trạng thái của một chỉ số từ giá trị và mục tiêu.
 *
 * Đặt ở đây thay vì ở tầng giao diện để backend, frontend và test dùng chung đúng
 * một cách tính — trạng thái hiển thị không bao giờ lệch khỏi quy tắc đã thống nhất.
 */
export function evaluateStatus(
  value: number | null,
  target: number | null,
  higherIsBetter: boolean,
): KpiStatus {
  const ratio = completionRatio(value, target, higherIsBetter);

  if (ratio === null) {
    return "baseline_pending";
  }
  if (ratio >= ON_TRACK_RATIO) {
    return "on_track";
  }
  if (ratio >= AT_RISK_RATIO) {
    return "at_risk";
  }
  return "off_track";
}

/** Gom KPI theo mục tiêu. Dùng chung cho cả giao diện lẫn test. */
export function kpisByObjective(
  cascade: KpiCascadeResponse,
): Map<string, CascadeKpi[]> {
  const grouped = new Map<string, CascadeKpi[]>();
  for (const kpi of cascade.kpis) {
    const current = grouped.get(kpi.objectiveKey);
    if (current) {
      current.push(kpi);
    } else {
      grouped.set(kpi.objectiveKey, [kpi]);
    }
  }
  return grouped;
}

/** Chuỗi mục tiêu từ tầng truyền thông ngược lên tầng kinh doanh. */
export function objectiveChain(
  cascade: KpiCascadeResponse,
  objectiveKey: string,
): Objective[] {
  const byKey = new Map(cascade.objectives.map((o) => [o.key, o]));
  const chain: Objective[] = [];
  let current = byKey.get(objectiveKey);
  while (current) {
    chain.unshift(current);
    current = current.parentKey ? byKey.get(current.parentKey) : undefined;
  }
  return chain;
}
