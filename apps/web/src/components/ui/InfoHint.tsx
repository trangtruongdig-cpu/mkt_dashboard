import type { ReactNode } from "react";
import { IconInfo } from "./icons";

interface InfoHintProps {
  /** Nhãn cho trình đọc màn hình, ví dụ “Diễn giải chỉ số Thị phần tìm kiếm”. */
  label: string;
  /** Nội dung hiện ra khi bấm. */
  children: ReactNode;
  /** Cạnh neo bảng nội dung. Mặc định neo phải để không tràn ra ngoài thẻ. */
  align?: "left" | "right";
  className?: string;
}

/**
 * Nút (i) — nơi chữ giải thích đi trốn.
 *
 * Bảng điều khiển phải đọc được bằng mắt trong vài giây, nhưng phần diễn giải không
 * được phép biến mất khỏi sản phẩm: đây là chỗ toàn bộ lời văn (lý do tồn tại của mục
 * tiêu, chiều tích cực/tiêu cực của chỉ số, xuất xứ số liệu) được gấp lại mà vẫn tra
 * ra được ngay tại chỗ.
 *
 * Dựng bằng `<details>` thay vì popover có JavaScript: chạy được cả khi JS chưa tải,
 * bàn phím thao tác được sẵn (Tab tới, Enter mở), và khi in ra hồ sơ nghiệm thu thì
 * bung hết nội dung bằng CSS chứ không mất chữ.
 */
export function InfoHint({
  label,
  children,
  align = "right",
  className = "",
}: InfoHintProps) {
  return (
    <details className={`relative inline-block shrink-0 ${className}`}>
      <summary
        aria-label={label}
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-inset hover:text-series-1 focus-visible:ring-2 focus-visible:ring-series-1/50 focus-visible:outline-none"
      >
        <IconInfo className="h-3.5 w-3.5" />
      </summary>
      <div
        className={`absolute top-7 z-30 w-72 max-w-[min(18rem,calc(100vw-2.5rem))] rounded-lg border border-hairline bg-surface p-3 text-left text-xs leading-relaxed text-ink-secondary shadow-lg ${
          align === "right" ? "right-0" : "left-0"
        }`}
      >
        {children}
      </div>
    </details>
  );
}
