import { z } from "zod";

/**
 * Hợp đồng dữ liệu cho đăng nhập quản trị viên.
 *
 * Nguyên tắc: KHÔNG schema nào ở đây chứa mật khẩu đã băm hay mã phiên.
 * Mã phiên đi bằng cookie `HttpOnly` — trình duyệt không đọc được bằng JavaScript,
 * nên không có đường cho mã độc chèn vào trang lấy mất phiên đăng nhập.
 */

export const LoginRequestSchema = z.object({
  username: z.string().min(1, "Chưa nhập tên đăng nhập").max(100),
  password: z.string().min(1, "Chưa nhập mật khẩu").max(200),
});
export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const AdminUserSchema = z.object({
  username: z.string(),
  displayName: z.string(),
  lastLoginAt: z.string().nullable(),
});
export type AdminUser = z.infer<typeof AdminUserSchema>;

/** Trả về sau khi đăng nhập thành công và khi giao diện hỏi "tôi là ai". */
export const SessionSchema = z.object({
  user: AdminUserSchema,
  /** Thời điểm phiên hết hạn, dạng ISO 8601. Giao diện dựa vào đây để nhắc đăng nhập lại. */
  expiresAt: z.string(),
});
export type Session = z.infer<typeof SessionSchema>;
