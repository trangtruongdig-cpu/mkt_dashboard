import {
  buildDemoDataset,
  ChannelsResponseSchema,
  OverviewResponseSchema,
  ReachResponseSchema,
  SentimentResponseSchema,
  type ChannelsResponse,
  type OverviewResponse,
  type ReachResponse,
  type SentimentResponse,
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
