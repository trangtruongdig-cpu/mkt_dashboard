"use client";

import {
  CrawlerOverviewSchema,
  CrawlerRunListSchema,
  CrawlerRunSchema,
  CrawlerSourceListSchema,
  CrawlerSourceSchema,
  SessionSchema,
  type CrawlerOverview,
  type CrawlerRun,
  type CrawlerRunList,
  type CrawlerSource,
  type CrawlerSourceList,
  type Session,
  type UpdateCrawlerSource,
} from "@ptit/shared";
import type { z } from "zod";
import { apiUrl, isApiConfigured } from "./api-client";

/**
 * Client cho các endpoint quản trị.
 *
 * Khác `api-client.ts` ở đúng một điểm quan trọng: mọi request đều gửi kèm cookie
 * (`credentials: "include"`). Không có nó thì trình duyệt bỏ cookie phiên khi web và API
 * nằm ở hai cổng khác nhau, và mọi lời gọi đều trả 401 dù đã đăng nhập.
 */

/** Ném ra khi máy chủ trả 401 — giao diện bắt riêng để chuyển về trang đăng nhập. */
export class ChuaDangNhapError extends Error {
  constructor() {
    super("Phiên đăng nhập đã hết hạn");
    this.name = "ChuaDangNhapError";
  }
}

async function readError(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json();
    if (typeof payload === "object" && payload !== null && "message" in payload) {
      const message = (payload as { message: unknown }).message;
      return Array.isArray(message) ? message.join(", ") : String(message);
    }
  } catch {
    /* rơi xuống thông điệp mặc định */
  }
  return `Máy chủ trả về HTTP ${response.status}`;
}

async function request<T>(path: string, schema: z.ZodType<T>, init?: RequestInit): Promise<T> {
  if (!isApiConfigured()) {
    throw new Error(
      "Chưa cấu hình NEXT_PUBLIC_API_URL nên trang không gọi được API. " +
        "Thêm biến này vào apps/web/.env.local rồi khởi động lại.",
    );
  }

  const dia_chi = apiUrl(path);
  const headers: Record<string, string> = { accept: "application/json" };
  if (init?.body !== undefined) headers["content-type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(dia_chi, { ...init, headers, credentials: "include" });
  } catch {
    throw new Error(`Không gọi được ${dia_chi} — API chưa chạy hoặc đang nghe ở cổng khác.`);
  }

  if (response.status === 401) throw new ChuaDangNhapError();
  if (!response.ok) throw new Error(await readError(response));
  if (response.status === 204) return undefined as T;

  return schema.parse(await response.json());
}

const AUTH = "/api/v1/auth";
const CRAWLER = "/api/v1/admin/crawler";

export const authApi = {
  login: (username: string, password: string): Promise<Session> =>
    request(`${AUTH}/login`, SessionSchema, {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  me: (): Promise<Session> => request(`${AUTH}/me`, SessionSchema),

  logout: async (): Promise<void> => {
    await fetch(apiUrl(`${AUTH}/logout`), { method: "POST", credentials: "include" });
  },
};

export const crawlerAdminApi = {
  overview: (): Promise<CrawlerOverview> => request(`${CRAWLER}/overview`, CrawlerOverviewSchema),

  sources: (): Promise<CrawlerSourceList> =>
    request(`${CRAWLER}/sources`, CrawlerSourceListSchema),

  updateSource: (id: number, patch: UpdateCrawlerSource): Promise<CrawlerSource> =>
    request(`${CRAWLER}/sources/${id}`, CrawlerSourceSchema, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  runs: (): Promise<CrawlerRunList> => request(`${CRAWLER}/runs`, CrawlerRunListSchema),

  runAll: (): Promise<CrawlerRun> =>
    request(`${CRAWLER}/runs`, CrawlerRunSchema, { method: "POST" }),

  runOne: (id: number): Promise<CrawlerRun> =>
    request(`${CRAWLER}/sources/${id}/runs`, CrawlerRunSchema, { method: "POST" }),
};
