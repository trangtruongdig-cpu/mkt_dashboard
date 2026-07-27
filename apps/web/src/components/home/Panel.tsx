import type { ComponentType, ReactNode } from "react";
import type { IconProps } from "@/components/ui/icons";

interface PanelProps {
  icon: ComponentType<IconProps>;
  title: string;
  /** Chữ phụ bên phải tiêu đề: kỳ báo cáo, số bản ghi… Giữ ngắn. */
  meta?: ReactNode;
  /** Nút (i) đặt ngay sau tiêu đề. */
  hint?: ReactNode;
  children: ReactNode;
  /** Dải chân khối, ví dụ bảng xếp hạng đi kèm biểu đồ. */
  footer?: ReactNode;
  className?: string;
  /** Cho phép bỏ đệm mặc định khi thân khối tự lo bố cục. */
  bodyClassName?: string;
}

/**
 * Khung khối của bảng điều khiển: một hàng tiêu đề mảnh, phần thân, và một dải chân
 * tuỳ chọn. Mọi khối dùng chung khung này để nhịp dọc của trang không bị lệch.
 */
export function Panel({
  icon: Icon,
  title,
  meta,
  hint,
  children,
  footer,
  className = "",
  bodyClassName = "p-4",
}: PanelProps) {
  return (
    <section
      className={`flex flex-col rounded-xl border border-hairline bg-surface shadow-sm ${className}`}
    >
      <header className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-4 w-4 shrink-0 text-ink-muted" />
          <h2 className="truncate text-[13px] font-semibold text-ink">{title}</h2>
          {hint}
        </div>
        {meta ? (
          <p className="shrink-0 text-[11px] text-ink-muted">{meta}</p>
        ) : null}
      </header>

      <div className={bodyClassName}>{children}</div>

      {footer ? (
        <div className="border-t border-hairline px-4 py-3">{footer}</div>
      ) : null}
    </section>
  );
}
