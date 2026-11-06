import {
  buildDemoCascade,
  buildDemoDataset,
  buildDemoShareOfSearch,
  ChannelsResponseSchema,
  DataLineageResponseSchema,
  KpiCascadeResponseSchema,
  KpiTargetOverrideListSchema,
  OverviewResponseSchema,
  ReachResponseSchema,
  SentimentResponseSchema,
  ShareOfSearchResponseSchema,
  SocialMentionsResponseSchema,
  type ChannelsResponse,
  type DataLineageResponse,
  type KpiCascadeResponse,
  type KpiTargetOverride,
  type OverviewResponse,
  type ReachResponse,
  type SentimentResponse,
  type ShareOfSearchResponse,
  type SocialMentionsQuery,
  type SocialMentionsResponse,
} from "@ptit/shared";
import type { z } from "zod";

/**
 * Địa chỉ API. Bỏ trống thì trang tự dùng bộ số liệu giả lập trong @ptit/shared
 * — nhờ vậy bản deploy đầu tiên vẫn xem được khi backend chưa lên.
 */
const API_URL = (process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "")
  .trim()
  .replace(/\/$/, "");

export type DataSource = "api" | "demo";

export interface DashboardData {
  source: DataSource;
  apiUrl: string | null;
  overview: OverviewResponse;
  reach: ReachResponse;
  channels: ChannelsResponse;
  sentiment: SentimentResponse;
}

/**
 * `revalidate = 0` nghĩa là không đệm.
 *
 * Mặc định 300 giây hợp với số liệu do dbt dựng theo lịch. Nhưng dữ liệu người dùng sửa
 * được ngay trên giao diện thì phải đọc tươi: sửa mức cần đạt rồi tải lại trang mà vẫn
 * thấy con số cũ nằm trong đệm 5 phút là cách chắc chắn khiến người dùng bấm Lưu lần nữa.
 */
async function fetchJson<T>(
  path: string,
  schema: z.ZodType<T>,
  revalidate = 300,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    next: { revalidate },
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(`${path} trả về HTTP ${response.status}`);
  }
  return schema.parse(await response.json());
}

export async function getDashboardData(): Promise<DashboardData> {
  const demo = buildDemoDataset();

  if (!API_URL) {
    return { source: "demo", apiUrl: null, ...demo };
  }

  try {
    const [overview, reach, channels, sentiment] = await Promise.all([
      fetchJson("/api/v1/overview", OverviewResponseSchema),
      fetchJson("/api/v1/reach", ReachResponseSchema),
      fetchJson("/api/v1/channels", ChannelsResponseSchema),
      fetchJson("/api/v1/sentiment", SentimentResponseSchema),
    ]);
    return { source: "api", apiUrl: API_URL, overview, reach, channels, sentiment };
  } catch (error) {
    // Không làm sập trang demo vì API chưa lên — nhưng phải nói rõ trên giao diện.
    console.warn("[dashboard] Không gọi được API, quay về dữ liệu giả lập:", error);
    return { source: "demo", apiUrl: API_URL, ...demo };
  }
}

export interface SocialMentionsData {
  source: DataSource;
  mentions: SocialMentionsResponse | null;
  /** Vì sao không có dữ liệu. `null` khi lấy được bình thường. */
  reason: string | null;
}

/**
 * Danh sách ý kiến đọc được.
 *
 * KHÔNG có bản giả lập dự phòng, khác hẳn các khối số liệu tổng hợp. Bịa ra con số thì
 * người xem vẫn đọc chúng như xu hướng và bảng đã ghi rõ "số liệu giả lập"; nhưng bịa ra
 * những CÂU như thể có người thật đã viết chúng về Học viện là dựng lời cho người không
 * nói. Không lấy được thì nói không lấy được, và nói rõ vì sao.
 */
export async function getSocialMentions(
  query: Partial<SocialMentionsQuery> = {},
): Promise<SocialMentionsData> {
  if (!API_URL) {
    return {
      source: "demo",
      mentions: null,
      reason:
        "Chưa cấu hình địa chỉ API. Danh sách ý kiến không có bản giả lập — đây là lời của người thật, không bịa được.",
    };
  }

  const thamSo = new URLSearchParams();
  if (query.sentiment) thamSo.set("sentiment", query.sentiment);
  if (query.platform) thamSo.set("platform", query.platform);
  if (query.limit) thamSo.set("limit", String(query.limit));
  const chuoi = thamSo.toString();

  try {
    const mentions = await fetchJson(
      `/api/v1/social-mentions${chuoi ? `?${chuoi}` : ""}`,
      SocialMentionsResponseSchema,
    );
    return { source: "api", mentions, reason: null };
  } catch (error) {
    console.warn("[lang-nghe] Không gọi được API ý kiến:", error);
    return {
      source: "demo",
      mentions: null,
      reason:
        "Không đọc được kho ý kiến. Kiểm tra worker đã chạy `social thu-thap` và `nlp cham`, rồi `dbt build` chưa.",
    };
  }
}

export interface KpiData {
  source: DataSource;
  apiUrl: string | null;
  cascade: KpiCascadeResponse;
  shareOfSearch: ShareOfSearchResponse;
  /** Chỉ số nào đã được sửa mức cần đạt, kèm căn cứ và người sửa. Rỗng ở chế độ giả lập. */
  overrides: KpiTargetOverride[];
}

/**
 * Dữ liệu cho trang Mục tiêu & KPI.
 *
 * `parse` ở đây không chỉ kiểm kiểu: schema cascade kiểm luôn cây mục tiêu có liền
 * mạch không. Một chỉ số không gắn mục tiêu nào, hay một mục tiêu trỏ sai tầng, sẽ
 * làm hỏng lời gọi này thay vì lặng lẽ hiện ra màn hình.
 *
 * Mức cần đạt đã sửa được API chồng sẵn vào `cascade` — không chồng lại ở đây. Trước
 * đây việc chồng làm ở phía web, đọc từ `data/kpi-targets.json`: dữ liệu mất khi dựng
 * lại container, và `status` phụ thuộc vào việc frontend có nhớ gọi `applyTargetOverrides`
 * hay không. Nay cả hai đường đọc đều lấy đúng một con số từ máy chủ.
 */
export async function getKpiData(): Promise<KpiData> {
  const demo = {
    cascade: buildDemoCascade(),
    shareOfSearch: buildDemoShareOfSearch(),
    overrides: [] as KpiTargetOverride[],
  };

  if (!API_URL) {
    return { source: "demo", apiUrl: null, ...demo };
  }

  try {
    const [cascade, shareOfSearch, danh_sach] = await Promise.all([
      fetchJson("/api/v1/kpi-cascade", KpiCascadeResponseSchema, 0),
      fetchJson("/api/v1/share-of-search", ShareOfSearchResponseSchema),
      fetchJson("/api/v1/kpi-targets", KpiTargetOverrideListSchema, 0),
    ]);
    return {
      source: "api",
      apiUrl: API_URL,
      cascade,
      shareOfSearch,
      overrides: danh_sach.overrides,
    };
  } catch (error) {
    console.warn("[kpi] Không gọi được API, quay về dữ liệu giả lập:", error);
    return { source: "demo", apiUrl: API_URL, ...demo };
  }
}

export interface LineageData {
  source: DataSource;
  apiUrl: string | null;
  lineage: DataLineageResponse | null;
}

/**
 * Bản đồ đường ống dữ liệu.
 *
 * Không có bản giả lập thay thế: trang này nói về TRẠNG THÁI THẬT của kho. Dựng một
 * đường ống giả để màn hình đỡ trống là đúng thứ nó sinh ra để chống. Gọi không được
 * thì trả `null` và trang nói thẳng là chưa đọc được kho.
 */
export async function getDataLineage(): Promise<LineageData> {
  if (!API_URL) {
    return { source: "demo", apiUrl: null, lineage: null };
  }

  try {
    const lineage = await fetchJson("/api/v1/data-lineage", DataLineageResponseSchema);
    return { source: "api", apiUrl: API_URL, lineage };
  } catch (error) {
    console.warn("[lineage] Không đọc được bản đồ đường ống:", error);
    return { source: "demo", apiUrl: API_URL, lineage: null };
  }
}
