"use client";

import { connectApi } from "@/lib/api-client";

/**
 * Bước người dùng thực sự phải làm mỗi khi kết nối lại: bấm một nút.
 *
 * Không nhận mật khẩu Google ở đây — trình duyệt chuyển thẳng sang trang đăng nhập
 * của Google, hệ thống chỉ nhận lại mã uỷ quyền.
 */
export function StepSignIn() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-secondary">
        Đăng nhập bằng tài khoản Google đang có quyền xem property GA4 của Học viện.
        Quyền <strong className="font-medium text-ink">xem (viewer)</strong> là đủ.
      </p>

      <button
        type="button"
        onClick={() => connectApi.goToGoogle()}
        className="flex w-full items-center justify-center gap-3 rounded-lg border border-hairline bg-plane px-4 py-3 text-sm font-medium text-ink transition-colors hover:bg-surface"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
          />
          <path
            fill="#34A853"
            d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
          />
          <path
            fill="#FBBC05"
            d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
          />
          <path
            fill="#EA4335"
            d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
          />
        </svg>
        Đăng nhập bằng Google
      </button>

      <p className="text-[11px] leading-snug text-ink-muted">
        Hệ thống chỉ xin một quyền duy nhất:{" "}
        <em>xem dữ liệu Google Analytics</em>. Không quyền ghi, không đọc email, không
        đọc tài liệu. Bạn thấy đúng dòng đó trên màn hình xin quyền của Google.
      </p>

      <p className="text-[11px] leading-snug text-ink-muted">
        Gặp cảnh báo “Google chưa xác minh ứng dụng này” là bình thường — ứng dụng do
        chính bạn đăng ký ở bước trước. Bấm <em>Nâng cao → Truy cập</em>.
      </p>
    </div>
  );
}
