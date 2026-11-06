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
    shortLabel: "Học viện (PTIT)",
    isUs: true,
  },
  {
    key: "hust",
    label: "Đại học Bách khoa Hà Nội",
    shortLabel: "Bách khoa Hà Nội",
    isUs: false,
  },
  {
    key: "uet",
    label: "Trường ĐH Công nghệ (ĐHQGHN)",
    shortLabel: "ĐH Công nghệ (ĐHQGHN)",
    isUs: false,
  },
  {
    key: "uit",
    label: "Trường ĐH Công nghệ Thông tin (ĐHQG-HCM)",
    shortLabel: "ĐH CNTT (ĐHQG-HCM)",
    isUs: false,
  },
  {
    key: "fpt",
    label: "Trường Đại học FPT",
    shortLabel: "ĐH FPT",
    isUs: false,
  },
  {
    key: "actvn",
    label: "Học viện Kỹ thuật Mật mã",
    shortLabel: "Mật mã",
    isUs: false,
  },
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
  benchmark: {
    coverage: "partial",
    note: "Biểu 18 là tài liệu buộc công khai của cả 6 trường, nhưng mới bóc được số của 2 trường (Bách khoa Hà Nội 5 năm, Học viện 3 năm). Trường ĐH Công nghệ ra 4 dòng mà không dòng nào có sản lượng; UIT, FPT, Mật mã chưa có dòng nào. Mẫu số chưa đủ nên mọi con số thị phần tính lúc này đều sai.",
  },
};

const SOURCE_ADMISSION_SCHEME: DataProvenance = {
  label: "Đề án tuyển sinh công bố hằng năm của Học viện và nhóm đối sánh",
  legalBasis: "Thông tư 08/2022/TT-BGDĐT, Điều 11",
  benchmark: {
    coverage: "partial",
    note: "Đề án tuyển sinh chứa cả ba chiều cần để giành thị phần — sản lượng, điểm chuẩn, học phí — nên là nguồn đáng ưu tiên nhất. Nhưng có một ranh giới kỹ thuật dứt khoát: bóc tự động được đề án dạng văn bản, KHÔNG bóc được khi đề án là ảnh scan hoặc khi bảng số do JavaScript dựng. Phần không bóc được phải nhập tay kèm đường dẫn nguồn đã xác minh.",
  },
};

const SOURCE_ACADEMY_ANNOUNCEMENT: DataProvenance = {
  label: "Thông báo tuyển sinh đại học chính quy của Học viện",
  url: "https://tuyensinh.ptit.edu.vn/",
  benchmark: {
    coverage: "us_only",
    note: "Thông báo tuyển sinh của riêng Học viện. Trường khác có thông báo riêng, định dạng khác nhau, chưa bóc.",
  },
};

const SOURCE_TRENDS: DataProvenance = {
  label: "Google Trends — chỉ số quan tâm tìm kiếm, công khai và miễn phí",
  url: "https://trends.google.com/",
  benchmark: {
    coverage: "full",
    note: "Google Trends cho tỷ trọng của cả 6 thương hiệu trong một lần truy vấn — về nguyên tắc đây là nguồn so sánh tốt nhất. Hiện Google chặn truy cập nên chỉ số này không có số liệu.",
  },
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
  benchmark: {
    coverage: "full",
    note: "Lượt xem trang của cả 6 trường đều công khai qua API, cùng một cách tính. Đây là nguồn đối sánh duy nhất đang chảy đều.",
  },
};

const SOURCE_NEWS_CRAWLER: DataProvenance = {
  label: "Kho tin bài do worker thu thập, chấm sắc thái bằng PhoBERT",
  benchmark: {
    coverage: "full",
    note: "Crawler quét tin bài nhắc cả 6 trường, nên thị phần thảo luận tính được trên đủ mẫu số. Giới hạn nằm ở chỗ khác: báo chí dồn theo mùa tuyển sinh.",
  },
};

/**
 * Thảo luận của NGƯỜI NGOÀI, khác hẳn kho tin bài. Tách nguồn riêng vì hai kho được
 * chấm bằng hai model khác nhau: đọc số của chúng như thể cùng một thang đo là sai.
 *
 * Không có Facebook trong danh sách, và đó không phải là thiếu sót: Meta đóng CrowdTangle
 * từ 14/08/2024, bản thay thế (Meta Content Library) phải xin qua ICPSR. TikTok Research
 * API chỉ mở cho cơ sở ở Mỹ/EEA/Anh/Thuỵ Sĩ/Brazil. Quét trang để lấy là vi phạm điều
 * khoản nền tảng — hệ thống này không làm, và độ phủ thiếu được ghi nhận thay vì che đi.
 */
const SOURCE_SOCIAL_LISTENING: DataProvenance = {
  label:
    "YouTube Data API v3 (bình luận công khai) và Reddit search feed, chấm sắc thái bằng ViSoBERT",
  legalBasis:
    "API chính thức của nền tảng cho dữ liệu công khai. Tài khoản người bình luận lưu dưới dạng mã băm, không lưu tên hiển thị.",
  benchmark: {
    coverage: "partial",
    note: "Chỉ YouTube và Reddit; Facebook và TikTok không có đường hợp pháp. Mẫu còn mỏng nên tỷ lệ của từng trường chưa đọc riêng được.",
  },
};

const SOURCE_PLATFORM_RESEARCH_API: DataProvenance = {
  label:
    "Cần quyền truy cập nghiên cứu của nền tảng (Meta Content Library, TikTok Research API) — chưa đăng ký",
  benchmark: {
    coverage: "us_only",
    note: "Cần quyền truy cập nghiên cứu của nền tảng, và quyền đó chỉ cấp cho tài khoản của chính chủ sở hữu nội dung.",
  },
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
  benchmark: {
    coverage: "us_only",
    note: "Dữ liệu hành vi trên website của Học viện. Không trường nào mở analytics của mình, nên đây mãi mãi là nguồn chỉ đo được bản thân — dùng cho mục tiêu hành vi, không dùng cho thị phần.",
  },
};

const SOURCE_MINISTRY_STATS: DataProvenance = {
  label:
    "Thống kê nguyện vọng đăng ký xét tuyển theo lĩnh vực do Bộ Giáo dục và Đào tạo công bố hằng năm",
  url: "https://moet.gov.vn/tin-tuc/tin-tong-hop2/hon-mot-nua-tong-so-thi-sinh-dang-ky-xet-tuyen-dai-hoc-nam-2026-lua-chon-nganh-stem.html",
  benchmark: {
    coverage: "full",
    note: "Số liệu Bộ công bố là của toàn lĩnh vực, tức là MẪU SỐ của mọi phép tính thị phần và là mốc tăng trưởng ngành. Chưa có bước thu thập nào.",
  },
};

/**
 * Dự toán nội bộ — nguồn DUY NHẤT trong cascade không phải nguồn công khai.
 *
 * Giữ nguyên tính chất đó: chỉ số lấy từ đây phải nêu rõ là số nội bộ, và không
 * bao giờ trộn vào một phép so sánh với trường khác (ta không biết họ chi bao nhiêu).
 */
const SOURCE_INTERNAL_BUDGET: DataProvenance = {
  label: "Dự toán và quyết toán kinh phí truyền thông tuyển sinh của Học viện",
  benchmark: {
    coverage: "not_applicable",
    note: "Dự toán nội bộ. Không biết và không nên đoán ngân sách truyền thông của trường khác — đây là lý do nửa share of spend trong cặp chỉ số của bài 5.2 không đo được.",
  },
};

/** Danh sách mục tiêu. Thứ tự trong mảng là thứ tự hiển thị trong mỗi tầng. */
const OBJECTIVES: readonly Objective[] = [
  // ── Tầng kinh doanh ────────────────────────────────────────────────────────
  // Bốn con số của bài 2.6: doanh số, thị phần, tăng trưởng, lợi nhuận. Đây là số
  // liệu của Học viện, không phải hành vi của người học — hành vi nằm ở tầng dưới.
  {
    key: "biz_sale",
    shortName: "Doanh số",
    tier: "business",
    statement:
      "Lấp đầy chỉ tiêu tuyển sinh và nâng giá trị thu được trên mỗi khoá",
    rationale:
      "Doanh số có hai mặt và phải đọc cùng nhau: sản lượng là số người nhập học, giá trị là doanh thu học phí. Dẫn đầu mặt này không kéo theo mặt kia. Lưu ý chỉ tiêu tuyển sinh là NĂNG LỰC CUNG chứ không phải doanh số — lấp đầy được chỉ tiêu mới tương đương bán hết hàng đã sản xuất, và theo bài 2.1 thì đó chưa phải là thoả mãn mục tiêu kinh doanh.",
    theory: {
      concept: "Volume sale và value sale — doanh số có hai mặt",
      origin:
        "Peter Drucker (quản trị theo mục tiêu); Neil H. McElroy (brand team sở hữu P&L)",
      work: "Drucker, The Practice of Management (1954); McElroy, bản ghi nhớ Brand Men, P&G (1931)",
      lesson: "2.1",
      caveat: null,
    },
    growthSource: null,
    communicationGoal: null,
    parentKey: null,
    isFocus: false,
  },
  {
    key: "biz_share",
    shortName: "Thị phần",
    tier: "business",
    statement:
      "Tăng thị phần nhập học trong nhóm trường kỹ thuật – công nghệ đối sánh",
    rationale:
      "Chỉ tiêu đã tăng gấp 2,09 lần trong 4 năm trong khi quy mô ngành chỉ tăng khoảng 6,5%/năm, và đỉnh điểm chuẩn bào mòn dần. Dư địa tăng trưởng bằng mở rộng chỉ tiêu sắp hết, nguồn tiếp theo phải đến từ phần giành được trong nhóm đối sánh. Độ lớn thị trường ở đây là nhóm năm trường cạnh tranh trực tiếp — đổi cách định nghĩa thị trường là đổi con số, nên định nghĩa phải nói rõ trên nhãn.",
    theory: {
      concept: "Market share — volume share và value share",
      origin:
        "Robert D. Buzzell, Bradley T. Gale, Ralph G. M. Sultan — dự án PIMS",
      work: "Market Share — A Key to Profitability, Harvard Business Review 53 (1975), tr. 97–106",
      lesson: "2.2",
      caveat:
        "Quan hệ thị phần → lợi nhuận của PIMS bị thách thức: Wernerfelt chỉ ra doanh nghiệp thị phần thấp vẫn có thể rất sinh lợi, Rumelt & Wensley không loại trừ được khả năng quan hệ đó là giả tạo. Lấy thị phần làm mục tiêu là lựa chọn có căn cứ, KHÔNG phải một định luật — đừng trình bày như nhân quả đã chứng minh.",
    },
    growthSource: null,
    communicationGoal: null,
    parentKey: null,
    isFocus: true,
  },
  {
    key: "biz_growth",
    shortName: "Tăng trưởng",
    tier: "business",
    statement:
      "Tăng trưởng nhanh hơn tốc độ tăng của lĩnh vực máy tính và công nghệ thông tin",
    rationale:
      "Quy tắc chịu lực nhất của khung IBMC: tăng trưởng của một thương hiệu chỉ có nghĩa khi đặt cạnh tăng trưởng của ngành. Tăng nhập học mà chậm hơn lĩnh vực nghĩa là ĐANG MẤT thị phần, dù con số tuyệt đối vẫn đẹp — đó là ô nguy hiểm nhất của ma trận bài 2.3 vì mọi chỉ số đều xanh. Mục tiêu này tồn tại để chặn đúng cái bẫy đó.",
    theory: {
      concept: "Brand growth đặt cạnh category growth",
      origin:
        "H. Igor Ansoff; ma trận tăng trưởng – thị phần của Boston Consulting Group",
      work: "Ansoff, Strategies for Diversification, Harvard Business Review (1957); BCG/Henderson (khoảng 1968–1970)",
      lesson: "2.3",
      caveat: null,
    },
    growthSource: null,
    communicationGoal: null,
    parentKey: null,
    isFocus: false,
  },
  {
    key: "biz_profit",
    shortName: "Lợi nhuận",
    tier: "business",
    statement:
      "Chứng minh được hiệu quả của mỗi đồng chi cho truyền thông tuyển sinh",
    rationale:
      "Trường công lập không tối đa hoá lợi nhuận, nên thứ giữ lại từ bài 2.5 là CẤU TRÚC chứ không phải ngưỡng: mọi đồng chi ra phải quy về một đơn vị kết quả. Không có con số này thì không đề nghị được ngân sách cho mùa sau — bài 1 nói thẳng rằng không chứng minh được giá trị thì không xin được tiền — và hội đồng nghiệm thu không có cơ sở đánh giá hiệu quả đầu tư.",
    theory: {
      concept: "Marketing contribution và trích lập quỹ marketing",
      origin:
        "Neil H. McElroy (brand team chịu trách nhiệm tới P&L); hệ chỉ số marketing hiện đại của Tim Ambler và Paul Farris cùng cộng sự",
      work: "McElroy, bản ghi nhớ Brand Men, P&G (1931); Ambler, Marketing and the Bottom Line (2000); Farris, Bendle, Pfeifer & Reibstein, Marketing Metrics (2006)",
      lesson: "2.5",
      caveat:
        "Ngưỡng marketing contribution tối thiểu 40% của bài 2.5 là ngưỡng của ngành hàng tiêu dùng nhanh và KHÔNG áp cho trường công lập. Thứ giữ lại từ khung là cấu trúc — mọi đồng chi ra quy về một đơn vị kết quả — chứ không phải con số.",
    },
    growthSource: null,
    communicationGoal: null,
    parentKey: null,
    isFocus: false,
  },

  // ── Tầng marketing ─────────────────────────────────────────────────────────
  // Năm nguồn tăng trưởng (bài 3.1) — mỗi mục tiêu ở đây là một cách thay đổi HÀNH VI
  // của người học. `parentKey` trỏ về con số kinh doanh mà nó tác động chính.
  {
    key: "mkt_penetration",
    shortName: "Thâm nhập",
    tier: "marketing",
    statement:
      "Mở rộng tập thí sinh cân nhắc Học viện ra ngoài lõi Hà Nội – TP. Hồ Chí Minh",
    rationale:
      "Mùa 2026 có 154.016 thí sinh đăng ký lĩnh vực máy tính và công nghệ thông tin, theo công bố của Bộ Giáo dục và Đào tạo. Đây là tập cầu có sẵn, bài toán là giành phần trong đó chứ không phải tạo thêm nhu cầu. Các ngành mở năm 2026 và địa bàn ngoài lõi là khoảng trống thâm nhập rẻ nhất vì chưa trường nào sở hữu chúng trong tâm trí thí sinh — đúng ô thâm nhập thấp, cạnh tranh cao của ma trận bài 3.4: vào bằng lợi ích thực sự khác biệt, không lặp thông điệp của trường dẫn đầu.",
    theory: {
      concept: "Penetration — tỷ lệ người đã tham gia ngành hàng",
      origin:
        "Andrew S. C. Ehrenberg (phân rã hành vi mua); Everett M. Rogers và Frank M. Bass (khuếch tán đổi mới)",
      work: "Ehrenberg, Repeat-Buying: Theory and Applications (1972, tái bản 1988); Rogers, Diffusion of Innovations (1962); mô hình Bass (1969)",
      lesson: "3.2",
      caveat: null,
    },
    growthSource: "penetration",
    communicationGoal: null,
    parentKey: "biz_share",
    isFocus: false,
  },
  {
    key: "mkt_choice",
    shortName: "Lựa chọn",
    tier: "marketing",
    statement: "Trở thành lựa chọn ưu tiên, không phải phương án dự phòng",
    rationale:
      "Thí sinh xếp nguyện vọng theo thứ tự, nên phiếu nguyện vọng chính là giỏ hàng của bài 3.3 và thứ hạng Học viện chiếm trong đó mới là thị phần thật trong lựa chọn của người học. Phân biệt dứt khoát với thị phần nhập học: đó là thị phần kênh, còn đây là thị phần trong giỏ. Vì Học viện không dẫn đầu lĩnh vực, đây là nguồn tăng trưởng đúng đắn nhất — lấy phần từ đối thủ cụ thể thay vì mở rộng ngành hộ trường dẫn đầu.",
    theory: {
      concept: "Share of category requirements — thị phần trong giỏ hàng",
      origin:
        "Andrew S. C. Ehrenberg; Gerald J. Goodhardt và Christopher Chatfield (mô hình Dirichlet)",
      work: "Ehrenberg, Repeat-Buying (1972); Goodhardt, Ehrenberg & Chatfield, The Dirichlet: A Comprehensive Model of Buying Behaviour, Journal of the Royal Statistical Society A 147 (1984), tr. 621–655",
      lesson: "3.3",
      caveat:
        "Khác dứt khoát với market share: market share là thị phần kênh bán lẻ, còn chỉ số này là thị phần trong giỏ hàng của người tiêu dùng. Với tuyển sinh, giỏ hàng chính là phiếu nguyện vọng — nên thứ hạng nguyện vọng mới là phép đo đúng nghĩa, và nó còn nằm trong dữ liệu nội bộ.",
    },
    growthSource: "choice",
    communicationGoal: null,
    parentKey: "biz_share",
    isFocus: true,
  },
  {
    key: "mkt_consumption",
    shortName: "Lượng tiêu dùng",
    tier: "marketing",
    statement: "Nâng tỷ trọng tuyển sinh các hệ đào tạo giá trị cao",
    rationale:
      "Học phí hệ đại trà bị chặn bởi trần tăng theo quy định. Dịch cơ cấu sang hệ chất lượng cao và liên kết quốc tế là đòn giá trị còn dư địa — đúng phép premiumisation của bài 3.3, cùng số người học nhưng giá trị mỗi người cao hơn. Nửa còn lại của nguồn này, lượng dùng mỗi lần, chưa ánh xạ được sang đào tạo vì cần dữ liệu nội bộ về tín chỉ và học song ngành.",
    theory: {
      concept: "Consumption value — premiumisation",
      origin:
        "Michael J. Silverstein và Neil Fiske (trading up); Ehrenberg (lượng mua mỗi lần)",
      work: "Silverstein & Fiske, Trading Up (2003); Ehrenberg, Repeat-Buying (1972)",
      lesson: "3.3",
      caveat:
        "Chỉ nửa sau của khái niệm được đo. Nửa trước — consumption volume, tức lượng dùng mỗi lần — chưa ánh xạ được sang đào tạo vì cần dữ liệu nội bộ về tín chỉ và học song ngành.",
    },
    growthSource: "consumption",
    communicationGoal: null,
    parentKey: "biz_sale",
    isFocus: false,
  },
  {
    key: "mkt_frequency",
    shortName: "Tần suất",
    tier: "marketing",
    statement:
      "Xây đường ống học tiếp: đại học → sau đại học → đào tạo ngắn hạn",
    rationale:
      "Người học đại học chỉ mua một lần. Nguồn tăng trưởng theo tần suất chỉ mở ra khi họ quay lại bậc cao hơn hoặc khoá ngắn hạn tại Học viện. Lưu ý về kỳ vọng: trong truyền thống Ehrenberg-Bass, đây là nhánh có trần thấp nhất — tăng trưởng hầu như luôn đến từ thâm nhập, không từ tần suất. Xem docs/ly-thuyet/ibmc-xuat-xu-ly-thuyet.md §5.1.",
    theory: {
      concept: "Purchase frequency; mở rộng tổng cầu bằng dịp dùng mới",
      origin:
        "Philip Kotler và Kevin Lane Keller (chiến lược của nhãn dẫn đầu); Andrew S. C. Ehrenberg (tần suất mua)",
      work: "Kotler & Keller, Marketing Management, các chương về market leader; Ehrenberg, Repeat-Buying (1972)",
      lesson: "3.3",
      caveat:
        "Byron Sharp (How Brands Grow, 2010, Ehrenberg-Bass) PHẢN BÁC đòn này: tăng trưởng đến chủ yếu từ thâm nhập, vì thâm nhập dao động mạnh giữa các nhãn còn tần suất mua thì gần như không (double jeopardy). Đây là nhánh có trần thấp nhất — để kỳ vọng thấp. Thêm nữa, bài 3.3 cảnh báo chỉ thương hiệu DẪN ĐẦU mới nên giáo dục thị trường để tăng tần suất; Học viện không dẫn đầu lĩnh vực.",
    },
    growthSource: "frequency",
    communicationGoal: null,
    parentKey: "biz_growth",
    isFocus: false,
  },
  {
    key: "mkt_loyalty",
    shortName: "Trung thành",
    tier: "marketing",
    statement: "Giữ chân người học và biến cựu người học thành kênh tuyển sinh",
    rationale:
      "Tỷ lệ thôi học và tỷ lệ có việc làm là hai chỉ số buộc phải công khai, đồng thời là bằng chứng thuyết phục nhất cho thuộc tính thương hiệu. Giữ được người học và có cộng đồng nói thay là cách hạ chi phí trên mỗi người nhập học mà không cần thêm ngân sách — vì vậy mục tiêu này trỏ về nhánh lợi nhuận.",
    theory: {
      concept: "Loyalty, double jeopardy và giữ chân người dùng",
      origin: "Andrew S. C. Ehrenberg và Gerald J. Goodhardt; Byron Sharp",
      work: "Ehrenberg, Repeat-Buying (1972); Sharp, How Brands Grow (2010)",
      lesson: "3.3",
      caveat:
        "Theo Sharp, các chỉ số trung thành dao động rất ít giữa các thương hiệu và tỷ lệ rời bỏ giảm theo quy mô — tức trung thành phần lớn là HỆ QUẢ của quy mô, không phải nguyên nhân của tăng trưởng. Giữ nhánh này vì giữ chân người học có giá trị tự thân và hạ chi phí, nhưng đừng coi nó là nguồn tăng trưởng chính.",
    },
    growthSource: "loyalty",
    communicationGoal: null,
    parentKey: "biz_profit",
    isFocus: false,
  },

  // ── Tầng truyền thông ──────────────────────────────────────────────────────
  // Bốn chiều đánh giá của mọi chiến dịch (bài 5.1, 5.2). `parentKey` ở tầng này là
  // nhánh chịu ảnh hưởng chính, KHÔNG phải phạm vi áp dụng duy nhất.
  {
    key: "com_awareness",
    shortName: "Nhận biết",
    tier: "communication",
    statement:
      "Nâng mức độ nhận biết chủ động khi thí sinh nghĩ tới việc học công nghệ thông tin",
    rationale:
      "Thị phần tìm kiếm biến động theo tuần trong khi kết quả tuyển sinh mỗi năm mới có một lần — đây là tín hiệu sớm duy nhất lấy được miễn phí, và theo Les Binet (IPA, 2020) nó đi cùng thị phần đồng thời báo trước thay đổi thị phần vài tháng. Phải nói rõ đây là proxy của mức nhận biết tự nhiên đã chuyển thành hành vi, KHÔNG phải top of mind: ba mức nhận biết của bài 5.1 chỉ đo được bằng khảo sát thí sinh.",
    theory: {
      concept: "Brand awareness ba mức; share of search",
      origin:
        "David A. Aaker (tháp nhận biết); Les Binet (share of search); E. St. Elmo Lewis và Lavidge–Steiner (bậc nhận thức)",
      work: "Aaker, Managing Brand Equity (1991); Binet, EffWorks Global, IPA (2020); Lavidge & Steiner, Journal of Marketing 25 (1961), tr. 59–62",
      lesson: "5.1",
      caveat:
        "Ba mức nhận biết — top of mind, spontaneous, aided — chỉ đo được bằng KHẢO SÁT. Dashboard không có khảo sát nên mọi chỉ số ở đây là proxy hành vi tìm kiếm: thị phần tìm kiếm gần với nhận biết tự nhiên đã chuyển thành hành vi, lượt xem Wikipedia là mức chú ý thấp hơn nữa. Không được gọi chúng là top of mind. Binet cũng nói rõ share of search là chỉ số nhanh và rẻ, bằng chứng chỉ từ ba ngành, nên đọc như một điểm dữ liệu.",
    },
    growthSource: null,
    communicationGoal: "awareness",
    parentKey: "mkt_choice",
    isFocus: true,
  },
  {
    key: "com_attributes",
    shortName: "Thuộc tính thương hiệu",
    tier: "communication",
    statement:
      "Gắn Học viện với ba thuộc tính: trọng điểm quốc gia, gắn với doanh nghiệp, ra trường có việc làm",
    rationale:
      "Được nhắc tới nhiều mà không gắn thuộc tính nào thì không tạo ra lý do để chọn. Quy tắc của bài 5.1 là cặp TĂNG–GIỮ: tăng điểm thuộc tính đang nhắm trong khi không để tụt thuộc tính đang mạnh. Vì vậy ba thuộc tính phải xem được riêng từng cái — một tỷ lệ gộp sẽ giữ nguyên trong khi thương hiệu âm thầm đánh đổi thuộc tính này lấy thuộc tính khác.",
    theory: {
      concept: "Key attributes — points of parity và points of difference",
      origin:
        "Kevin Lane Keller (customer-based brand equity); David A. Aaker; Al Ries và Jack Trout (định vị)",
      work: "Keller, Conceptualizing, Measuring, and Managing Customer-Based Brand Equity, Journal of Marketing (1993); Aaker, Managing Brand Equity (1991); Ries & Trout, Positioning (1981)",
      lesson: "5.1",
      caveat:
        "Quy tắc là CẶP tăng–giữ, không bao giờ là một con số đơn lẻ: tăng điểm thuộc tính đang tấn công trong khi giữ điểm thuộc tính mình đang mạnh. Điểm thuộc tính gốc đo bằng báo cáo sức khoẻ thương hiệu; ở đây chỉ có proxy là tỷ lệ tin bài gắn thuộc tính.",
    },
    growthSource: null,
    communicationGoal: "attributes",
    parentKey: "mkt_choice",
    isFocus: false,
  },
  {
    key: "com_effectiveness",
    shortName: "Hiệu quả kênh",
    tier: "communication",
    statement:
      "Mở rộng độ phủ thông điệp sang đầu báo và nhóm ngành ngoài nhóm quen thuộc",
    rationale:
      "Không đo được tần suất tiếp cận vì không có tài khoản quảng cáo, nên thay bằng độ rộng nguồn đưa tin và cơ cấu chủ đề được nhắc — thứ quan sát được từ bên ngoài. Cặp chỉ số gốc của bài 5.2 là share of spend đặt cạnh share of voice; nửa chi tiêu không đo được vì không biết ngân sách của trường khác, nên chỉ còn nửa tiếng nói và phải đọc với giới hạn đó.",
    theory: {
      concept: "Share of voice đặt cạnh share of spend; excess share of voice",
      origin: "John Philip Jones; Les Binet và Peter Field",
      work: "Jones, Ad Spending: Maintaining Market Share, Harvard Business Review (1990); Binet & Field, The Long and the Short of It, IPA (2013) — phân tích 996 chiến dịch",
      lesson: "5.2",
      caveat:
        "Binet & Field lượng hoá: mỗi 10 điểm excess share of voice ứng với khoảng +0,5 điểm thị phần mỗi năm, nhưng hiệu lực này đang yếu dần theo các nghiên cứu sau. Với Học viện, nửa share of spend KHÔNG đo được vì không biết ngân sách của trường khác — nên cặp chỉ số gốc chỉ còn một nửa.",
    },
    growthSource: null,
    communicationGoal: "effectiveness",
    parentKey: "mkt_penetration",
    isFocus: false,
  },
  {
    key: "com_creative",
    shortName: "Chất lượng sáng tạo",
    tier: "communication",
    statement: "Nội dung tự giữ được người xem mà không cần chi tiền phân phối",
    rationale:
      "Khung gốc đo tầng này bằng link test của Millward Brown: điểm thuyết phục phải nằm trong top 30% của ngành hàng, cộng ba thành phần enjoyment, active engagement và branding. Không có ngân sách pre-test nên chỉ còn các tín hiệu hành vi trên nội dung đã phát. Giữ mục tiêu này trong cascade để không quên rằng chất lượng sáng tạo là một tầng riêng, không phải hệ quả của tầng khác.",
    theory: {
      concept: "Creative quality — link test, branding index, purchase intent",
      origin:
        "Russell H. Colley (DAGMAR); Robert J. Lavidge và Gary A. Steiner; Gordon Brown và Millward Brown (hệ Link); Daniel Starch (đo nhớ quảng cáo)",
      work: "Colley, Defining Advertising Goals for Measured Advertising Results, Association of National Advertisers (1961); Lavidge & Steiner, Journal of Marketing 25 (1961); Gordon Brown, The Link between Sales Effects and Advertising Content (1987), hệ Link ra mắt 1988–1989",
      lesson: "5.2",
      caveat:
        "Colley lập luận KHÔNG nên đặt mục tiêu quảng cáo bằng doanh số, vì quảng cáo chỉ là một phần của marketing mix — đó là lý do tầng truyền thông phải có mục tiêu riêng. Hệ quả thực hành: không gán KPI doanh số cho một chiến dịch. Link test cần ngân sách pre-test mà nhiệm vụ không có, nên ở đây chỉ còn tín hiệu hành vi trên nội dung đã phát.",
    },
    growthSource: null,
    communicationGoal: "creative",
    parentKey: "mkt_loyalty",
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
    objectiveKey: "biz_sale",
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
    objectiveKey: "mkt_choice",
    tier: "marketing",
    value: null,
    unit: "score",
    target: 0.5,
    baseline: null,
    higherIsBetter: true,
    cadence: "annual",
    provenance: SOURCE_ADMISSION_SCHEME,
    hint: "Thí sinh sẵn sàng đánh đổi bao nhiêu điểm để vào Học viện thay vì trường khác.",
    comparability: {
      basis: "calendar",
      caveat:
        "So theo NĂM tuyển sinh. Cơ cấu ngành mỗi trường một khác nên đọc theo XU HƯỚNG qua các năm, không đọc như một mức tuyệt đối. Chỉ tính trường công bố từ 10 ngành trở lên.",
    },
    targetRationale: {
      basis: "pending_approval",
      note: "Năm 2025 Học viện bình quân 24,02 điểm, Trường ĐH Công nghệ 25,75 — chênh −1,73. Đặt mục tiêu +0,5 điểm là đảo chiều chênh lệch, cần Học viện xác nhận có khả thi trong một mùa hay không.",
    },
  },
  {
    key: "admission_quota",
    label: "Chỉ tiêu tuyển sinh đại học chính quy",
    objectiveKey: "biz_sale",
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
    objectiveKey: "biz_share",
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
    objectiveKey: "biz_sale",
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
      benchmark: {
        coverage: "us_only",
        note: "Học phí mới có số ở 3 trên 7 dòng đối sánh. Bốn dòng còn lại KHÔNG phải chưa làm mà là nguồn không cho máy đọc: đề án hệ chính quy của Học viện là ảnh scan, còn bảng học phí của Bách khoa Hà Nội, Trường ĐH Công nghệ và FPT do JavaScript dựng nên HTML tĩnh không có con số nào. Phải nhập tay kèm đường dẫn nguồn. Vì vậy chưa có thị phần GIÁ TRỊ, mới chỉ có thị phần sản lượng.",
      },
    },
    hint: "Doanh số giá trị. Đây là con số ƯỚC TÍNH theo mô hình khoá học, chưa phải số quyết toán.",
  },
  {
    key: "high_value_mix",
    label: "Tỷ trọng nhập học hệ giá trị cao",
    objectiveKey: "mkt_consumption",
    tier: "marketing",
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
    objectiveKey: "mkt_loyalty",
    tier: "marketing",
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
    objectiveKey: "mkt_loyalty",
    tier: "marketing",
    // Giá trị thật do PostgresKpiRepository đọc từ mart__disclosure_benchmark ghi đè.
    value: null,
    unit: "percent",
    target: 95,
    baseline: null,
    higherIsBetter: true,
    cadence: "annual",
    provenance: SOURCE_PUBLIC_DISCLOSURE,
    comparability: {
      basis: "calendar",
      caveat:
        "So giữa hai NĂM HỌC gần nhất CÓ SỐ, không phải hai năm liền kề theo lịch: có năm Học viện bỏ trống ô này.",
    },
    targetRationale: {
      basis: "internal_benchmark",
      note: "Bách khoa Hà Nội đạt 94,61% ở năm học 2022-2023 — lấy mốc 95% để không thấp hơn trường dẫn đầu nhóm đối sánh.",
    },
    hint: "Bằng chứng thuyết phục nhất cho thuộc tính thương hiệu, và là số buộc phải công khai nên đối thủ cũng có.",
  },
  {
    key: "postgrad_intake_share",
    label: "Tỷ lệ nhập học sau đại học trên nhập học đại học",
    objectiveKey: "mkt_frequency",
    tier: "marketing",
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
    objectiveKey: "com_awareness",
    tier: "communication",
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
    objectiveKey: "com_awareness",
    tier: "communication",
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
    objectiveKey: "com_effectiveness",
    tier: "communication",
    // Giá trị thật do PostgresKpiRepository đọc từ mart__share_of_voice ghi đè.
    value: null,
    unit: "percent",
    target: 25,
    baseline: null,
    higherIsBetter: true,
    cadence: "daily",
    provenance: SOURCE_NEWS_CRAWLER,
    comparability: {
      basis: "admission_cycle",
      caveat:
        "Tin bài dồn vào mùa tuyển sinh nên phải so tháng với tháng trong cùng mùa. Chỉ xét tháng đủ mẫu (từ 20 lần nhắc trở lên): tháng lác đác vài bài cho ra tỷ trọng nhảy loạn.",
    },
    targetRationale: {
      basis: "pending_approval",
      note: "Chia đều cho 6 trường là 16,7%. Tháng 7/2026 Học viện đạt 18,94% — trên mức ngang bằng nhưng kém xa Bách khoa Hà Nội 59,85%. Đặt 25% làm bước tiến vừa sức, chờ Học viện chốt lại sau một mùa đủ dữ liệu.",
    },
  },

  {
    key: "new_program_share",
    label: "Tỷ trọng tin bài nhắc nhóm ngành mới",
    objectiveKey: "com_effectiveness",
    tier: "communication",
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
    objectiveKey: "com_effectiveness",
    tier: "communication",
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
    objectiveKey: "com_effectiveness",
    tier: "communication",
    value: null,
    unit: "count",
    target: 500,
    baseline: null,
    higherIsBetter: true,
    cadence: "daily",
    provenance: {
      label:
        "Bình luận công khai trên báo và diễn đàn — cần mở rộng crawler sang nguồn diễn đàn",
      benchmark: {
        coverage: "partial",
        note: "Crawler quét tin bài nhắc cả 6 trường, nhưng nguồn diễn đàn chưa mở và lượt nhắc từ cộng đồng người học của trường khác chưa tách riêng được.",
      },
    },
  },

  // ── Truyền thông ───────────────────────────────────────────────────────────
  {
    key: "brand_search_index",
    label: "Lượt tra cứu Học viện trên Wikipedia mỗi tuần",
    objectiveKey: "com_awareness",
    tier: "communication",
    // Trước đây chỉ số này lấy thang 0–100 của Google Trends. Google chặn hoàn toàn
    // (HTTP 429 ở mọi lần thử), nên giữ nguyên con số cũ là hiện số của một nguồn
    // không còn truy cập được. Đổi sang lượt xem trang Wikipedia: hẹp hơn về nhóm
    // công chúng, nhưng là SỐ ĐẾM TUYỆT ĐỐI nên so được giữa các năm.
    value: null,
    unit: "count",
    target: 300,
    baseline: null,
    higherIsBetter: true,
    cadence: "weekly",
    provenance: SOURCE_WIKIPEDIA,
    comparability: {
      basis: "admission_cycle",
      caveat:
        "Là chỉ số tuyệt đối nên đỉnh mùa tuyển sinh chi phối hoàn toàn — phải neo vào mốc công bố điểm thi, không so cùng tuần theo lịch.",
    },
    targetRationale: {
      basis: "historical_peak",
      note: "Tuần cao nhất trong 26 tuần đã đo đạt khoảng 300 lượt. Lấy chính mức đó làm mục tiêu duy trì, chờ đủ một mùa tuyển sinh để đặt lại.",
    },
    hint: "Số đếm tuyệt đối, đã loại lượt truy cập của bot (agent=user).",
  },
  {
    key: "positive_sentiment_share",
    label: "Tỷ lệ tin bài tích cực",
    objectiveKey: "com_attributes",
    tier: "communication",
    // Giá trị do `PostgresKpiRepository` đọc từ `mart__news_sentiment` ghi đè lúc chạy.
    // Để `null` ở đây là đúng: đây là phần CẤU TRÚC, không phải phần số đo.
    value: null,
    unit: "percent",
    target: 60,
    baseline: null,
    higherIsBetter: true,
    cadence: "daily",
    provenance: SOURCE_NEWS_CRAWLER,
    targetRationale: {
      basis: "trend_continuation",
      note: "Đo được 56,9% trên 239 bài đã gán nhãn (PhoBERT). Đặt 60% là nhích nhẹ trên mức hiện tại — mức 75% ban đầu không có căn cứ nào, và không đạt được với dòng tin điểm chuẩn vốn trung tính theo bản chất.",
    },
    comparability: {
      basis: "admission_cycle",
      caveat:
        "Mốc gốc là tháng đầu chuỗi. Lượng tin bài dồn vào mùa công bố điểm chuẩn (tháng 7-8), nên so hai tháng bất kỳ trong năm là so hai mùa khác nhau — đọc kèm cột số bài của từng tháng.",
    },
    hint: "Báo chí đưa tin điểm chuẩn và thông báo tuyển sinh nên phần lớn bài là trung tính. Tỷ lệ tích cực thấp hơn mạng xã hội là bình thường, không phải dấu hiệu xấu.",
  },
  {
    key: "social_positive_sentiment_share",
    label: "Tỷ lệ thảo luận tích cực của người ngoài",
    objectiveKey: "com_attributes",
    tier: "communication",
    value: null,
    unit: "percent",
    target: 75,
    baseline: null,
    higherIsBetter: true,
    cadence: "daily",
    provenance: SOURCE_SOCIAL_LISTENING,
    targetRationale: {
      basis: "trend_continuation",
      note: "Đo được 80,0% trên 90 thảo luận (ViSoBERT). Đặt 75% làm ngưỡng cảnh báo: tụt xuống dưới mức này là dấu hiệu dư luận đang xấu đi, chứ không phải mục tiêu phải vượt.",
    },
    comparability: {
      basis: "calendar",
      caveat:
        "Mẫu quá mỏng để so hai tháng với nhau: có tháng chỉ 1-2 thảo luận, khi đó tỷ lệ chỉ phản ánh đúng một người. Chỉ so khi cả hai tháng đều đạt tối thiểu 10 thảo luận.",
    },
    hint: "Mẫu còn mỏng (90 thảo luận trong một năm) — đọc kèm số lượng, đừng đọc riêng tỷ lệ.",
  },
  {
    key: "attribute_coverage",
    label: "Tỷ lệ tin bài gắn ít nhất một thuộc tính mục tiêu (số gộp)",
    objectiveKey: "com_attributes",
    tier: "communication",
    value: null,
    unit: "percent",
    target: 45,
    baseline: null,
    higherIsBetter: true,
    cadence: "daily",
    provenance: SOURCE_NEWS_CRAWLER,
    hint: "Số GỘP, không phát hiện được việc đánh đổi giữa các thuộc tính: tỷ lệ này giữ nguyên trong khi tin bài chuyển hết từ thuộc tính này sang thuộc tính khác. Luôn đọc cùng ba chuỗi attribute_* tách riêng. Cần bổ sung bước trích thuộc tính vào worker/nlp.",
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
    objectiveKey: "mkt_penetration",
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
    objectiveKey: "mkt_penetration",
    tier: "marketing",
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
    objectiveKey: "mkt_choice",
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
    objectiveKey: "mkt_penetration",
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
    objectiveKey: "mkt_consumption",
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
  // ── Tăng trưởng: thương hiệu LUÔN đặt cạnh ngành (bài 2.3) ─────────────────
  {
    key: "enrolment_growth",
    label: "Tăng trưởng nhập học của Học viện",
    objectiveKey: "biz_growth",
    tier: "business",
    value: null,
    unit: "percent",
    target: 8,
    baseline: null,
    higherIsBetter: true,
    cadence: "annual",
    provenance: SOURCE_PUBLIC_DISCLOSURE,
    targetRationale: {
      basis: "pending_approval",
      note: "Đề xuất 8%: cao hơn mức tăng khoảng 6,5%/năm của lĩnh vực để đủ điều kiện tăng thị phần, cộng một biên an toàn. Chốt lại khi bóc được số nhập học thật của hai mùa liên tiếp.",
    },
    hint: "Con số này một mình không nói được gì. Luôn đọc cùng category_enrolment_growth — tăng mà chậm hơn lĩnh vực là đang mất thị phần.",
  },
  {
    key: "category_enrolment_growth",
    label:
      "Tăng trưởng số thí sinh đăng ký lĩnh vực máy tính và công nghệ thông tin",
    objectiveKey: "biz_growth",
    tier: "business",
    value: null,
    unit: "percent",
    // Cố ý KHÔNG đặt mức cần đạt: đây là mốc so của thị trường, không phải cam kết
    // của Học viện. Đặt mục tiêu cho tốc độ tăng của cả lĩnh vực là nhận một việc
    // không thuộc thẩm quyền mình.
    target: null,
    baseline: null,
    higherIsBetter: true,
    cadence: "annual",
    provenance: SOURCE_MINISTRY_STATS,
    comparability: {
      basis: "admission_cycle",
      caveat:
        "Bộ công bố 2024 theo tỷ trọng NHẬP HỌC (hơn 10%), còn 2026 theo tỷ trọng ĐĂNG KÝ (gần 18%). Hai cách đo khác mẫu số — đọc 10% lên 18% thành tăng trưởng là kết luận sai. Chỉ so khi hai mùa cùng một cách đo.",
    },
    hint: "Mùa 2026: 154.016 THÍ SINH đăng ký lĩnh vực này (gần 18% tổng thí sinh xét tuyển), hơn 415.000 nguyện vọng — đã xác minh trên trang của Bộ. Đơn vị phải là THÍ SINH chứ không phải nguyện vọng: thị phần nhập học đếm người, trộn hai đơn vị là sai mẫu số. Còn thiếu đúng một thứ để tính được tăng trưởng: con số cùng cách đo của mùa trước.",
  },
  {
    key: "growth_vs_category_gap",
    label: "Chênh lệch tăng trưởng của Học viện so với lĩnh vực",
    objectiveKey: "biz_growth",
    tier: "business",
    value: null,
    unit: "percent",
    target: 1,
    baseline: null,
    higherIsBetter: true,
    cadence: "annual",
    provenance: SOURCE_MINISTRY_STATS,
    targetRationale: {
      basis: "pending_approval",
      note: "Đề xuất tối thiểu +1 điểm phần trăm. Không đặt mục tiêu bằng 0 vì 0 chỉ là ngưỡng giữ nguyên thị phần, và tỷ lệ hoàn thành không tính được khi mục tiêu bằng 0.",
    },
    hint: "DẤU của chỉ số này là dấu của thị phần: dương là đang giành thêm, âm là đang mất dù nhập học vẫn tăng. Đây là chỉ số chặn ô nguy hiểm nhất của ma trận tăng trưởng.",
  },
  {
    key: "tuition_value_growth_real",
    label: "Tăng trưởng doanh thu học phí sau khi trừ trần học phí và lạm phát",
    objectiveKey: "biz_growth",
    tier: "business",
    value: null,
    unit: "percent",
    target: 3,
    baseline: null,
    higherIsBetter: true,
    cadence: "annual",
    provenance: SOURCE_PUBLIC_DISCLOSURE,
    targetRationale: {
      basis: "pending_approval",
      note: "Đề xuất 3% tăng trưởng THỰC. Bài 2.3 buộc trừ lạm phát khỏi tăng trưởng giá trị; ở đây trừ thêm phần tăng do trần học phí cho phép, vì trượt theo trần không phải thành tích marketing.",
    },
    hint: "Doanh thu tăng 10% trong năm trần cho phép tăng 15% mà nhập học không tăng nghĩa là tăng trưởng thực đang âm.",
  },

  // ── Lợi nhuận: hiệu quả của mỗi đồng chi (bài 2.5) ─────────────────────────
  {
    key: "cost_per_enrolment",
    label: "Chi phí truyền thông trên mỗi người nhập học",
    objectiveKey: "biz_profit",
    tier: "business",
    value: null,
    unit: "currency",
    target: null,
    baseline: null,
    higherIsBetter: false,
    cadence: "annual",
    provenance: SOURCE_INTERNAL_BUDGET,
    hint: "Chưa chốt mức cần đạt vì chưa có mùa nào đo được. Phải có một mùa làm gốc trước khi cam kết giảm — cam kết trước khi biết mức nền là con số không có căn cứ.",
  },
  {
    key: "cost_per_consideration",
    label: "Chi phí trên mỗi lượt xem trang quyết định chọn trường",
    objectiveKey: "biz_profit",
    tier: "business",
    value: null,
    unit: "currency",
    target: null,
    baseline: null,
    higherIsBetter: false,
    cadence: "annual",
    provenance: SOURCE_INTERNAL_BUDGET,
    hint: "Mẫu số đã đo được bằng GA4 (admission_consideration_views); chỉ còn thiếu tử số là chi phí từ dự toán.",
  },
  {
    key: "marketing_budget_ratio",
    label: "Ngân sách truyền thông tuyển sinh trên doanh thu học phí",
    objectiveKey: "biz_profit",
    tier: "business",
    value: null,
    unit: "percent",
    target: 5,
    baseline: null,
    higherIsBetter: true,
    cadence: "annual",
    provenance: SOURCE_INTERNAL_BUDGET,
    targetRationale: {
      basis: "pending_approval",
      note: "Bài 2.5 ghi mức thông lệ của ngành hàng tiêu dùng nhanh là 5–10% doanh số. Lấy biên dưới 5% làm mức tham chiếu: dưới mức đó nghĩa là thương hiệu được cấp vốn mỏng hơn thông lệ. Đây là con số để tranh luận ngân sách, không phải cam kết chi tiêu.",
    },
    hint: "Đo mức đầu tư, KHÔNG đo hiệu quả. Phải đọc cùng cost_per_enrolment, nếu không thì chi nhiều cũng thành thành tích.",
  },

  // ── Thuộc tính thương hiệu, tách theo TỪNG thuộc tính (bài 5.1) ────────────
  // Quy tắc cặp tăng–giữ chỉ đọc được khi ba chuỗi này nằm cạnh nhau: tăng cái đang
  // nhắm trong khi không để tụt hai cái còn lại.
  {
    key: "attribute_national_key",
    label: "Tỷ lệ tin bài gắn thuộc tính trọng điểm quốc gia",
    objectiveKey: "com_attributes",
    tier: "communication",
    value: null,
    unit: "percent",
    target: null,
    baseline: null,
    higherIsBetter: true,
    cadence: "daily",
    provenance: SOURCE_NEWS_CRAWLER,
    hint: "Chưa đặt mức cần đạt: cần một mùa dữ liệu làm gốc, và mức của từng thuộc tính phải đặt cùng lúc với hai thuộc tính kia để không tự đánh đổi. Hiện chưa tháng nào đủ mẫu — đọc tỷ lệ phải đọc kèm số bài xét.",
  },
  {
    key: "attribute_industry_link",
    label: "Tỷ lệ tin bài gắn thuộc tính gắn với doanh nghiệp",
    objectiveKey: "com_attributes",
    tier: "communication",
    value: null,
    unit: "percent",
    target: null,
    baseline: null,
    higherIsBetter: true,
    cadence: "daily",
    provenance: SOURCE_NEWS_CRAWLER,
    hint: "Thuộc tính này là điểm khác biệt khả thi nhất so với nhóm trường kỹ thuật lâu năm — nên nó là ứng viên cho vai trò thuộc tính cần TĂNG.",
  },
  {
    key: "attribute_employability",
    label: "Tỷ lệ tin bài gắn thuộc tính ra trường có việc làm",
    objectiveKey: "com_attributes",
    tier: "communication",
    value: null,
    unit: "percent",
    target: null,
    baseline: null,
    higherIsBetter: true,
    cadence: "daily",
    provenance: SOURCE_NEWS_CRAWLER,
    hint: "Có bằng chứng cứng để hậu thuẫn: employment_rate là số buộc phải công khai. Thuộc tính có bằng chứng thì rẻ hơn khi xây.",
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
    todo: "Crawler và bộ bóc Biểu 18 đã chạy, nhưng biểu mẫu này KHÔNG có ô số nhập học so với chỉ tiêu — phải bóc thêm bảng kết quả tuyển sinh trong đề án tuyển sinh",
  },
  score_premium: {
    platform: "Trang công bố điểm chuẩn của từng trường",
    fields: ["điểm chuẩn theo ngành (thang 30)", "mã ngành", "năm"],
    readiness: "connected",
    todo: "Mới khai được trang của Học viện và Trường ĐH Công nghệ. Bách khoa Hà Nội không truy cập được, UIT dựng bảng bằng JavaScript, Mật mã công bố dạng danh sách trúng tuyển, FPT xét học bạ nên không có thang 30",
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
    todo: "Biểu 18 cho quy mô đào tạo chứ không cho số nhập học mới; cần bóc bảng kết quả tuyển sinh trong đề án, và còn thiếu FPT nên mẫu số chưa đủ",
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
    todo: "Crawler tài liệu công khai đã chạy, nhưng bản Biểu 18 các trường đang đăng theo mẫu Thông tư 36/2017 không có ô này — cần bản theo mẫu Thông tư 09/2024",
  },
  employment_rate: {
    platform: "Biểu mẫu 18 trên trang công khai của Học viện",
    fields: [
      "tỷ lệ có việc làm 12 tháng sau tốt nghiệp",
      "số sinh viên tốt nghiệp theo khối ngành",
    ],
    readiness: "connected",
    todo: "Biểu mẫu của Học viện bỏ trống ô tỷ lệ ở dòng tổng nên con số là bình quân gia quyền tính từ các khối ngành — đề nghị Học viện công bố thẳng dòng tổng",
  },
  postgrad_intake_share: {
    platform: "Trang Ba công khai của Học viện",
    fields: ["số nhập học mới theo từng trình độ đào tạo"],
    readiness: "needs_build",
    todo: "Crawler tài liệu công khai đã chạy, nhưng bản Biểu 18 các trường đang đăng theo mẫu Thông tư 36/2017 không có ô này — cần bản theo mẫu Thông tư 09/2024",
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
    todo: null,
  },
  share_of_voice: {
    platform: "Crawler tin bài + gán nhãn thương hiệu",
    fields: [
      "url, publisher, published_at",
      "brands — danh sách trường được nhắc trong bài",
      "is_owned — tách bài trên kênh của Học viện",
    ],
    readiness: "connected",
    todo: null,
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
    platform: "Wikimedia Pageviews API",
    fields: ["lượt xem trang của riêng Học viện, gộp theo tuần"],
    readiness: "connected",
    todo: null,
  },
  positive_sentiment_share: {
    platform: "PhoBERT chấm trên kho tin bài",
    fields: ["sentiment_score", "model_version", "scored_at"],
    readiness: "connected",
    todo: null,
  },
  social_positive_sentiment_share: {
    platform: "ViSoBERT chấm trên kho thảo luận mạng xã hội",
    fields: ["sentiment_score", "model_version", "scored_at"],
    readiness: "connected",
    todo: null,
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
    // Đã xong: phân nhóm nằm ở seed `dbt/seeds/nhom_nganh_dao_tao.csv` (20 ngành),
    // model `mart__program_demand` join vào seed đó chứ không khớp chuỗi trong truy vấn.
    // Mở ngành mới chỉ cần thêm một dòng CSV.
    todo: null,
  },
  high_value_program_interest: {
    platform: "Google Analytics 4 — Data API (đã kết nối)",
    fields: [
      "ga4_pages_daily.pagePath khớp he-clc / chat-luong-cao / lien-ket / quoc-te",
      "screenPageViews luỹ kế theo năm",
    ],
    readiness: "connected",
    // Đã đối chiếu bằng chính dữ liệu GA4 thay vì chờ đề án (đề án của Học viện là
    // bản scan). Phát hiện mart chỉ lọc đường dẫn dạng `/nganh-*` nên bỏ 27,4%
    // lượt xem — gồm đúng các chương trình cần đo. Đã sửa bộ lọc và bổ sung 17
    // chương trình vào seed; tỷ trọng hệ giá trị cao từ 8,94% lên 10,99%.
    todo: null,
  },
  enrolment_growth: {
    platform: "Trang Ba công khai và đề án tuyển sinh của Học viện",
    fields: ["số nhập học mới theo mùa", "năm tuyển sinh"],
    readiness: "needs_build",
    todo: "Cần số nhập học thật của ít nhất hai mùa liên tiếp; Biểu 18 cho quy mô đào tạo chứ không cho số nhập học mới nên phải bóc bảng kết quả trong đề án",
  },
  category_enrolment_growth: {
    platform: "Công bố thống kê tuyển sinh của Bộ Giáo dục và Đào tạo",
    fields: [
      "số nguyện vọng đăng ký theo lĩnh vực",
      "mã lĩnh vực (máy tính và công nghệ thông tin)",
      "năm",
    ],
    readiness: "needs_build",
    todo: "Số liệu công bố rải trong các bản tin và họp báo tuyển sinh, không có một bảng ổn định theo năm — cần bóc tay rồi lưu lại thành chuỗi",
  },
  growth_vs_category_gap: {
    platform: "Tính từ hai chỉ số tăng trưởng đã có",
    fields: ["enrolment_growth", "category_enrolment_growth"],
    readiness: "needs_build",
    todo: "Chỉ là phép trừ, nhưng chỉ có nghĩa khi cả hai chỉ số nguồn cùng có số thật — không được tính khi một bên còn là ước lượng",
  },
  tuition_value_growth_real: {
    platform: "Biểu 18, quyết định học phí, và chỉ số giá tiêu dùng",
    fields: [
      "doanh thu học phí theo năm",
      "mức trần tăng học phí được phép",
      "CPI theo năm",
    ],
    readiness: "needs_build",
    todo: "Ba nguồn khác nhau phải khớp cùng một năm tài chính; CPI lấy từ công bố của Tổng cục Thống kê",
  },
  cost_per_enrolment: {
    platform: "Dự toán nội bộ, cần quyền truy cập",
    fields: ["kinh phí truyền thông tuyển sinh theo mùa", "số nhập học"],
    readiness: "needs_access",
    todo: "Phải được Học viện đồng ý cung cấp số dự toán và quyết toán phần truyền thông tuyển sinh; không có nguồn công khai nào thay thế được",
  },
  cost_per_consideration: {
    platform: "Dự toán nội bộ ghép với GA4",
    fields: ["kinh phí truyền thông theo kỳ", "lượt xem trang quyết định"],
    readiness: "needs_access",
    todo: "Mẫu số đã có từ GA4; chờ số chi phí. Khi ghép phải cùng cửa sổ thời gian, và cửa sổ phải neo theo mốc chu kỳ tuyển sinh chứ không theo lịch",
  },
  marketing_budget_ratio: {
    platform: "Dự toán nội bộ ghép với doanh thu học phí",
    fields: ["kinh phí truyền thông tuyển sinh", "doanh thu học phí"],
    readiness: "needs_access",
    todo: "Chờ số dự toán. Doanh thu học phí hiện là số ước tính từ chỉ tiêu và học phí công bố, nên tỷ lệ này sẽ là ước lượng cho tới khi có số quyết toán",
  },
  attribute_national_key: {
    platform: "Kho tin bài của worker",
    fields: ["nội dung bài", "nhãn thuộc tính", "ngày xuất bản"],
    readiness: "public_ready",
    todo: "Bước trích thuộc tính đã chạy và mart__brand_attribute đã có; nút thắt nay là MẪU — chỉ 76 trên 1.748 tin bài có toàn văn, 1.526 bài từ nhánh google_news không có url để lấy lại, nên chưa tháng nào đủ mẫu",
  },
  attribute_industry_link: {
    platform: "Kho tin bài của worker",
    fields: ["nội dung bài", "nhãn thuộc tính", "ngày xuất bản"],
    readiness: "public_ready",
    todo: "Bước trích thuộc tính đã chạy; chờ kho đủ bài có toàn văn để tháng nào đó đạt ngưỡng mẫu",
  },
  attribute_employability: {
    platform: "Kho tin bài của worker",
    fields: ["nội dung bài", "nhãn thuộc tính", "ngày xuất bản"],
    readiness: "public_ready",
    todo: "Bước trích thuộc tính đã chạy; chờ kho đủ bài có toàn văn để tháng nào đó đạt ngưỡng mẫu",
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
    positive:
      "Tăng: thí sinh trúng tuyển thật sự chọn Học viện — nguồn Lựa chọn đang mạnh lên.",
    negative:
      "Giảm: Học viện đang là phương án dự phòng, mở thêm chỉ tiêu sẽ không lấp đầy.",
  },
  score_premium: {
    positive:
      "Dương và tăng: thí sinh chấp nhận đánh đổi điểm cao hơn để vào Học viện.",
    negative: "Âm hoặc giảm: cùng mức điểm, thí sinh chọn trường khác trước.",
  },
  admission_quota: {
    positive:
      "Tăng: mở rộng được quy mô — nhưng chỉ có nghĩa khi tỷ lệ nhập học giữ được mức cao.",
    negative:
      "Tăng mà tỷ lệ nhập học giảm: đang mở cung nhanh hơn cầu thương hiệu.",
  },
  enrolment_share: {
    positive:
      "Tăng: giành được phần trong nhóm đối sánh, không chỉ lớn lên theo thị trường.",
    negative: "Giảm: quy mô có thể vẫn tăng nhưng đối thủ tăng nhanh hơn.",
  },
  tuition_revenue: {
    positive:
      "Tăng: nguồn lực tái đầu tư cho đào tạo và cơ sở vật chất tăng theo.",
    negative:
      "Giảm: hoặc hụt sản lượng, hoặc cơ cấu dịch về phía hệ học phí thấp.",
  },
  high_value_mix: {
    positive:
      "Tăng: người học chấp nhận trả cao hơn cho hệ đào tạo tốt hơn — giá trị được công nhận.",
    negative:
      "Giảm: chênh lệch học phí đang bị đọc là rào cản chứ không phải tín hiệu chất lượng.",
  },
  dropout_rate: {
    positive:
      "Giảm: giữ được người học, đồng thời là bằng chứng cho thuộc tính chất lượng đào tạo.",
    negative:
      "Tăng: mất doanh thu đã có và sinh ra tiếng xấu lan trong cộng đồng thí sinh.",
  },
  employment_rate: {
    positive:
      "Tăng: củng cố thuộc tính 'ra trường có việc' — lý do chọn trường mạnh nhất.",
    negative:
      "Giảm: mất luận điểm thuyết phục nhất trong mọi thông điệp tuyển sinh.",
  },
  postgrad_intake_share: {
    positive:
      "Tăng: người học quay lại — nguồn tăng trưởng theo tần suất bắt đầu chạy.",
    negative: "Giảm: quan hệ với người học kết thúc ngay khi tốt nghiệp.",
  },
  share_of_search: {
    positive:
      "Tăng: Học viện đang chiếm chỗ trong tập cân nhắc trước mùa xét tuyển.",
    negative:
      "Giảm: sẽ thấy hậu quả ở tỷ lệ nhập học của mùa sau, khi đó sửa đã muộn.",
  },
  attention_share: {
    positive:
      "Tăng: nhiều người chủ động tra cứu về Học viện hơn so với năm trường còn lại — dấu hiệu sớm của việc được đưa vào tập cân nhắc.",
    negative:
      "Giảm: sự chú ý đang dồn sang trường khác. Số liệu thật kỳ 26/01–20/07/2026 cho thấy Học viện mất 3,50 điểm thị phần trong khi Bách khoa Hà Nội tăng 17,56 điểm.",
  },
  share_of_voice: {
    positive:
      "Tăng: hiện diện trên báo chí nhiều hơn nhóm đối sánh, không tốn ngân sách quảng cáo.",
    negative: "Giảm: đối thủ đang dẫn dắt câu chuyện ngành thay cho Học viện.",
  },
  new_program_share: {
    positive:
      "Tăng: các ngành mới bắt đầu có chỗ đứng riêng thay vì núp bóng tên trường.",
    negative:
      "Thấp: mở ngành mới nhưng không ai biết, chỉ tiêu mới sẽ khó lấp đầy.",
  },
  value_program_share: {
    positive:
      "Tăng: giá trị hệ đào tạo cao được kể ra ngoài, đỡ cho việc giải thích học phí.",
    negative: "Thấp: học phí cao xuất hiện trần trụi mà không kèm lý do.",
  },
  advocacy_mentions: {
    positive:
      "Tăng: cộng đồng người học tự nói thay — kênh đáng tin nhất và rẻ nhất.",
    negative:
      "Giảm: mọi thông điệp đều phải do Học viện tự phát, độ tin cậy thấp hơn.",
  },
  brand_search_index: {
    positive:
      "Tăng: nhiều người chủ động tìm tên Học viện hơn — nhận biết đang lên.",
    negative: "Giảm: rơi khỏi tầm chú ý, thường xảy ra ngoài mùa truyền thông.",
  },
  positive_sentiment_share: {
    positive: "Tăng: được nhắc tới nhiều đi kèm được nhắc tới tốt.",
    negative: "Giảm: hiện diện tăng mà sắc thái xấu đi còn hại hơn im lặng.",
  },
  social_positive_sentiment_share: {
    positive:
      "Tăng: người ngoài nói về Học viện theo hướng tốt — thứ không mua được bằng ngân sách truyền thông.",
    negative:
      "Giảm: dư luận đang xấu đi. Đọc thẳng các bình luận tiêu cực để biết vì sao, đừng chỉ nhìn tỷ lệ.",
  },
  attribute_coverage: {
    positive:
      "Tăng: tin bài không chỉ nhắc tên mà còn gắn đúng ba thuộc tính mục tiêu.",
    negative: "Thấp: được nhắc nhiều nhưng không đọng lại lý do nào để chọn.",
  },
  publisher_breadth: {
    positive:
      "Tăng: thoát khỏi vòng vài đầu báo quen, chạm được nhóm công chúng mới.",
    negative:
      "Giảm: tin bài dồn vào ít nguồn, độ phủ thật hẹp hơn con số tổng lượt nhắc.",
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
  enrolment_growth: {
    positive:
      "Tăng: quy mô đang lớn lên — nhưng chỉ là tin tốt khi so được với tốc độ của lĩnh vực.",
    negative:
      "Giảm: hụt sản lượng, và nếu lĩnh vực vẫn tăng thì đang mất thị phần hai lần.",
  },
  category_enrolment_growth: {
    positive:
      "Tăng: lĩnh vực còn khoẻ, dư địa tăng trưởng không bị chặn bởi thị trường mà bởi vị thế cạnh tranh.",
    negative:
      "Giảm: tập cầu đang co lại, mọi nguồn tăng trưởng phải chuyển sang giành phần của đối thủ.",
  },
  growth_vs_category_gap: {
    positive:
      "Dương: tăng nhanh hơn lĩnh vực, tức đang giành thêm thị phần — đây là điều kiện cần của tăng trưởng khoẻ mạnh.",
    negative:
      "Âm: đang mất thị phần cho trường khác, dù số nhập học tuyệt đối có thể vẫn tăng. Đây là ô nguy hiểm nhất vì mọi chỉ số khác vẫn xanh.",
  },
  tuition_value_growth_real: {
    positive:
      "Dương: giá trị thu được tăng thật, không phải trượt theo trần học phí hay lạm phát.",
    negative:
      "Âm: doanh thu danh nghĩa có thể vẫn tăng nhưng giá trị thực đang đi xuống — tăng giá đã thay thế cho tăng sản lượng.",
  },
  cost_per_enrolment: {
    positive:
      "Giảm: mỗi đồng truyền thông mang về nhiều người nhập học hơn — cơ sở để đề nghị ngân sách mùa sau.",
    negative:
      "Tăng: phải trả nhiều hơn cho cùng một kết quả, dấu hiệu thông điệp hoặc kênh đang mất hiệu lực.",
  },
  cost_per_consideration: {
    positive:
      "Giảm: thu hút được người cân nhắc với chi phí thấp hơn, thường nhờ kênh không phải trả tiền.",
    negative:
      "Tăng: đang mua sự quan tâm đắt hơn trước; kiểm lại kênh nào đang ngốn ngân sách mà không ra phiên.",
  },
  marketing_budget_ratio: {
    positive:
      "Nằm trong khoảng thông lệ: thương hiệu được cấp vốn đủ để cạnh tranh.",
    negative:
      "Dưới khoảng thông lệ: kỳ vọng tăng trưởng đang không đi kèm nguồn lực, và khoảng cách đó sẽ hiện ra ở thị phần sau một đến hai mùa.",
  },
  attribute_national_key: {
    positive:
      "Tăng: vị thế trường trọng điểm được nhắc nhiều hơn — nền tin cậy để đỡ các thuộc tính khác.",
    negative:
      "Giảm: mất dần thuộc tính vốn là điểm mạnh sẵn có, thường vì truyền thông dồn hết sang chủ đề khác.",
  },
  attribute_industry_link: {
    positive:
      "Tăng: thuộc tính khác biệt đang được xây — đây là lý do để thí sinh chọn Học viện thay vì trường kỹ thuật lâu năm hơn.",
    negative:
      "Giảm: điểm khác biệt mờ đi, Học viện trở về vị trí so sánh trực diện ở những thuộc tính mà đối thủ đang mạnh hơn.",
  },
  attribute_employability: {
    positive:
      "Tăng: lý do thực dụng nhất để chọn trường được nói tới nhiều hơn, và có số công khai hậu thuẫn.",
    negative:
      "Giảm: bỏ trống thuộc tính mà thí sinh và phụ huynh quan tâm nhất ở khâu quyết định.",
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
