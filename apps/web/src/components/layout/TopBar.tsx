import Link from "next/link";
import type { ComponentType } from "react";
import {
  IconBarChart,
  IconGauge,
  IconLayers,
  IconPlug,
  type IconProps,
} from "@/components/ui/icons";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<IconProps>;
}

const NAV: readonly NavItem[] = [
  { href: "/", label: "Tổng quan", icon: IconGauge },
  { href: "/muc-tieu", label: "Mục tiêu", icon: IconLayers },
  { href: "/kenh", label: "Kênh", icon: IconBarChart },
  { href: "/ket-noi", label: "Kết nối", icon: IconPlug },
] as const;

interface TopBarProps {
  /** Đường dẫn của trang hiện tại, dùng để làm nổi mục đang xem. */
  active: string;
}

/**
 * Thanh điều hướng trên cùng.
 *
 * Điều hướng bằng hình + nhãn ngắn thay cho danh sách liên kết gạch chân: ở màn hình
 * hẹp nhãn tự ẩn, chỉ còn hình, nên thanh không bao giờ xuống dòng. Nhãn vẫn nằm
 * trong DOM cho trình đọc màn hình.
 */
export function TopBar({ active }: TopBarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-surface/90 backdrop-blur">
      <div className="mx-auto flex w-full max-w-[92rem] items-center gap-3 px-4 py-2.5 sm:px-6">
        <Link className="flex min-w-0 items-center gap-2.5" href="/">
          <span
            aria-hidden="true"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-series-1 text-[9px] font-bold tracking-tight text-white"
          >
            PTIT
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] leading-tight font-semibold text-ink">
              Bảng điều khiển Marketing số &amp; Thương hiệu
            </span>
            <span className="hidden truncate text-[11px] leading-tight text-ink-muted sm:block">
              Học viện Công nghệ Bưu chính Viễn thông
            </span>
          </span>
        </Link>

        <nav aria-label="Khu vực chính" className="ml-auto flex items-center gap-0.5">
          {NAV.map((item) => {
            const isActive = item.href === active;
            const Icon = item.icon;

            return (
              <Link
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-surface-inset text-ink"
                    : "text-ink-secondary hover:bg-surface-inset hover:text-ink"
                }`}
                href={item.href}
                key={item.href}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="sr-only md:not-sr-only">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
