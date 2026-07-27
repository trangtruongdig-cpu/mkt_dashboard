import { z } from "zod";

/**
 * Hợp đồng dữ liệu cho luồng kết nối nguồn dữ liệu qua giao diện web.
 *
 * Nguyên tắc: KHÔNG có schema nào ở đây chứa client_secret hay refresh_token.
 * Bí mật chỉ nằm ở phía máy chủ; giao diện chỉ biết "đã kết nối hay chưa" và
 * "kết nối bằng tài khoản nào".
 */

/** Ba trạng thái của luồng kết nối, giao diện dựa vào đây để biết hiện bước nào. */
export const ConnectionStageSchema = z.enum([
  /** Chưa khai báo OAuth client — cần làm bước một lần trên Google Cloud. */
  "chua_khai_bao_client",
  /** Đã có client nhưng người dùng chưa đăng nhập Google. */
  "chua_dang_nhap",
  /** Đã đăng nhập nhưng chưa chọn property nào. */
  "chua_chon_property",
  /** Sẵn sàng đồng bộ. */
  "san_sang",
]);
export type ConnectionStage = z.infer<typeof ConnectionStageSchema>;

export const Ga4PropertySchema = z.object({
  /** Dạng `properties/464491273`. */
  name: z.string(),
  propertyId: z.string(),
  displayName: z.string(),
  accountName: z.string(),
});
export type Ga4Property = z.infer<typeof Ga4PropertySchema>;

export const Ga4PropertyListSchema = z.object({
  properties: z.array(Ga4PropertySchema),
});
export type Ga4PropertyList = z.infer<typeof Ga4PropertyListSchema>;

export const ConnectionStatusSchema = z.object({
  stage: ConnectionStageSchema,
  /** Email của tài khoản Google đã uỷ quyền. `null` khi chưa đăng nhập. */
  accountEmail: z.string().nullable(),
  selectedProperty: Ga4PropertySchema.nullable(),
  connectedAt: z.string().nullable(),
  /** URI chuyển hướng cần khai báo trên Google Cloud — hiện ra để người dùng copy. */
  redirectUri: z.string(),
});
export type ConnectionStatus = z.infer<typeof ConnectionStatusSchema>;

/** Người dùng dán client_id / client_secret một lần duy nhất. */
export const SaveOauthClientSchema = z.object({
  clientId: z.string().min(10, "Client ID không hợp lệ"),
  clientSecret: z.string().min(10, "Client secret không hợp lệ"),
});
export type SaveOauthClient = z.infer<typeof SaveOauthClientSchema>;

export const SelectPropertySchema = z.object({
  propertyId: z.string().regex(/^\d+$/, "Property ID phải là dãy số"),
});
export type SelectProperty = z.infer<typeof SelectPropertySchema>;

export const SyncStateSchema = z.enum(["chua_chay", "dang_chay", "thanh_cong", "that_bai"]);
export type SyncState = z.infer<typeof SyncStateSchema>;

export const SyncStatusSchema = z.object({
  state: SyncStateSchema,
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
  /** Vài chục dòng log cuối, đã lọc bỏ mọi chuỗi trông giống bí mật. */
  logTail: z.array(z.string()),
  rowsByStream: z.record(z.string(), z.number()).nullable(),
});
export type SyncStatus = z.infer<typeof SyncStatusSchema>;
