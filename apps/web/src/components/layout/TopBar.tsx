"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import {
  IconBarChart,
  IconBook,
  IconDatabase,
  IconGauge,
  IconGitCompare,
  IconLayers,
  IconMegaphone,
  IconPlug,
  IconShield,
  IconTag,
  type IconProps,
} from "@/components/ui/icons";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<IconProps>;
}

/**
 * Nhóm ĐỌC KẾT QUẢ, xếp theo đúng chuỗi suy diễn của bảng điều khiển: tổng quan →
 * cây mục tiêu → vị trí so với đối thủ → bằng chứng từ kênh của Học viện → bằng chứng
 * từ bên ngoài → xuất xứ số liệu → xuất xứ của chính cây mục tiêu.
 *
 * "Đối sánh" đứng ngay sau "Mục tiêu" vì khung IBMC đòi đọc theo thứ tự đó: một con số
 * của Học viện không có nghĩa cho tới khi đặt cạnh cùng con số đó của nhóm cạnh tranh.
 *
 * Hai mục cuối là một cặp và vì thế đứng cạnh nhau: "Dữ liệu" trả lời con số đến từ
 * đâu, "Lý thuyết" trả lời mục tiêu đến từ đâu. Hội đồng nghiệm thu sẽ hỏi cả hai.
 */
const NAV_DOC: readonly NavItem[] = [
  { href: "/", label: "Tổng quan", icon: IconGauge },
  { href: "/muc-tieu", label: "Mục tiêu", icon: IconLayers },
  { href: "/doi-sanh", label: "Đối sánh", icon: IconGitCompare },
  { href: "/kenh", label: "Kênh", icon: IconBarChart },
  { href: "/lang-nghe", label: "Lắng nghe", icon: IconMegaphone },
  { href: "/du-lieu", label: "Dữ liệu", icon: IconDatabase },
  { href: "/khung", label: "Lý thuyết", icon: IconBook },
] as const;

/**
 * Nhóm CÔNG CỤ & VẬN HÀNH — không phải chỗ đọc số liệu, nên tách khỏi nhóm trên bằng
 * một vạch.
 *
 * Ba trang này trước đây KHÔNG có đường nào dẫn tới: `/utm`, `/quan-tri` không được
 * liên kết từ bất kỳ đâu trong ứng dụng, còn `/lang-nghe` ở nhóm trên chỉ vào được qua
 * một liên kết nằm giữa thân trang `/kenh`. Viết xong một trang mà không ai mở được
 * thì chẳng khác gì chưa viết.
 */
const NAV_CONG_CU: readonly NavItem[] = [
  { href: "/utm", label: "UTM", icon: IconTag },
  { href: "/ket-noi", label: "Kết nối", icon: IconPlug },
  { href: "/quan-tri", label: "Quản trị", icon: IconShield },
] as const;


/**
 * Thanh điều hướng trên cùng.
 *
 * Điều hướng bằng hình + nhãn ngắn thay cho danh sách liên kết gạch chân: ở màn hình
 * hẹp nhãn tự ẩn, chỉ còn hình, nên thanh không bao giờ xuống dòng. Nhãn vẫn nằm
 * trong DOM cho trình đọc màn hình.
 */
export function TopBar() {
  const active = usePathname();

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
          {NAV_DOC.map((item) => (
            <NavLink active={active} item={item} key={item.href} />
          ))}

          <span aria-hidden="true" className="mx-1.5 h-5 w-px bg-hairline" />

          {NAV_CONG_CU.map((item) => (
            <NavLink active={active} item={item} key={item.href} />
          ))}
        </nav>
      </div>
    </header>
  );
}

interface NavLinkProps {
  item: NavItem;
  active: string;
}

/**
 * Một mục điều hướng.
 *
 * Nhãn chữ ẩn bằng `sr-only` ở màn hình hẹp chứ không bị bỏ khỏi DOM: thanh không bao
 * giờ xuống dòng, mà trình đọc màn hình và bản in vẫn có đủ chữ.
 *
 * Ngưỡng hiện nhãn là 1400px, đo chứ không đoán. Thanh có chín mục; ở 1024px tám nhãn
 * tiếng Việt đã đủ chật để trình duyệt ngắt chúng giữa chừng ("Tổng quan" tụt thành
 * hai dòng), còn ở 1280px thì chín nhãn tràn hẳn ra ngoài — hai mục cuối biến mất.
 * 1400px là chỗ hàng nhãn vừa khít; dưới ngưỡng thì chỉ còn hình, không bao giờ xuống
 * dòng. `whitespace-nowrap` chặn nốt khả năng ngắt từ ở cỡ màn hình chưa lường trước.
 *
 * Số đo hiện tại, 10 mục: hàng nhãn cần 910px, khối thương hiệu 323px, tổng 1.293px
 * trong ngưỡng 1.400 — còn dư khoảng 107px, tức vừa đúng một mục nữa. Thêm mục thứ
 * mười hai thì PHẢI nâng ngưỡng, và PHẢI đo chứ đừng đoán: lần trước đoán 1280px
 * đủ thì thanh tràn mất hai mục cuối.
 */
function NavLink({ item, active }: NavLinkProps) {
  // Trang con làm nổi mục cha: ở `/muc-tieu/sua` thì mục "Mục tiêu" vẫn sáng.
  const isActive =
    active === item.href ||
    (item.href !== "/" && active.startsWith(`${item.href}/`));
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
      title={item.label}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="sr-only whitespace-nowrap min-[1400px]:not-sr-only">
        {item.label}
      </span>
    </Link>
  );
}
