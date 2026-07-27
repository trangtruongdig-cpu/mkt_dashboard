import {
  buildDemoCascade,
  buildDemoDataset,
  buildDemoShareOfSearch,
  ChannelsResponseSchema,
  KpiCascadeResponseSchema,
  OverviewResponseSchema,
  ReachResponseSchema,
  SentimentResponseSchema,
  ShareOfSearchResponseSchema,
  type ChannelsResponse,
  type KpiCascadeResponse,
  type OverviewResponse,
  type ReachResponse,
  type SentimentResponse,
  type ShareOfSearchResponse,
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

async function fetchJson<T>(
  path: string,
  schema: z.ZodType<T>,
): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    next: { revalidate: 300 },
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

export interface KpiData {
  source: DataSource;
  apiUrl: string | null;
  cascade: KpiCascadeResponse;
  shareOfSearch: ShareOfSearchResponse;
}

/**
 * Dữ liệu cho trang Mục tiêu & KPI.
 *
 * `parse` ở đây không chỉ kiểm kiểu: schema cascade kiểm luôn cây mục tiêu có liền
 * mạch không. Một chỉ số không gắn mục tiêu nào, hay một mục tiêu trỏ sai tầng, sẽ
 * làm hỏng lời gọi này thay vì lặng lẽ hiện ra màn hình.
 */
/**
 * Chồng các mức cần đạt đã sửa từ giao diện lên cascade gốc.
 *
 * Đặt ở đây để mọi trang đọc cascade đều thấy cùng một con số. `applyTargetOverrides`
 * tự tính lại trạng thái đúng/chệch hướng nên không nơi nào phải nhớ làm việc đó.
 */
export async function getKpiData(): Promise<KpiData> {
  const { applyTargetOverrides } = await import("@ptit/shared");
  const { docTatCa } = await import("./kpi-targets-store");

  const du_lieu = await napKpiData();
  return { ...du_lieu, cascade: applyTargetOverrides(du_lieu.cascade, docTatCa()) };
}

async function napKpiData(): Promise<KpiData> {
  const demo = {
    cascade: buildDemoCascade(),
    shareOfSearch: buildDemoShareOfSearch(),
  };

  if (!API_URL) {
    return { source: "demo", apiUrl: null, ...demo };
  }

  try {
    const [cascade, shareOfSearch] = await Promise.all([
      fetchJson("/api/v1/kpi-cascade", KpiCascadeResponseSchema),
      fetchJson("/api/v1/share-of-search", ShareOfSearchResponseSchema),
    ]);
    return { source: "api", apiUrl: API_URL, cascade, shareOfSearch };
  } catch (error) {
    console.warn("[kpi] Không gọi được API, quay về dữ liệu giả lập:", error);
    return { source: "demo", apiUrl: API_URL, ...demo };
  }
}
