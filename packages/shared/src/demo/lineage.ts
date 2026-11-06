import type {
  Dataset,
  LineageEdge,
  KpiSourceLink,
} from "../schemas/data-lineage";

/**
 * DANH MỤC ĐƯỜNG ỐNG — phần tĩnh, khai bằng tay.
 *
 * Số dòng và dữ liệu mẫu do repository đọc từ kho lúc chạy. Còn mô tả, quan hệ cha con
 * và mức nhạy cảm là quyết định của con người nên khai ở đây, cạnh hợp đồng dữ liệu.
 *
 * Vì sao không tự sinh từ manifest của dbt: manifest cho biết bảng nào phụ thuộc bảng
 * nào, nhưng không cho biết bảng đó CHỨA GÌ và AI sinh ra nó. Người đọc dashboard cần
 * vế thứ hai, và vế đó chỉ có người viết mã mới nói được.
 *
 * `sensitivity` quyết định có hiện dữ liệu mẫu hay không:
 *   public   — nguồn công khai (tin bài, tài liệu công khai bắt buộc, Wikipedia)
 *   internal — dữ liệu vận hành của Học viện hoặc nội dung do người dùng viết
 *
 * Mục 9 CLAUDE.md cấm đưa dữ liệu vận hành ra ngoài, và dashboard này có thể được mở
 * cho người ngoài xem trong buổi nghiệm thu.
 */

const RAW: Dataset[] = [
  {
    name: "ga4_pages_daily",
    stage: "raw",
    rowCount: null,
    description:
      "Lượt xem từng đường dẫn theo ngày trên toàn bộ multisite ptit.edu.vn, hút từ Google Analytics 4 Data API.",
    producedBy: "uv run python -m ingest sync",
    sensitivity: "internal",
  },
  {
    name: "ga4_traffic_acquisition_daily",
    stage: "raw",
    rowCount: null,
    description: "Phiên truy cập theo ngày, chia theo nguồn và nhóm kênh.",
    producedBy: "uv run python -m ingest sync",
    sensitivity: "internal",
  },
  {
    name: "ga4_campaigns_daily",
    stage: "raw",
    rowCount: null,
    description: "Phiên theo ngày, chia theo tên chiến dịch UTM.",
    producedBy: "uv run python -m ingest sync",
    sensitivity: "internal",
  },
  {
    name: "ga4_geo_daily",
    stage: "raw",
    rowCount: null,
    description: "Phiên theo ngày, chia theo quốc gia và thành phố.",
    producedBy: "uv run python -m ingest sync",
    sensitivity: "internal",
  },
  {
    name: "raw_brand_pageviews",
    stage: "raw",
    rowCount: null,
    description:
      "Lượt xem trang Wikipedia theo tuần của sáu trường đối sánh. Nguồn công khai, thay cho Google Trends đang chặn truy cập.",
    producedBy: "uv run python -m ingest wiki-sync",
    sensitivity: "public",
  },
  {
    name: "raw_news_mention",
    stage: "raw",
    rowCount: null,
    description:
      "Tin bài công khai nhắc tới nhóm sáu trường. Cột `brands` do bước gán nhãn điền, cột `is_owned` tách bài trên kênh của chính Học viện.",
    producedBy: "uv run python -m crawler thu-thap && ... gan-nhan",
    sensitivity: "public",
  },
  {
    name: "raw_disclosure_document",
    stage: "raw",
    rowCount: null,
    description:
      "Danh mục tài liệu Ba công khai và đề án tuyển sinh do crawler phát hiện, kèm cờ cho biết tài liệu máy đọc được hay là bản scan.",
    producedBy: "uv run python -m crawler cong-khai && ... cong-khai-do",
    sensitivity: "public",
  },
  {
    name: "raw_disclosure_figure",
    stage: "raw",
    rowCount: null,
    description:
      "Số liệu bóc từ Biểu mẫu 18 của từng trường. Cột `warnings` ghi mọi chỗ đáng ngờ — phải đọc trước khi so sánh chéo.",
    producedBy: "uv run python -m crawler cong-khai-boc-so",
    sensitivity: "public",
  },
  {
    name: "raw_admission_score",
    stage: "raw",
    rowCount: null,
    description:
      "Điểm chuẩn trúng tuyển theo ngành, bóc từ trang công bố của từng trường.",
    producedBy: "uv run python -m crawler diem-chuan",
    sensitivity: "public",
  },
  {
    name: "raw_social_mention",
    stage: "raw",
    rowCount: null,
    description:
      "Thảo luận của người ngoài: bình luận YouTube, bài Reddit. Tài khoản người viết đã băm thành mã ẩn danh ngay từ lúc thu thập.",
    producedBy: "uv run python -m social thu-thap",
    sensitivity: "internal",
  },
];

const STAGING: Dataset[] = [
  {
    name: "stg__ga4__pages",
    stage: "staging",
    rowCount: null,
    description:
      "Ép kiểu và gộp đường dẫn trùng: bỏ hậu tố năm để một ngành không bị chia đôi qua các mùa tuyển sinh.",
    producedBy: null,
    sensitivity: "internal",
  },
  {
    name: "stg__ga4__traffic_acquisition",
    stage: "staging",
    rowCount: null,
    description: "Phiên theo nguồn và nhóm kênh, đã chuẩn hoá tên cột.",
    producedBy: null,
    sensitivity: "internal",
  },
  {
    name: "stg__wiki__brand_pageviews",
    stage: "staging",
    rowCount: null,
    description:
      "Lượt xem Wikipedia theo tuần, chỉ giữ tuần trọn vẹn bảy ngày.",
    producedBy: null,
    sensitivity: "public",
  },
  {
    name: "stg__news__brand_mention",
    stage: "staging",
    rowCount: null,
    description:
      "Trải mỗi nhãn thương hiệu thành một dòng. Bài so sánh nhắc sáu trường sinh sáu dòng — đó là đúng, vì đây đếm số LẦN NHẮC.",
    producedBy: null,
    sensitivity: "public",
  },
  {
    name: "stg__disclosure__figure",
    stage: "staging",
    rowCount: null,
    description:
      "Số liệu Biểu 18 đã đổi tên cột, giữ nguyên cột cảnh báo từ bước bóc.",
    producedBy: null,
    sensitivity: "public",
  },
  {
    name: "stg__scores__admission",
    stage: "staging",
    rowCount: null,
    description: "Điểm chuẩn đã chuẩn hoá tên cột.",
    producedBy: null,
    sensitivity: "public",
  },
];

const MART: Dataset[] = [
  {
    name: "mart__channel_performance",
    stage: "mart",
    rowCount: null,
    description:
      "Hiệu quả từng kênh theo ngày. Cột `la_direct` chính là mức thất thoát quy kết.",
    producedBy: null,
    sensitivity: "internal",
  },
  {
    name: "mart__program_demand",
    stage: "mart",
    rowCount: null,
    description:
      "Nhu cầu theo ngành, đo bằng lượt xem trang chương trình. Nhận cả ba dạng đường dẫn — chỉ lọc một dạng thì bỏ 27,4% lượt xem.",
    producedBy: null,
    sensitivity: "internal",
  },
  {
    name: "mart__admission_funnel",
    stage: "mart",
    rowCount: null,
    description:
      "Phễu tuyển sinh ba bậc, đo bằng lượt xem trang. Bậc sâu nhất là ý định nhập học.",
    producedBy: null,
    sensitivity: "internal",
  },
  {
    name: "mart__brand_attention",
    stage: "mart",
    rowCount: null,
    description:
      "Thị phần chú ý theo tuần trong nhóm sáu trường. Mẫu số là tổng của cả nhóm trong chính tuần đó.",
    producedBy: null,
    sensitivity: "public",
  },
  {
    name: "mart__share_of_voice",
    stage: "mart",
    rowCount: null,
    description:
      "Thị phần thảo luận theo tháng, chỉ tính bài do báo ngoài viết. Cột `du_mau` đánh dấu tháng đủ mẫu để tỷ trọng có nghĩa.",
    producedBy: null,
    sensitivity: "public",
  },
  {
    name: "mart__disclosure_benchmark",
    stage: "mart",
    rowCount: null,
    description:
      "Số liệu đào tạo của nhóm đối sánh, một bản mỗi cặp trường-năm, ưu tiên bản bóc sạch nhất.",
    producedBy: null,
    sensitivity: "public",
  },
  {
    name: "mart__brand_attribute",
    stage: "mart",
    rowCount: null,
    description:
      "Tỷ lệ tin bài gắn TỪNG thuộc tính thương hiệu theo tháng — không gộp, vì quy tắc cặp tăng–giữ chỉ đọc được khi ba chuỗi nằm cạnh nhau. Cột `du_mau` hiện chưa tháng nào bật: mới 76 trên 1.748 bài có toàn văn.",
    producedBy: null,
    sensitivity: "public",
  },
  {
    name: "mart__value_benchmark",
    stage: "mart",
    rowCount: null,
    description:
      "Học phí và chi phí đào tạo của nhóm đối sánh. Cột `cach_lay` phân biệt số máy bóc với số người nhập tay, và `da_co_hoc_phi` đánh dấu dòng còn là hàng đợi.",
    producedBy: null,
    sensitivity: "public",
  },
  {
    name: "mart__admission_score_benchmark",
    stage: "mart",
    rowCount: null,
    description:
      "Điểm chuẩn bình quân theo trường và năm, để tính chênh lệch so với nhóm.",
    producedBy: null,
    sensitivity: "public",
  },
];

export const LINEAGE_DATASETS: readonly Dataset[] = [
  ...RAW,
  ...STAGING,
  ...MART,
];

export const LINEAGE_EDGES: readonly LineageEdge[] = [
  { from: "ga4_pages_daily", to: "stg__ga4__pages" },
  {
    from: "ga4_traffic_acquisition_daily",
    to: "stg__ga4__traffic_acquisition",
  },
  { from: "raw_brand_pageviews", to: "stg__wiki__brand_pageviews" },
  { from: "raw_news_mention", to: "stg__news__brand_mention" },
  { from: "raw_disclosure_figure", to: "stg__disclosure__figure" },
  { from: "raw_admission_score", to: "stg__scores__admission" },

  { from: "stg__ga4__traffic_acquisition", to: "mart__channel_performance" },
  { from: "stg__ga4__pages", to: "mart__program_demand" },
  { from: "stg__ga4__pages", to: "mart__admission_funnel" },
  { from: "stg__wiki__brand_pageviews", to: "mart__brand_attention" },
  { from: "stg__news__brand_mention", to: "mart__share_of_voice" },
  { from: "stg__disclosure__figure", to: "mart__disclosure_benchmark" },
  { from: "stg__scores__admission", to: "mart__admission_score_benchmark" },
];

/**
 * Chỉ số nào đọc bảng nào — khai theo đúng các truy vấn trong `PostgresKpiRepository`.
 *
 * Sai lệch giữa bảng này và truy vấn thật là sai lệch mà người đọc không phát hiện
 * được, nên sửa truy vấn thì phải sửa cả ở đây.
 */
export const LINEAGE_KPI_LINKS: readonly KpiSourceLink[] = [
  { kpiKey: "social_traffic_share", dataset: "mart__channel_performance" },
  { kpiKey: "social_engagement_rate", dataset: "mart__channel_performance" },
  { kpiKey: "ai_assistant_sessions", dataset: "mart__channel_performance" },
  { kpiKey: "returning_user_share", dataset: "mart__channel_performance" },
  {
    kpiKey: "admission_consideration_views",
    dataset: "mart__admission_funnel",
  },
  { kpiKey: "application_intent_views", dataset: "mart__admission_funnel" },
  { kpiKey: "program_mix_beyond_core", dataset: "mart__program_demand" },
  { kpiKey: "high_value_program_interest", dataset: "mart__program_demand" },
  { kpiKey: "attention_share", dataset: "mart__brand_attention" },
  { kpiKey: "brand_search_index", dataset: "mart__brand_attention" },
  { kpiKey: "share_of_voice", dataset: "mart__share_of_voice" },
  { kpiKey: "employment_rate", dataset: "mart__disclosure_benchmark" },
  { kpiKey: "score_premium", dataset: "mart__admission_score_benchmark" },
];
