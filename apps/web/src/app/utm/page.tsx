import type { Metadata } from "next";
import Link from "next/link";
import { UtmBuilder } from "@/components/utm/UtmBuilder";

export const metadata: Metadata = { title: "Tạo link gắn thẻ — Dashboard PTIT" };

export default function TrangTaoLinkUtm() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-8 sm:py-12">
      <header className="mb-8">
        <Link
          href="/"
          className="text-xs text-ink-muted underline decoration-hairline underline-offset-2 hover:text-ink-secondary"
        >
          ← Về bảng điều khiển
        </Link>
        <h1 className="mt-3 text-xl font-semibold text-ink sm:text-2xl">
          Tạo link gắn thẻ
        </h1>
        <p className="mt-1.5 text-sm text-ink-secondary">
          Mọi link đăng ra ngoài đều tạo ở đây. Chọn vài ô, chép link, dán vào bài.
        </p>
      </header>

      <div
        className="mb-6 rounded-lg border border-hairline bg-surface px-4 py-3 text-xs leading-relaxed text-ink-secondary"
        role="note"
      >
        <p>
          <strong className="font-medium text-ink">Vì sao phải làm việc này.</strong>{" "}
          Năm 2026 có <strong className="font-medium text-ink">26,0%</strong> phiên truy
          cập không quy được về kênh nào, tăng từ 17,7% của năm 2025. Phần lớn là lưu
          lượng thật từ Facebook và Zalo, nhưng trình duyệt bên trong hai ứng dụng đó
          làm mất thông tin nguồn. Chỉ tham số trên đường dẫn mới giữ lại được.
        </p>
        <p className="mt-2">
          Link không gắn thẻ vẫn hoạt động bình thường với người đọc — chỉ là hệ thống
          không biết họ đến từ đâu, nên công sức của phòng Truyền thông không chứng minh được.
        </p>
      </div>

      <UtmBuilder />

      <footer className="mt-10 border-t border-hairline pt-5 text-xs leading-relaxed text-ink-muted">
        <p>
          Danh sách nguồn và hình thức là danh sách đóng, không nhập tự do. Để nhập tay
          thì sẽ có cả <code>Facebook</code> lẫn <code>facebook</code>, và trong báo cáo
          chúng là hai kênh khác nhau.
        </p>
        <p className="mt-1">
          Mở ngành mới hoặc thêm kênh mới thì sửa <code>packages/shared/src/schemas/utm.ts</code>
          — trang này và phần kiểm tra tuân thủ đều đọc từ đó.
        </p>
      </footer>
    </main>
  );
}
