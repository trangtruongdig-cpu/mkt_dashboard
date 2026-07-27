import type { Brand, ShareOfSearchResponse } from "../schemas/brand-share";
import type { MetricUnit, Period } from "../schemas/common";
import {
  evaluateStatus,
  type CascadeKpi,
  type Comparability,
  type DataProvenance,
  type KpiCadence,
  type KpiCascadeResponse,
  type KpiInterpretation,
  type KpiRequirement,
  type Objective,
  type ObjectiveTier,
  type TargetRationale,
} from "../schemas/kpi-cascade";
import { buildWeekStarts, formatVnDate, hashString, seeded } from "./random";

/**
 * CASCADE MỤC TIÊU CỦA HỌC VIỆN — bản dùng cho giai đoạn demo giao diện.
 *
 * Cần phân biệt hai thứ trong file này:
 *
 *  - CẤU TRÚC và MỤC TIÊU (`target`) là quyết định thật, suy ra từ số liệu công bố
 *    (chỉ tiêu tuyển sinh, học phí, quy mô ngành) và từ chẩn đoán nguồn tăng trưởng.
 *    Sửa những con số này là sửa cam kết, không phải sửa dữ liệu mẫu.
 *
 *  - GIÁ TRỊ HIỆN TẠI (`value`) phần lớn còn là `null` vì các job thu thập chưa chạy
 *    đủ một mùa. Chỉ số nào chưa có gốc so sánh thì để `null` và hiện trạng thái
 *    "chờ dữ liệu gốc" — không điền số bịa cho đẹp màn hình.
 *
 * Chẩn đoán nền: chỉ tiêu tuyển sinh tăng từ 3.820 (2022) lên khoảng 8.000 (2026),
 * gấp 2,09 lần trong 4 năm, trong khi quy mô giáo dục đại học cả nước chỉ tăng
 * khoảng 6,5%/năm. Tăng trưởng bằng mở rộng chỉ tiêu và tăng học phí đang tới trần,
 * nên trọng tâm kỳ này chuyển sang nguồn "Lựa chọn".
 */

const WEEKS = 12;

/** Nhóm trường đối sánh — cố định để mọi chỉ số thị phần cùng một mẫu số. */
export const BENCHMARK_BRANDS: readonly Brand[] = [
  {
    key: "ptit",
    label: "Học viện Công nghệ Bưu chính Viễn thông",
    isUs: true,
  },
  { key: "hust", label: "Đại học Bách khoa Hà Nội", isUs: false },
  { key: "uet", label: "Trường ĐH Công nghệ (ĐHQGHN)", isUs: false },
  { key: "uit", label: "Trường ĐH Công nghệ Thông tin (ĐHQG-HCM)", isUs: false },
  { key: "fpt", label: "Trường Đại học FPT", isUs: false },
  { key: "actvn", label: "Học viện Kỹ thuật Mật mã", isUs: false },
] as const;

/** Mức quan tâm nền của từng thương hiệu, dùng để sinh chuỗi giả lập. */
const BASE_INTEREST: Record<string, number> = {
  hust: 30,
  ptit: 19,
  fpt: 17,
  uit: 13,
  uet: 12,
  actvn: 6,
};

const SOURCE_PUBLIC_DISCLOSURE: DataProvenance = {
  label: "Biểu mẫu công khai của cơ sở giáo dục đại học (Biểu 18)",
  legalBasis: "Thông tư 09/2024/TT-BGDĐT",
};

const SOURCE_ADMISSION_SCHEME: DataProvenance = {
  label: "Đề án tuyển sinh công bố hằng năm của Học viện và nhóm đối sánh",
  legalBasis: "Thông tư 08/2022/TT-BGDĐT, Điều 11",
};

const SOURCE_ACADEMY_ANNOUNCEMENT: DataProvenance = {
  label: "Thông báo tuyển sinh đại học chính quy của Học viện",
  url: "https://tuyensinh.ptit.edu.vn/",
};

const SOURCE_TRENDS: DataProvenance = {
  label: "Google Trends — chỉ số quan tâm tìm kiếm, công khai và miễn phí",
  url: "https://trends.google.com/",
};

/**
 * Nguồn thay thế cho Google Trends.
 *
 * Google không có API chính thức cho Trends và đang chặn truy cập (HTTP 429), nên tầng
 * "Nhận biết" có nguy cơ không còn chỉ số nào chạy được. Wikimedia thì ngược lại: API
 * chính thức, có tài liệu, không cần đăng nhập.
 *
 * Đánh đổi phải nói rõ: lượt xem Wikipedia KHÔNG tương đương lượt tìm kiếm. Nó đo nhóm
 * công chúng chịu khó tra cứu — hẹp hơn và thiên về người đã biết tên trường. Bù lại nó
 * là số đếm tuyệt đối nên so sánh trực tiếp giữa các trường và giữa các năm được.
 */
const SOURCE_WIKIPEDIA: DataProvenance = {
  label:
    "Wikimedia Pageviews API — lượt xem trang của 6 trường trên Wikipedia tiếng Việt, agent=user (đã loại bot)",
  url: "https://wikimedia.org/api/rest_v1/",
};

const SOURCE_NEWS_CRAWLER: DataProvenance = {
  label: "Kho tin bài do worker thu thập, chấm sắc thái bằng PhoBERT",
};

const SOURCE_PLATFORM_RESEARCH_API: DataProvenance = {
  label:
    "Cần quyền truy cập nghiên cứu của nền tảng (Meta Content Library, TikTok Research API) — chưa đăng ký",
};

/**
 * Nguồn duy nhất hiện đã chảy thật. Số liệu do chính hệ thống của Học viện đo,
 * không phải suy đoán từ bên ngoài, nên đây là nhóm chỉ số đáng tin nhất trên bảng.
 */
const SOURCE_GA4: DataProvenance = {
  label:
    "Google Analytics 4 — Data API, property “Portal chính” (ID 464491273), phủ toàn bộ multisite ptit.edu.vn",
  legalBasis:
    "Dữ liệu đo trên hệ thống của Học viện, truy cập bằng tài khoản được cấp quyền xem.",
};

/** Danh sách mục tiêu. Thứ tự trong mảng là thứ tự hiển thị trong mỗi tầng. */
const OBJECTIVES: readonly Objective[] = [
  // ── Tầng kinh doanh ────────────────────────────────────────────────────────
  {
    key: "biz_choice",
    tier: "business",
    statement:
      "Trở thành lựa chọn ưu tiên của thí sinh trong nhóm trường kỹ thuật – công nghệ",
    rationale:
      "Chỉ tiêu đã tăng gấp 2,09 lần trong 4 năm trong khi quy mô ngành chỉ tăng khoảng 6,5%/năm, và đỉnh điểm chuẩn bào mòn dần. Dư địa tăng trưởng bằng mở rộng chỉ tiêu sắp hết, nguồn tiếp theo phải đến từ việc thí sinh chủ động chọn Học viện.",
    growthSource: "choice",
    communicationGoal: null,
    parentKey: null,
    isFocus: true,
  },
  {
    key: "biz_penetration",
    tier: "business",
    statement:
      "Mở rộng tập thí sinh cân nhắc Học viện ra ngoài lõi Hà Nội – TP. Hồ Chí Minh",
    rationale:
      "Mùa 2026 có 154.016 thí sinh đăng ký lĩnh vực máy tính và công nghệ thông tin. Đây là tập cầu có sẵn, bài toán là giành phần trong đó chứ không phải tạo thêm nhu cầu.",
    growthSource: "penetration",
    communicationGoal: null,
    parentKey: null,
    isFocus: false,
  },
  {
    key: "biz_volume",
    tier: "business",
    statement: "Nâng tỷ trọng tuyển sinh các hệ đào tạo giá trị cao",
    rationale:
      "Học phí hệ đại trà bị chặn bởi trần tăng 15%/năm. Dịch cơ cấu sang hệ chất lượng cao và liên kết quốc tế là đòn bẩy giá trị còn dư địa.",
    growthSource: "volume",
    communicationGoal: null,
    parentKey: null,
    isFocus: false,
  },
  {
    key: "biz_loyalty",
    tier: "business",
    statement:
      "Giữ chân người học và biến cựu người học thành kênh tuyển sinh",
    rationale:
      "Tỷ lệ thôi học và tỷ lệ có việc làm là hai chỉ số buộc phải công khai, đồng thời là bằng chứng thuyết phục nhất cho thuộc tính thương hiệu.",
    growthSource: "loyalty",
    communicationGoal: null,
    parentKey: null,
    isFocus: false,
  },
  {
    key: "biz_frequency",
    tier: "business",
    statement:
      "Xây đường ống học tiếp: đại học → sau đại học → đào tạo ngắn hạn",
    rationale:
      "Người học đại học chỉ 'mua' một lần. Nguồn tăng trưởng theo tần suất chỉ mở ra khi họ quay lại học bậc cao hơn hoặc học khoá ngắn hạn tại Học viện.",
    growthSource: "frequency",
    communicationGoal: null,
    parentKey: null,
    isFocus: false,
  },

  // ── Tầng marketing ─────────────────────────────────────────────────────────
  {
    key: "mkt_consideration",
    tier: "marketing",
    statement:
      "Tăng mức độ được cân nhắc của Học viện so với năm trường đối sánh",
    rationale:
      "Thí sinh xếp nguyện vọng theo thứ tự. Muốn được chọn thì trước hết phải nằm trong tập cân nhắc, và phải nằm ở vị trí cao trong tập đó.",
    growthSource: null,
    communicationGoal: null,
    parentKey: "biz_choice",
    isFocus: true,
  },
  {
    key: "mkt_new_segments",
    tier: "marketing",
    statement: "Phủ nhóm ngành mới và địa bàn ngoài lõi",
    rationale:
      "Các ngành mở năm 2026 chưa có thương hiệu nào sở hữu trong tâm trí thí sinh. Đây là khoảng trống thâm nhập rẻ nhất.",
    growthSource: null,
    communicationGoal: null,
    parentKey: "biz_penetration",
    isFocus: false,
  },
  {
    key: "mkt_value_mix",
    tier: "marketing",
    statement:
      "Truyền thông giá trị của hệ chất lượng cao và liên kết quốc tế",
    rationale:
      "Không truyền thông được chênh lệch giá trị thì chênh lệch học phí trở thành rào cản thay vì tín hiệu chất lượng.",
    growthSource: null,
    communicationGoal: null,
    parentKey: "biz_volume",
    isFocus: false,
  },
  {
    key: "mkt_advocacy",
    tier: "marketing",
    statement:
      "Biến người học và cựu người học thành nguồn lan toả tự nhiên",
    rationale:
      "Không có ngân sách quảng cáo trong tay, kênh khả thi nhất là tiếng nói của chính cộng đồng người học.",
    growthSource: null,
    communicationGoal: null,
    parentKey: "biz_loyalty",
    isFocus: false,
  },

  // ── Tầng truyền thông ──────────────────────────────────────────────────────
  {
    key: "com_awareness",
    tier: "communication",
    statement:
      "Nâng mức độ nhận biết chủ động khi thí sinh nghĩ tới việc học công nghệ thông tin",
    rationale:
      "Thị phần tìm kiếm biến động theo tuần trong khi kết quả tuyển sinh mỗi năm mới có một lần — đây là tín hiệu sớm duy nhất lấy được miễn phí.",
    growthSource: null,
    communicationGoal: "awareness",
    parentKey: "mkt_consideration",
    isFocus: true,
  },
  {
    key: "com_attributes",
    tier: "communication",
    statement:
      "Gắn Học viện với ba thuộc tính: trọng điểm quốc gia, gắn với doanh nghiệp, ra trường có việc làm",
    rationale:
      "Được nhắc tới nhiều mà không gắn thuộc tính nào thì không tạo ra lý do để chọn.",
    growthSource: null,
    communicationGoal: "attributes",
    parentKey: "mkt_consideration",
    isFocus: false,
  },
  {
    key: "com_effectiveness",
    tier: "communication",
    statement: "Mở rộng độ phủ báo chí sang các đầu báo ngoài nhóm quen thuộc",
    rationale:
      "Không đo được tần suất tiếp cận vì không có tài khoản quảng cáo, nên thay bằng độ rộng nguồn đưa tin — thứ quan sát được từ bên ngoài.",
    growthSource: null,
    communicationGoal: "effectiveness",
    parentKey: "mkt_new_segments",
    isFocus: false,
  },
  {
    key: "com_creative",
    tier: "communication",
    statement: "Nội dung tự giữ được người xem mà không cần chi tiền phân phối",
    rationale:
      "Chưa đo được vì cần quyền truy cập nghiên cứu của nền tảng. Giữ mục tiêu này trong cascade để không quên rằng chất lượng sáng tạo là một tầng riêng.",
    growthSource: null,
    communicationGoal: "creative",
    parentKey: "mkt_advocacy",
    isFocus: false,
  },
] as const;

interface KpiSpec {
  key: string;
  label: string;
  objectiveKey: string;
  tier: ObjectiveTier;
  value: number | null;
  unit: MetricUnit;
  target: number | null;
  baseline: number | null;
  higherIsBetter: boolean;
  cadence: KpiCadence;
  provenance: DataProvenance;
  comparability?: Comparability;
  targetRationale?: TargetRationale;
  hint?: string;
}

/**
 * Bộ chỉ số. `status` không có mặt ở đây một cách cố ý — nó được suy ra bằng
 * `evaluateStatus` để không ai gắn nhãn "đúng hướng" cho một chỉ số đang hụt mục tiêu.
 */
const KPI_SPECS: readonly KpiSpec[] = [
  // ── Kinh doanh ─────────────────────────────────────────────────────────────
  {
    key: "enrolment_vs_quota",
    label: "Tỷ lệ nhập học trên chỉ tiêu",
    objectiveKey: "biz_choice",
    tier: "business",
    value: null,
    unit: "percent",
    target: 90,
    baseline: null,
    higherIsBetter: true,
    cadence: "annual",
    provenance: SOURCE_PUBLIC_DISCLOSURE,
    hint: "Thước đo trực tiếp nhất của nguồn tăng trưởng Lựa chọn: trúng tuyển rồi có thực sự nhập học không.",
  },
  {
    key: "score_premium",
    label: "Chênh lệch điểm chuẩn so với nhóm đối sánh",
    objectiveKey: "biz_choice",
    tier: "business",
    value: null,
    unit: "score",
    target: 0.5,
    baseline: null,
    higherIsBetter: true,
    cadence: "annual",
    provenance: SOURCE_ADMISSION_SCHEME,
    hint: "Thí sinh sẵn sàng đánh đổi bao nhiêu điểm để vào Học viện thay vì trường khác.",
  },
  {
    key: "admission_quota",
    label: "Chỉ tiêu tuyển sinh đại học chính quy",
    objectiveKey: "biz_penetration",
    tier: "business",
    value: 8000,
    unit: "count",
    target: 9000,
    baseline: 6680,
    higherIsBetter: true,
    cadence: "annual",
    provenance: SOURCE_ACADEMY_ANNOUNCEMENT,
    comparability: {
      basis: "admission_cycle",
      caveat:
        "So theo năm tuyển sinh, không theo năm dương lịch — chỉ tiêu công bố cho mùa nào thì tính vào mùa đó.",
    },
    hint: "Doanh số sản lượng. Mốc 2026 là con số công bố, mục tiêu 2027 chờ Học viện phê duyệt.",
  },
  {
    key: "enrolment_share",
    label: "Thị phần nhập học trong nhóm đối sánh",
    objectiveKey: "biz_penetration",
    tier: "business",
    value: null,
    unit: "percent",
    target: 11,
    baseline: null,
    higherIsBetter: true,
    cadence: "annual",
    provenance: SOURCE_PUBLIC_DISCLOSURE,
  },
  {
    key: "tuition_revenue",
    label: "Doanh thu học phí đại học chính quy",
    objectiveKey: "biz_volume",
    tier: "business",
    value: 857_000_000_000,
    unit: "currency",
    target: 1_150_000_000_000,
    baseline: null,
    higherIsBetter: true,
    cadence: "annual",
    provenance: {
      label:
        "Ước tính từ chỉ tiêu và học phí công bố; sẽ thay bằng số quyết toán khi bóc được tài liệu Ba công khai",
      legalBasis: "Thông tư 09/2024/TT-BGDĐT",
    },
    hint: "Doanh số giá trị. Đây là con số ƯỚC TÍNH theo mô hình khoá học, chưa phải số quyết toán.",
  },
  {
    key: "high_value_mix",
    label: "Tỷ trọng nhập học hệ giá trị cao",
    objectiveKey: "biz_volume",
    tier: "business",
    value: null,
    unit: "percent",
    target: 35,
    baseline: null,
    higherIsBetter: true,
    cadence: "annual",
    provenance: SOURCE_ADMISSION_SCHEME,
    hint: "Gồm chất lượng cao, tiên tiến và liên kết quốc tế.",
  },
  {
    key: "dropout_rate",
    label: "Tỷ lệ thôi học",
    objectiveKey: "biz_loyalty",
    tier: "business",
    value: null,
    unit: "percent",
    target: 4,
    baseline: null,
    higherIsBetter: false,
    cadence: "annual",
    provenance: SOURCE_PUBLIC_DISCLOSURE,
    hint: "Càng thấp càng tốt.",
  },
  {
    key: "employment_rate",
    label: "Tỷ lệ có việc làm trong 12 tháng sau tốt nghiệp",
    objectiveKey: "biz_loyalty",
    tier: "business",
    value: null,
    unit: "percent",
    target: 95,
    baseline: null,
    higherIsBetter: true,
    cadence: "annual",
    provenance: SOURCE_PUBLIC_DISCLOSURE,
  },
  {
    key: "postgrad_intake_share",
    label: "Tỷ lệ nhập học sau đại học trên nhập học đại học",
    objectiveKey: "biz_frequency",
    tier: "business",
    value: null,
    unit: "percent",
    target: 12,
    baseline: null,
    higherIsBetter: true,
    cadence: "annual",
    provenance: SOURCE_PUBLIC_DISCLOSURE,
  },

  // ── Marketing ──────────────────────────────────────────────────────────────
  {
    key: "share_of_search",
    label: "Thị phần tìm kiếm",
    objectiveKey: "mkt_consideration",
    tier: "marketing",
    // Google chặn ở mọi lần thử nên chỉ số này KHÔNG có số liệu, dù mã đã viết xong.
    // Để nguyên một con số ở đây là đúng cái bẫy mà ràng buộc "có giá trị thì phải có
    // nguồn chạy được" trong CascadeKpiSchema sinh ra để chặn.
    value: null,
    unit: "percent",
    target: 22,
    baseline: null,
    higherIsBetter: true,
    cadence: "weekly",
    provenance: SOURCE_TRENDS,
    comparability: {
      basis: "calendar",
      caveat:
        "Là tỷ trọng trong nhóm đối sánh nên mùa vụ tác động lên mọi thương hiệu như nhau và triệt tiêu phần lớn.",
    },
    hint: "Chỉ số chạy được ngay: không cần tài khoản quảng cáo, không cần dữ liệu nội bộ.",
  },
  {
    key: "attention_share",
    label: "Thị phần chú ý (lượt xem Wikipedia)",
    objectiveKey: "mkt_consideration",
    tier: "marketing",
    // Số liệu đã nằm trong kho (156 dòng, 26 tuần × 6 trường) nhưng chưa có đường dbt
    // đưa lên API. Thu thập xong không đồng nghĩa với hiển thị được.
    value: null,
    unit: "percent",
    target: 15,
    baseline: null,
    higherIsBetter: true,
    cadence: "weekly",
    provenance: SOURCE_WIKIPEDIA,
    comparability: {
      basis: "calendar",
      caveat:
        "Là tỷ trọng trong nhóm đối sánh nên mùa vụ tác động lên mọi trường như nhau và triệt tiêu phần lớn. Chỉ tính các tuần trọn vẹn 7 ngày mà cả sáu trường đều có dữ liệu.",
    },
    targetRationale: {
      basis: "pending_approval",
      note: "Nhóm đối sánh có 6 trường nên chia đều là 16,7%. Đặt 15% — ngay dưới mức ngang bằng — làm mốc tối thiểu, chờ Học viện chốt lại khi có mùa dữ liệu đầu tiên.",
    },
    hint: "Nguồn thay thế cho Google Trends đang bị chặn. Đo nhóm công chúng chịu khó tra cứu — hẹp hơn lượt tìm kiếm nhưng là số đếm tuyệt đối nên so sánh được giữa các năm.",
  },
  {
    key: "share_of_voice",
    label: "Thị phần thảo luận trên báo chí",
    objectiveKey: "mkt_consideration",
    tier: "marketing",
    // Crawler mới phủ tin bài về Học viện, chưa phủ đủ 6 thương hiệu nên chưa có
    // mẫu số để chia thị phần.
    value: null,
    unit: "percent",
    target: 25,
    baseline: null,
    higherIsBetter: true,
    cadence: "daily",
    provenance: SOURCE_NEWS_CRAWLER,
  },
  {
    key: "new_program_share",
    label: "Tỷ trọng tin bài nhắc nhóm ngành mới",
    objectiveKey: "mkt_new_segments",
    tier: "marketing",
    // Chưa bổ sung bộ từ khoá nhóm ngành mới vào cấu hình crawler.
    value: null,
    unit: "percent",
    target: 15,
    baseline: null,
    higherIsBetter: true,
    cadence: "daily",
    provenance: SOURCE_NEWS_CRAWLER,
    hint: "Bán dẫn, UAV và robot tự hành, logistics tầm thấp, phân tích dữ liệu tài chính.",
  },
  {
    key: "value_program_share",
    label: "Tỷ trọng tin bài nhắc hệ chất lượng cao và liên kết quốc tế",
    objectiveKey: "mkt_value_mix",
    tier: "marketing",
    value: null,
    unit: "percent",
    target: 12,
    baseline: null,
    higherIsBetter: true,
    cadence: "daily",
    provenance: SOURCE_NEWS_CRAWLER,
  },
  {
    key: "advocacy_mentions",
    label: "Lượt nhắc từ cộng đồng người học và cựu người học",
    objectiveKey: "mkt_advocacy",
    tier: "marketing",
    value: null,
    unit: "count",
    target: 500,
    baseline: null,
    higherIsBetter: true,
    cadence: "daily",
    provenance: {
      label:
        "Bình luận công khai trên báo và diễn đàn — cần mở rộng crawler sang nguồn diễn đàn",
    },
  },

  // ── Truyền thông ───────────────────────────────────────────────────────────
  {
    key: "brand_search_index",
    label: "Chỉ số quan tâm tìm kiếm thương hiệu",
    objectiveKey: "com_awareness",
    tier: "communication",
    value: 64,
    unit: "count",
    target: 75,
    baseline: 58,
    higherIsBetter: true,
    cadence: "weekly",
    provenance: SOURCE_TRENDS,
    comparability: {
      basis: "admission_cycle",
      caveat:
        "Là chỉ số tuyệt đối nên đỉnh mùa tuyển sinh chi phối hoàn toàn — phải neo vào mốc công bố điểm thi, không so cùng tuần theo lịch.",
    },
    hint: "Thang 0–100 của Google Trends, không phải số lượt tìm kiếm tuyệt đối.",
  },
  {
    key: "positive_sentiment_share",
    label: "Tỷ lệ thảo luận tích cực",
    objectiveKey: "com_attributes",
    tier: "communication",
    // Chưa viết bước chấm PhoBERT nên chưa có số nào cả. Điền một con số đẹp vào đây
    // là đúng cái sai mà ràng buộc trong schema sinh ra để chặn.
    value: null,
    unit: "percent",
    target: 75,
    baseline: null,
    higherIsBetter: true,
    cadence: "daily",
    provenance: SOURCE_NEWS_CRAWLER,
  },
  {
    key: "attribute_coverage",
    label: "Tỷ lệ tin bài gắn thuộc tính mục tiêu",
    objectiveKey: "com_attributes",
    tier: "communication",
    value: null,
    unit: "percent",
    target: 45,
    baseline: null,
    higherIsBetter: true,
    cadence: "daily",
    provenance: SOURCE_NEWS_CRAWLER,
    hint: "Cần bổ sung bước trích thuộc tính vào worker/nlp.",
  },
  {
    key: "publisher_breadth",
    label: "Số đầu báo đưa tin trong kỳ",
    objectiveKey: "com_effectiveness",
    tier: "communication",
    value: 34,
    unit: "count",
    target: 45,
    baseline: 29,
    higherIsBetter: true,
    cadence: "daily",
    provenance: SOURCE_NEWS_CRAWLER,
    comparability: {
      basis: "admission_cycle",
      caveat:
        "Báo chí đưa tin dồn vào mùa công bố điểm chuẩn — so cùng tuần theo lịch sẽ đọc ra tăng giảm giả.",
    },
  },
  {
    key: "creative_hold_rate",
    label: "Tỷ lệ giữ chân 3 giây của nội dung video",
    objectiveKey: "com_creative",
    tier: "communication",
    value: null,
    unit: "percent",
    target: 40,
    baseline: null,
    higherIsBetter: true,
    cadence: "daily",
    provenance: SOURCE_PLATFORM_RESEARCH_API,
    hint: "Không thu thập bằng cách quét trang — vi phạm điều khoản sử dụng của nền tảng.",
  },

  // ── Đo bằng Google Analytics 4 — nguồn duy nhất đã chảy thật ────────────────
  // Giá trị lấy từ kho `.data/ptit_ga4.duckdb`, cửa sổ 30 ngày gần nhất
  // (28/06–27/07/2026); `baseline` là CÙNG KỲ NĂM TRƯỚC chứ không phải kỳ liền
  // trước — lưu lượng tuyển sinh chênh tới 19 lần giữa đỉnh và đáy mùa vụ, so kỳ
  // liền trước sẽ đọc ra kết luận ngược.
  {
    key: "admission_consideration_views",
    label: "Lượt xem trang quyết định chọn trường",
    objectiveKey: "mkt_consideration",
    tier: "marketing",
    value: 82_234,
    unit: "count",
    target: 95_000,
    baseline: 82_601,
    higherIsBetter: true,
    cadence: "daily",
    provenance: SOURCE_GA4,
    comparability: {
      basis: "admission_cycle",
      caveat:
        "Phải neo cửa sổ so sánh vào mốc công bố điểm chuẩn, không so cùng ngày theo lịch: mốc này dịch vài tuần mỗi năm.",
    },
    targetRationale: {
      basis: "pending_approval",
      note: "Đề xuất +15% so với cùng kỳ. Chưa có căn cứ nội tại nào tốt hơn vì chỉ mới có một mùa dữ liệu để đối chiếu.",
    },
    hint: "Điểm chuẩn, đề án tuyển sinh, phương thức xét tuyển trên tuyensinh.ptit.edu.vn — tín hiệu cân nhắc mạnh nhất đo được.",
  },
  {
    key: "social_traffic_share",
    label: "Tỷ trọng phiên đến từ mạng xã hội",
    objectiveKey: "com_awareness",
    tier: "communication",
    value: 10.7,
    unit: "percent",
    target: 12,
    baseline: 8.7,
    higherIsBetter: true,
    cadence: "daily",
    provenance: SOURCE_GA4,
    comparability: {
      basis: "calendar",
      caveat:
        "Là tỷ trọng nên ít chịu ảnh hưởng của mùa vụ — so theo lịch dùng được.",
    },
    targetRationale: {
      basis: "trend_continuation",
      note: "Năm trước 8,7%, năm nay 10,7% — tăng 2 điểm mỗi năm. Giữ nguyên đà thì kỳ tới đạt khoảng 12,7%; lấy tròn 12%.",
    },
    hint: "Zalo đang là nguồn lớn nhất trong nhóm này, không phải Facebook. YouTube và TikTok gần như bằng không.",
  },
  {
    key: "ai_assistant_sessions",
    label: "Phiên đến từ trợ lý AI",
    objectiveKey: "com_awareness",
    tier: "communication",
    value: 2_554,
    unit: "count",
    // Kênh mới xuất hiện, cùng kỳ năm trước bằng 0 — chưa đủ căn cứ chốt mức cần đạt.
    target: null,
    baseline: 0,
    higherIsBetter: true,
    cadence: "daily",
    provenance: SOURCE_GA4,
    comparability: {
      basis: "calendar",
      caveat:
        "Cùng kỳ năm trước bằng 0 vì GA4 chưa tách nhóm kênh này — đây là mốc kỹ thuật, không phải mức nền thật.",
    },
    hint: "Thí sinh hỏi ChatGPT, Gemini rồi bấm vào. Năm ngoái chưa có kênh này.",
  },
  {
    key: "social_engagement_rate",
    label: "Tỷ lệ gắn kết của phiên từ mạng xã hội",
    objectiveKey: "com_creative",
    tier: "communication",
    value: 40.1,
    unit: "percent",
    // Mốc nội bộ: tìm kiếm tự nhiên đạt 51,8%. Mục tiêu đặt ở mức thu hẹp một nửa khoảng cách.
    target: 45,
    baseline: 37.2,
    higherIsBetter: true,
    cadence: "daily",
    provenance: SOURCE_GA4,
    comparability: {
      basis: "calendar",
      caveat: "Là tỷ lệ nên so theo lịch dùng được.",
    },
    targetRationale: {
      basis: "internal_benchmark",
      note: "Tìm kiếm tự nhiên đạt 51,8% trên cùng website — đó là mức trần thực tế. Mục tiêu đặt ở chỗ thu hẹp một nửa khoảng cách: 40,1 + (51,8 − 40,1)/2 ≈ 46, lấy tròn 45%.",
    },
    hint: "Đo nội dung có kéo được người ở lại không. Luồng quảng cáo trả phí chỉ đạt 6,6% — cần tìm ai đang chạy.",
  },
  {
    key: "application_intent_views",
    label: "Lượt xem hướng dẫn đăng ký xét tuyển",
    objectiveKey: "biz_choice",
    tier: "business",
    // Luỹ kế từ đầu năm, KHÔNG phải cửa sổ 30 ngày. So 30 ngày cố định cho ra
    // “giảm 78%” trong khi thực tế đã vượt cả năm ngoái — xem `comparability`.
    value: 36_143,
    unit: "count",
    target: 38_000,
    baseline: 34_468,
    higherIsBetter: true,
    cadence: "weekly",
    provenance: SOURCE_GA4,
    comparability: {
      basis: "admission_cycle",
      caveat:
        "Chỉ so được theo luỹ kế cả mùa tuyển sinh. Năm 2025 cổng đăng ký mở tháng 7, năm 2026 mở tháng 5–6 — mọi cửa sổ cố định theo lịch đều cho kết luận sai.",
    },
    targetRationale: {
      basis: "trend_continuation",
      note: "Cả mùa 2025 đạt 34.468, mùa 2026 tới nay 36.143 — tăng 4,9%. Giữ đà đó cho mùa sau ra khoảng 37.900, lấy tròn 38.000.",
    },
    hint: "Chỉ số dẫn dắt gần nhất với hành vi nộp hồ sơ mà đo được khi chưa có key event.",
  },
  {
    key: "returning_user_share",
    label: "Tỷ lệ người dùng quay lại",
    objectiveKey: "mkt_consideration",
    tier: "marketing",
    value: 33.6,
    unit: "percent",
    target: 35.4,
    baseline: 30.9,
    higherIsBetter: true,
    cadence: "daily",
    provenance: SOURCE_GA4,
    comparability: {
      basis: "calendar",
      caveat: "Là tỷ lệ nên so theo lịch dùng được.",
    },
    targetRationale: {
      basis: "historical_peak",
      note: "Cả năm 2025 đạt 35,4% — mức cao nhất từng có. Mục tiêu là khôi phục lại chứ chưa đòi vượt, vì năm nay đang tụt.",
    },
    hint: "Người quay lại nhiều lần là người đang cân nhắc thật, khác với người ghé một lần rồi thôi.",
  },
  {
    key: "program_mix_beyond_core",
    label: "Tỷ trọng quan tâm dành cho nhóm ngành ngoài lõi viễn thông",
    objectiveKey: "mkt_new_segments",
    tier: "marketing",
    // Số cũ (28,0 / 29,3) tính sai vì chưa gộp trang trùng theo năm và chỉ đếm cụm
    // truyền thông, bỏ sót nhóm kinh tế – quản trị. Giá trị đúng lấy từ
    // apps/worker/config/programs.json.
    value: 40.9,
    unit: "percent",
    target: 45,
    baseline: 42.6,
    higherIsBetter: true,
    cadence: "weekly",
    provenance: SOURCE_GA4,
    comparability: {
      basis: "calendar",
      caveat:
        "Là tỷ trọng nên so được theo lịch, nhưng phải tính trên luỹ kế cả năm: cửa sổ ngắn bị lệch theo mùa công bố từng nhóm ngành.",
    },
    targetRationale: {
      basis: "pending_approval",
      note: "Đề xuất 45% — mức nhóm ngoài lõi gần ngang lõi. Không lấy mức cao nhất đã đạt (42,6%) làm đích vì mục tiêu là mở rộng, không phải khôi phục.",
    },
    hint: "Truyền thông, đa phương tiện, marketing, báo chí, cùng nhóm kinh tế – quản trị. Sau khi gộp trang trùng, Công nghệ thông tin (45.732 lượt) vẫn dẫn đầu — không phải Công nghệ đa phương tiện như số liệu chưa gộp cho thấy.",
  },
  {
    key: "high_value_program_interest",
    label: "Tỷ trọng quan tâm dành cho hệ chất lượng cao và liên kết quốc tế",
    objectiveKey: "mkt_value_mix",
    tier: "marketing",
    value: 7.8,
    unit: "percent",
    target: 9.8,
    baseline: 9.8,
    higherIsBetter: true,
    cadence: "weekly",
    provenance: SOURCE_GA4,
    comparability: {
      basis: "calendar",
      caveat: "Tỷ trọng tính trên luỹ kế cả năm, so được theo lịch.",
    },
    targetRationale: {
      basis: "historical_peak",
      note: "Năm 2025 đạt 9,8%, năm nay còn 7,8%. Đích là khôi phục mức cũ — chưa đặt cao hơn khi chưa rõ vì sao tụt.",
    },
    hint: "Ba chương trình: CNTT chất lượng cao, Marketing chất lượng cao, Kế toán chuẩn ACCA. Đo TRƯỚC khi thí sinh nhìn thấy học phí, nên tụt ở đây là lỗi truyền thông giá trị chứ không phải học phí quá cao.",
  },
] as const;

/**
 * NỀN TẢNG VÀ VIỆC KỸ THUẬT cho từng chỉ số — cột thứ ba của bảng điều khiển.
 *
 * Ô trống ở đây là hàng đợi công việc, không phải chỗ khuyết. Chỉ số chưa có nguồn
 * vẫn hiện trên màn hình kèm việc còn phải làm; khi nào đấu nối xong thì điền tiếp.
 */
const REQUIREMENTS: Record<string, KpiRequirement> = {
  enrolment_vs_quota: {
    platform: "Trang Ba công khai của 6 trường đối sánh",
    fields: ["số nhập học mới", "chỉ tiêu", "tỷ lệ nhập học so với kế hoạch"],
    readiness: "needs_build",
    todo: "Viết crawler + bóc tách PDF biểu mẫu (worker/crawler/edu_docs.py, pdfplumber)",
  },
  score_premium: {
    platform: "Công bố điểm chuẩn hằng năm của 6 trường",
    fields: ["điểm chuẩn theo ngành", "phương thức xét tuyển", "năm"],
    readiness: "needs_build",
    todo: "Viết parser trang điểm chuẩn (worker/crawler/benchmarks.py)",
  },
  admission_quota: {
    platform: "Thông báo tuyển sinh của Học viện",
    fields: ["chỉ tiêu theo hệ", "chỉ tiêu theo cơ sở"],
    readiness: "public_ready",
    todo: "Đang nhập tay từ thông báo công bố; tự động hoá cùng bước bóc tách đề án tuyển sinh",
  },
  enrolment_share: {
    platform: "Trang Ba công khai của 6 trường đối sánh",
    fields: ["số nhập học mới của từng trường"],
    readiness: "needs_build",
    todo: "Dùng chung crawler với chỉ số tỷ lệ nhập học trên chỉ tiêu",
  },
  tuition_revenue: {
    platform: "Mô hình ước tính từ chỉ tiêu và học phí công bố",
    fields: ["chỉ tiêu theo khoá", "học phí theo hệ", "tỷ lệ hao hụt"],
    readiness: "public_ready",
    todo: "Thay ước tính bằng số quyết toán khi bóc được tài liệu Ba công khai",
  },
  high_value_mix: {
    platform: "Đề án tuyển sinh của Học viện",
    fields: ["chỉ tiêu và nhập học theo từng hệ đào tạo"],
    readiness: "needs_build",
    todo: "Bóc bảng phân bổ chỉ tiêu theo hệ trong đề án tuyển sinh",
  },
  dropout_rate: {
    platform: "Trang Ba công khai của Học viện",
    fields: ["tỷ lệ thôi học", "quy mô đào tạo"],
    readiness: "needs_build",
    todo: "Dùng chung crawler tài liệu Ba công khai",
  },
  employment_rate: {
    platform: "Trang Ba công khai của Học viện",
    fields: ["tỷ lệ có việc làm 12 tháng sau tốt nghiệp"],
    readiness: "needs_build",
    todo: "Dùng chung crawler tài liệu Ba công khai",
  },
  postgrad_intake_share: {
    platform: "Trang Ba công khai của Học viện",
    fields: ["số nhập học mới theo từng trình độ đào tạo"],
    readiness: "needs_build",
    todo: "Dùng chung crawler tài liệu Ba công khai",
  },
  share_of_search: {
    platform: "Google Trends",
    fields: [
      "interest_over_time theo tuần",
      "geo = VN",
      "6 từ khoá thương hiệu, chia lượt tối đa 5 từ khoá",
    ],
    readiness: "needs_access",
    todo: "Google trả HTTP 429 ở mọi lần thử, cách nhau nhiều giờ — không phải chặn tạm thời. pytrends gọi endpoint nội bộ nên không có đường xin quyền chính thức. Đã dựng nguồn thay thế là Wikimedia Pageviews; giữ mã Trends lại để thử lại định kỳ",
  },
  attention_share: {
    platform: "Wikimedia Pageviews API",
    fields: [
      "per-article/vi.wikipedia.org/all-access/user",
      "lượt xem theo ngày, gộp thành tuần",
      "6 bài tương ứng 6 trường",
    ],
    readiness: "connected",
    todo: "Dựng model dbt trên bảng raw_brand_pageviews rồi đổi KpiRepository sang đọc PostgreSQL — dữ liệu đã có trong kho, còn thiếu đường lên API",
  },
  share_of_voice: {
    platform: "Crawler tin bài (news-please)",
    fields: ["url", "publisher", "published_at", "thương hiệu được nhắc"],
    readiness: "needs_build",
    todo: "Mở rộng danh sách nguồn để phủ đủ 6 thương hiệu, không chỉ Học viện",
  },
  new_program_share: {
    platform: "Crawler tin bài (news-please)",
    fields: ["nội dung bài", "từ khoá nhóm ngành mới"],
    readiness: "needs_build",
    todo: "Bổ sung bộ từ khoá nhóm ngành mới vào config/brand-keywords.json",
  },
  value_program_share: {
    platform: "Crawler tin bài (news-please)",
    fields: ["nội dung bài", "từ khoá hệ chất lượng cao và liên kết quốc tế"],
    readiness: "needs_build",
    todo: "Bổ sung bộ từ khoá hệ đào tạo giá trị cao",
  },
  advocacy_mentions: {
    platform: "Bình luận công khai trên báo và diễn đàn",
    fields: ["nội dung bình luận", "nguồn", "thời điểm"],
    readiness: "needs_build",
    todo: "Mở rộng crawler sang nguồn diễn đàn; cân nhắc điều khoản sử dụng của từng nguồn",
  },
  brand_search_index: {
    platform: "Google Trends",
    fields: ["interest_over_time của riêng từ khoá Học viện"],
    readiness: "public_ready",
    todo: "Dùng chung lượt gọi với chỉ số thị phần tìm kiếm",
  },
  positive_sentiment_share: {
    platform: "PhoBERT chấm trên kho tin bài",
    fields: ["sentiment_score", "model_version", "scored_at"],
    readiness: "needs_build",
    todo: "Viết bước chấm sắc thái (worker/nlp/sentiment.py), nướng sẵn model vào image",
  },
  attribute_coverage: {
    platform: "Trích thuộc tính trên kho tin bài",
    fields: ["cụm thuộc tính mục tiêu", "url bài"],
    readiness: "needs_build",
    todo: "Viết bước trích thuộc tính (worker/nlp/attributes.py)",
  },
  publisher_breadth: {
    platform: "Crawler tin bài (news-please)",
    fields: ["publisher", "published_at"],
    readiness: "public_ready",
    todo: null,
  },
  creative_hold_rate: {
    platform: "Meta Content Library / TikTok Research API",
    fields: ["video view 3 giây", "ThruPlay", "tỷ lệ xem hết"],
    readiness: "needs_access",
    todo: "Đăng ký quyền truy cập nghiên cứu. TUYỆT ĐỐI không quét trang — vi phạm điều khoản sử dụng của nền tảng",
  },

  // ── Bốn chỉ số dưới đây là nhóm DUY NHẤT đã có dữ liệu thật chảy về ─────────
  admission_consideration_views: {
    platform: "Google Analytics 4 — Data API (đã kết nối)",
    fields: [
      "ga4_pages_daily.hostName = tuyensinh.ptit.edu.vn",
      "ga4_pages_daily.pagePath chứa diem-chuan / de-an-tuyen-sinh / phuong-thuc",
      "screenPageViews, sessions",
    ],
    readiness: "connected",
    todo: "Đặt key event trên nút nộp hồ sơ để nối sang tầng kinh doanh — CẦN QUYỀN EDITOR, hiện chỉ có quyền xem",
  },
  social_traffic_share: {
    platform: "Google Analytics 4 — Data API (đã kết nối)",
    fields: [
      "ga4_traffic_acquisition_daily.sessionDefaultChannelGroup",
      "sessionSource, sessionMedium",
      "sessions",
    ],
    readiness: "connected",
    todo: "Gắn UTM cho mọi link đăng ra ngoài: 17,7% phiên vẫn rơi vào Direct, tệ hơn cùng kỳ năm trước (14,7%)",
  },
  ai_assistant_sessions: {
    platform: "Google Analytics 4 — Data API (đã kết nối)",
    fields: [
      "ga4_traffic_acquisition_daily.sessionDefaultChannelGroup = 'AI Assistant'",
      "sessions, engagedSessions",
    ],
    readiness: "connected",
    todo: "Chạy đủ bốn quý để có nền so sánh rồi mới chốt mức cần đạt",
  },
  social_engagement_rate: {
    platform: "Google Analytics 4 — Data API (đã kết nối)",
    fields: [
      "ga4_traffic_acquisition_daily.engagedSessions / sessions",
      "averageSessionDuration",
      "lọc theo sessionDefaultChannelGroup",
    ],
    readiness: "connected",
    todo: "Tách riêng Zalo khỏi Facebook trong báo cáo — Zalo đang là nguồn lớn nhất mà chưa ai quản lý",
  },
  application_intent_views: {
    platform: "Google Analytics 4 — Data API (đã kết nối)",
    fields: [
      "ga4_pages_daily.hostName = tuyensinh.ptit.edu.vn",
      "pagePath chứa dkxt / dang-ky-nguyen-vong / dang-ky-thong-tin",
      "screenPageViews luỹ kế theo mùa tuyển sinh",
    ],
    readiness: "connected",
    todo: "Thay bằng key event thật trên nút nộp hồ sơ khi xin được quyền Editor — hiện đây chỉ là chỉ số thay thế",
  },
  returning_user_share: {
    platform: "Google Analytics 4 — Data API (đã kết nối)",
    fields: [
      "ga4_traffic_acquisition_daily.totalUsers",
      "ga4_traffic_acquisition_daily.newUsers",
    ],
    readiness: "connected",
    todo: null,
  },
  program_mix_beyond_core: {
    platform: "Google Analytics 4 — Data API (đã kết nối)",
    fields: [
      "ga4_pages_daily.pagePath khớp /chuong-trinh-dao-tao/nganh-*",
      "screenPageViews luỹ kế theo năm",
      "phân nhóm ngành theo từ khoá trong đường dẫn",
    ],
    readiness: "connected",
    todo: "Chuyển bảng phân nhóm ngành ra file cấu hình riêng thay vì khớp chuỗi trong truy vấn — mỗi năm mở ngành mới là phải sửa",
  },
  high_value_program_interest: {
    platform: "Google Analytics 4 — Data API (đã kết nối)",
    fields: [
      "ga4_pages_daily.pagePath khớp he-clc / chat-luong-cao / lien-ket / quoc-te",
      "screenPageViews luỹ kế theo năm",
    ],
    readiness: "connected",
    todo: "Đối chiếu danh sách đường dẫn với đề án tuyển sinh để không sót chương trình nào",
  },
};

/**
 * DIỄN GIẢI THEO HƯỚNG MỤC TIÊU — chiều nào của con số là tốt, chiều nào là xấu.
 *
 * Đây là ràng buộc quan trọng nhất của cả mô hình. Một chỉ số nền tảng chỉ được lên
 * bảng điều khiển khi nói được rõ nó nghiêng về phía nào của mục tiêu. Không diễn
 * giải được nghĩa là chưa biết đo nó để làm gì, và khi đó đừng đo.
 */
const INTERPRETATIONS: Record<string, KpiInterpretation> = {
  enrolment_vs_quota: {
    positive: "Tăng: thí sinh trúng tuyển thật sự chọn Học viện — nguồn Lựa chọn đang mạnh lên.",
    negative: "Giảm: Học viện đang là phương án dự phòng, mở thêm chỉ tiêu sẽ không lấp đầy.",
  },
  score_premium: {
    positive: "Dương và tăng: thí sinh chấp nhận đánh đổi điểm cao hơn để vào Học viện.",
    negative: "Âm hoặc giảm: cùng mức điểm, thí sinh chọn trường khác trước.",
  },
  admission_quota: {
    positive: "Tăng: mở rộng được quy mô — nhưng chỉ có nghĩa khi tỷ lệ nhập học giữ được mức cao.",
    negative: "Tăng mà tỷ lệ nhập học giảm: đang mở cung nhanh hơn cầu thương hiệu.",
  },
  enrolment_share: {
    positive: "Tăng: giành được phần trong nhóm đối sánh, không chỉ lớn lên theo thị trường.",
    negative: "Giảm: quy mô có thể vẫn tăng nhưng đối thủ tăng nhanh hơn.",
  },
  tuition_revenue: {
    positive: "Tăng: nguồn lực tái đầu tư cho đào tạo và cơ sở vật chất tăng theo.",
    negative: "Giảm: hoặc hụt sản lượng, hoặc cơ cấu dịch về phía hệ học phí thấp.",
  },
  high_value_mix: {
    positive: "Tăng: người học chấp nhận trả cao hơn cho hệ đào tạo tốt hơn — giá trị được công nhận.",
    negative: "Giảm: chênh lệch học phí đang bị đọc là rào cản chứ không phải tín hiệu chất lượng.",
  },
  dropout_rate: {
    positive: "Giảm: giữ được người học, đồng thời là bằng chứng cho thuộc tính chất lượng đào tạo.",
    negative: "Tăng: mất doanh thu đã có và sinh ra tiếng xấu lan trong cộng đồng thí sinh.",
  },
  employment_rate: {
    positive: "Tăng: củng cố thuộc tính 'ra trường có việc' — lý do chọn trường mạnh nhất.",
    negative: "Giảm: mất luận điểm thuyết phục nhất trong mọi thông điệp tuyển sinh.",
  },
  postgrad_intake_share: {
    positive: "Tăng: người học quay lại — nguồn tăng trưởng theo tần suất bắt đầu chạy.",
    negative: "Giảm: quan hệ với người học kết thúc ngay khi tốt nghiệp.",
  },
  share_of_search: {
    positive: "Tăng: Học viện đang chiếm chỗ trong tập cân nhắc trước mùa xét tuyển.",
    negative: "Giảm: sẽ thấy hậu quả ở tỷ lệ nhập học của mùa sau, khi đó sửa đã muộn.",
  },
  attention_share: {
    positive:
      "Tăng: nhiều người chủ động tra cứu về Học viện hơn so với năm trường còn lại — dấu hiệu sớm của việc được đưa vào tập cân nhắc.",
    negative:
      "Giảm: sự chú ý đang dồn sang trường khác. Số liệu thật kỳ 26/01–20/07/2026 cho thấy Học viện mất 3,50 điểm thị phần trong khi Bách khoa Hà Nội tăng 17,56 điểm.",
  },
  share_of_voice: {
    positive: "Tăng: hiện diện trên báo chí nhiều hơn nhóm đối sánh, không tốn ngân sách quảng cáo.",
    negative: "Giảm: đối thủ đang dẫn dắt câu chuyện ngành thay cho Học viện.",
  },
  new_program_share: {
    positive: "Tăng: các ngành mới bắt đầu có chỗ đứng riêng thay vì núp bóng tên trường.",
    negative: "Thấp: mở ngành mới nhưng không ai biết, chỉ tiêu mới sẽ khó lấp đầy.",
  },
  value_program_share: {
    positive: "Tăng: giá trị hệ đào tạo cao được kể ra ngoài, đỡ cho việc giải thích học phí.",
    negative: "Thấp: học phí cao xuất hiện trần trụi mà không kèm lý do.",
  },
  advocacy_mentions: {
    positive: "Tăng: cộng đồng người học tự nói thay — kênh đáng tin nhất và rẻ nhất.",
    negative: "Giảm: mọi thông điệp đều phải do Học viện tự phát, độ tin cậy thấp hơn.",
  },
  brand_search_index: {
    positive: "Tăng: nhiều người chủ động tìm tên Học viện hơn — nhận biết đang lên.",
    negative: "Giảm: rơi khỏi tầm chú ý, thường xảy ra ngoài mùa truyền thông.",
  },
  positive_sentiment_share: {
    positive: "Tăng: được nhắc tới nhiều đi kèm được nhắc tới tốt.",
    negative: "Giảm: hiện diện tăng mà sắc thái xấu đi còn hại hơn im lặng.",
  },
  attribute_coverage: {
    positive: "Tăng: tin bài không chỉ nhắc tên mà còn gắn đúng ba thuộc tính mục tiêu.",
    negative: "Thấp: được nhắc nhiều nhưng không đọng lại lý do nào để chọn.",
  },
  publisher_breadth: {
    positive: "Tăng: thoát khỏi vòng vài đầu báo quen, chạm được nhóm công chúng mới.",
    negative: "Giảm: tin bài dồn vào ít nguồn, độ phủ thật hẹp hơn con số tổng lượt nhắc.",
  },
  creative_hold_rate: {
    positive: "Tăng: nội dung tự giữ được người xem, không phải mua sự chú ý.",
    negative: "Giảm: có tiêu tiền phân phối cũng chỉ mua được lượt lướt qua.",
  },

  admission_consideration_views: {
    positive:
      "Tăng so với cùng kỳ: nhiều thí sinh hơn đang đọc điểm chuẩn và đề án — Học viện đã vào tập cân nhắc trước khi tới hạn nộp nguyện vọng.",
    negative:
      "Đứng yên hoặc giảm: truyền thông có thể vẫn tạo được lượt tiếp cận, nhưng không đẩy thêm ai sang bước tìm hiểu để chọn trường.",
  },
  social_traffic_share: {
    positive:
      "Tăng: kênh do Học viện chủ động vận hành đang gánh thêm phần dẫn dắt, bớt phụ thuộc vào việc thí sinh tự tìm kiếm.",
    negative:
      "Giảm: gần như toàn bộ nhu cầu đến từ tìm kiếm tự nhiên — truyền thông chủ động không tạo thêm nhu cầu mới mà chỉ hứng phần sẵn có.",
  },
  ai_assistant_sessions: {
    positive:
      "Tăng: trợ lý AI đang nhắc tới Học viện khi thí sinh hỏi về nơi học công nghệ — một mặt trận nhận biết mới, hiện chưa ai trong nhóm đối sánh giữ chỗ.",
    negative:
      "Đứng yên gần 0 trong khi tổng lưu lượng tăng: nội dung của Học viện không được các mô hình dẫn lại, dần mất chỗ ở lớp tra cứu mới.",
  },
  social_engagement_rate: {
    positive:
      "Tăng: nội dung kéo về đúng người và giữ được họ ở lại — chất lượng tiếp cận tăng chứ không chỉ số lượng.",
    negative:
      "Giảm: lượt bấm vẫn có nhưng người vào rồi thoát ngay; đang mua sự chú ý chứ không tạo được sự quan tâm.",
  },
  application_intent_views: {
    positive:
      "Tăng theo luỹ kế mùa: nhiều thí sinh hơn đã đi tới bước tìm hiểu cách nộp hồ sơ — nhu cầu đang chuyển thành hành động.",
    negative:
      "Giảm theo luỹ kế mùa: thí sinh biết đến Học viện nhưng dừng lại trước bước nộp; nghẽn nằm ở khâu cuối chứ không phải khâu nhận biết.",
  },
  returning_user_share: {
    positive:
      "Tăng: thí sinh quay lại nhiều lần để tra cứu — Học viện nằm trong nhóm trường được cân nhắc nghiêm túc, không chỉ được ghé qua.",
    negative:
      "Giảm: lượng truy cập có thể vẫn tăng nhưng phần lớn là ghé một lần rồi đi — tiếp cận rộng mà không tạo được sự gắn bó.",
  },
  program_mix_beyond_core: {
    positive:
      "Tăng: Học viện đang mở được chỗ đứng ngoài lõi viễn thông — nguồn tăng trưởng mới hình thành trước khi lõi cũ bão hoà.",
    negative:
      "Giảm: quan tâm co lại về nhóm ngành truyền thống, các ngành mới mở không tự tạo được nhu cầu và sẽ khó lấp đầy chỉ tiêu.",
  },
  high_value_program_interest: {
    positive:
      "Tăng: thí sinh chủ động tìm hiểu hệ học phí cao — giá trị đã được truyền thông tới nơi, chênh lệch học phí đọc ra là chất lượng.",
    negative:
      "Giảm: thí sinh né hệ giá trị cao ngay từ khâu tìm hiểu, tức là chưa nghe được lý do đáng trả thêm; đây là lỗi truyền thông, không phải lỗi định giá.",
  },
};

function toKpi(spec: KpiSpec): CascadeKpi {
  const requirement = REQUIREMENTS[spec.key];
  const interpretation = INTERPRETATIONS[spec.key];

  // Thà hỏng lúc dựng dữ liệu còn hơn hiện lên màn hình một chỉ số không ai biết nó
  // phục vụ mục tiêu gì và thế nào là tốt.
  if (!requirement || !interpretation) {
    throw new Error(
      `KPI ${spec.key} thiếu khai báo nền tảng hoặc diễn giải tích cực/tiêu cực.`,
    );
  }

  return {
    ...spec,
    requirement,
    interpretation,
    status: evaluateStatus(spec.value, spec.target, spec.higherIsBetter),
  };
}

function weeklyPeriod(weeks: string[]): Period {
  const first = weeks[0]!;
  const last = weeks[weeks.length - 1]!;
  return {
    from: first,
    to: last,
    label: `${weeks.length} tuần gần nhất (${formatVnDate(first)} – ${formatVnDate(last)})`,
  };
}

export function buildDemoCascade(
  referenceDate: Date = new Date(),
): KpiCascadeResponse {
  const weeks = buildWeekStarts(referenceDate, WEEKS);
  const period = weeklyPeriod(weeks);

  // Trước đây ô "Thị phần tìm kiếm" được gán bằng điểm cuối của biểu đồ cùng tên để
  // hai chỗ không lệch nhau. Nay Google chặn hoàn toàn nên chỉ số đó không có số liệu,
  // và việc mượn số từ chuỗi giả lập của biểu đồ chính là kiểu gán số vô căn cứ mà
  // CascadeKpiSchema từ chối. Biểu đồ vẫn giữ để minh hoạ hình thức trình bày.
  return {
    period,
    updatedAt: new Date(`${weeks[weeks.length - 1]!}T02:00:00Z`).toISOString(),
    objectives: [...OBJECTIVES],
    kpis: KPI_SPECS.map(toKpi),
  };
}

/**
 * Chuỗi thị phần tìm kiếm giả lập.
 *
 * Sinh mức quan tâm thô cho từng thương hiệu rồi mới chia tỷ trọng — giống hệt cách
 * job thật tính từ Google Trends, nhờ vậy tổng mỗi tuần luôn bằng 100 và ràng buộc
 * trong schema kiểm được cả dữ liệu mẫu lẫn dữ liệu thật.
 */
export function buildDemoShareOfSearch(
  referenceDate: Date = new Date(),
): ShareOfSearchResponse {
  const weeks = buildWeekStarts(referenceDate, WEEKS);
  const period = weeklyPeriod(weeks);

  const rawByBrand = new Map<string, number[]>(
    BENCHMARK_BRANDS.map((brand) => [
      brand.key,
      weeks.map((week, weekIndex) => {
        const rnd = seeded(hashString(`sos:${brand.key}:${week}`));
        const base = BASE_INTEREST[brand.key] ?? 10;
        // Học viện đi lên nhẹ trong kỳ; các thương hiệu khác chỉ dao động quanh nền.
        const trend = brand.isUs ? 1 + weekIndex * 0.006 : 1;
        return base * trend * (0.9 + rnd() * 0.2);
      }),
    ]),
  );

  const weekTotals = weeks.map((_, weekIndex) =>
    BENCHMARK_BRANDS.reduce(
      (sum, brand) => sum + (rawByBrand.get(brand.key)?.[weekIndex] ?? 0),
      0,
    ),
  );

  const series = BENCHMARK_BRANDS.map((brand) => ({
    brand,
    values: weeks.map((_, weekIndex) => {
      const raw = rawByBrand.get(brand.key)?.[weekIndex] ?? 0;
      const total = weekTotals[weekIndex] ?? 1;
      return Number(((raw / total) * 100).toFixed(2));
    }),
  }));

  const lastIndex = weeks.length - 1;
  const latest = series
    .map((s) => {
      const current = s.values[lastIndex] ?? 0;
      const first = s.values[0] ?? null;
      return {
        brand: s.brand,
        sharePct: current,
        deltaPoints:
          first === null ? null : Number((current - first).toFixed(2)),
      };
    })
    .sort((a, b) => b.sharePct - a.sharePct);

  return {
    period,
    updatedAt: new Date(`${weeks[lastIndex]!}T02:00:00Z`).toISOString(),
    weeks,
    series,
    latest,
    provenance: SOURCE_TRENDS,
  };
}
