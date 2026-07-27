"use client";

import {
  ConnectionStatusSchema,
  Ga4PropertyListSchema,
  SyncStatusSchema,
  type ConnectionStatus,
  type Ga4PropertyList,
  type SyncStatus,
} from "@ptit/shared";
import type { z } from "zod";

const BASE = (process.env.NEXT_PUBLIC_API_URL ?? "").trim().replace(/\/$/, "");

export function isApiConfigured(): boolean {
  return BASE.length > 0;
}

export function apiUrl(path: string): string {
  return `${BASE}${path}`;
}

/** Bóc thông điệp lỗi tiếng Việt do NestJS trả về, thay vì hiện "HTTP 400" trống rỗng. */
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

async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  if (!isApiConfigured()) {
    throw new Error(
      "Chưa cấu hình NEXT_PUBLIC_API_URL nên trang không gọi được API. " +
        "Thêm biến này vào apps/web/.env.local rồi khởi động lại.",
    );
  }

  const dia_chi = apiUrl(path);
  let response: Response;

  // Chỉ khai content-type khi thực sự có body. Fastify từ chối request khai
  // 'application/json' mà thân rỗng, nên các POST không tham số (đồng bộ, ngắt kết
  // nối) sẽ hỏng nếu gắn header này vô điều kiện.
  const headers: Record<string, string> = { accept: "application/json" };
  if (init?.body !== undefined) headers["content-type"] = "application/json";

  try {
    response = await fetch(dia_chi, { ...init, headers });
  } catch {
    // fetch chỉ ném ra "Failed to fetch" trống rỗng khi hỏng ở tầng mạng — nói rõ
    // đã gọi vào đâu, vì nguyên nhân gần như luôn là API chưa chạy hoặc sai cổng.
    throw new Error(
      `Không gọi được ${dia_chi} — API chưa chạy hoặc đang nghe ở cổng khác.`,
    );
  }

  if (!response.ok) throw new Error(await readError(response));
  return schema.parse(await response.json());
}

const GOC = "/api/v1/integrations";

export const connectApi = {
  status: (): Promise<ConnectionStatus> =>
    request(`${GOC}/status`, ConnectionStatusSchema),

  saveOauthClient: (clientId: string, clientSecret: string): Promise<ConnectionStatus> =>
    request(`${GOC}/google/client`, ConnectionStatusSchema, {
      method: "POST",
      body: JSON.stringify({ clientId, clientSecret }),
    }),

  disconnect: (): Promise<ConnectionStatus> =>
    request(`${GOC}/google/disconnect`, ConnectionStatusSchema, { method: "POST" }),

  listProperties: (): Promise<Ga4PropertyList> =>
    request(`${GOC}/ga4/properties`, Ga4PropertyListSchema),

  selectProperty: (propertyId: string): Promise<ConnectionStatus> =>
    request(`${GOC}/ga4/property`, ConnectionStatusSchema, {
      method: "POST",
      body: JSON.stringify({ propertyId }),
    }),

  startSync: (): Promise<SyncStatus> =>
    request(`${GOC}/ga4/sync`, SyncStatusSchema, { method: "POST" }),

  syncStatus: (): Promise<SyncStatus> => request(`${GOC}/ga4/sync`, SyncStatusSchema),

  /** Chuyển hẳn trình duyệt sang Google — không gọi fetch được vì có chuyển hướng chéo miền. */
  goToGoogle: (): void => {
    window.location.href = apiUrl(`${GOC}/google/authorize`);
  },
};
