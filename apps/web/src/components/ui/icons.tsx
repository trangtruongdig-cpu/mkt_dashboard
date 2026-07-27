import type { ReactNode, SVGProps } from "react";

/**
 * BỘ BIỂU TƯỢNG — vẽ tay bằng SVG, không thêm thư viện icon.
 *
 * Ba lý do giữ bộ này nằm trong repo thay vì cài `lucide-react` hay tương đương:
 * máy chủ Học viện có thể không ra được Internet nên mọi thứ phải nằm sẵn trong ảnh
 * build; bảng điều khiển chỉ dùng khoảng hai chục hình nên không đáng đánh đổi một
 * dependency; và nét vẽ thống nhất (24×24, stroke 1.75, bo tròn đầu nét) là thứ phải
 * kiểm soát được để hàng biểu tượng trông cùng một hệ.
 *
 * Mọi biểu tượng đều `aria-hidden` — chúng luôn đi kèm nhãn chữ hoặc `sr-only` ở
 * component gọi, không bao giờ là kênh thông tin duy nhất.
 */

export type IconProps = Omit<SVGProps<SVGSVGElement>, "children" | "viewBox">;

interface BaseIconProps extends IconProps {
  children: ReactNode;
}

function BaseIcon({ className = "h-4 w-4", children, ...rest }: BaseIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.75}
      viewBox="0 0 24 24"
      {...rest}
    >
      {children}
    </svg>
  );
}

// ── Điều hướng và khung ──────────────────────────────────────────────────────

export function IconGauge(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 17.5a8.5 8.5 0 1 1 16 0" />
      <path d="M12 17.5 15.8 10" />
      <circle cx="12" cy="17.5" r="1.2" />
    </BaseIcon>
  );
}

export function IconLayers(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m12 3 9 5-9 5-9-5z" />
      <path d="m3 13 9 5 9-5" />
    </BaseIcon>
  );
}

export function IconBarChart(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M3.5 20.5h17" />
      <path d="M6.5 20.5V12" />
      <path d="M12 20.5V4.5" />
      <path d="M17.5 20.5v-6" />
    </BaseIcon>
  );
}

export function IconPlug(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m9.5 14.5 5-5" />
      <path d="M8 12 5.5 14.5a3.5 3.5 0 0 0 5 5L13 17" />
      <path d="m11 7 2.5-2.5a3.5 3.5 0 0 1 5 5L16 12" />
    </BaseIcon>
  );
}

export function IconArrowRight(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 12h15" />
      <path d="m13 6 6 6-6 6" />
    </BaseIcon>
  );
}

export function IconArrowDown(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 4v15" />
      <path d="m6 13 6 6 6-6" />
    </BaseIcon>
  );
}

export function IconChevronDown(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m6 9.5 6 6 6-6" />
    </BaseIcon>
  );
}

export function IconInfo(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 7.8h.01" />
    </BaseIcon>
  );
}

export function IconExternal(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M14 4h6v6" />
      <path d="M20 4 11.5 12.5" />
      <path d="M19 14.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h4.5" />
    </BaseIcon>
  );
}

// ── Trạng thái chỉ số ────────────────────────────────────────────────────────

export function IconCheckCircle(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8 12.4 2.8 2.8L16 9.5" />
    </BaseIcon>
  );
}

export function IconAlertTriangle(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M12 4.2 20.5 19h-17z" />
      <path d="M12 10v3.6" />
      <path d="M12 16.6h.01" />
    </BaseIcon>
  );
}

export function IconXCircle(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="m9.2 9.2 5.6 5.6" />
      <path d="m14.8 9.2-5.6 5.6" />
    </BaseIcon>
  );
}

export function IconClock(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.2V12l3.2 2" />
    </BaseIcon>
  );
}

export function IconMinusCircle(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.2 12h7.6" />
    </BaseIcon>
  );
}

export function IconLock(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect height="10" rx="2" width="14" x="5" y="10.5" />
      <path d="M8.5 10.5V7.8a3.5 3.5 0 0 1 7 0v2.7" />
    </BaseIcon>
  );
}

export function IconCode(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m9 8-4 4 4 4" />
      <path d="m15 8 4 4-4 4" />
    </BaseIcon>
  );
}

export function IconDatabase(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <ellipse cx="12" cy="6" rx="8" ry="3" />
      <path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6" />
      <path d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
    </BaseIcon>
  );
}

// ── Nguồn tăng trưởng và mục tiêu ────────────────────────────────────────────

export function IconTarget(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" />
    </BaseIcon>
  );
}

export function IconUsers(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="9.5" cy="8" r="3.5" />
      <path d="M3.5 19.5a6 6 0 0 1 12 0" />
      <path d="M16.5 5.3a3.5 3.5 0 0 1 0 5.4" />
      <path d="M18 14.2a6 6 0 0 1 2.5 4.9" />
    </BaseIcon>
  );
}

export function IconRepeat(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m16.5 3 3 3-3 3" />
      <path d="M19.5 6H7.5a3.5 3.5 0 0 0-3.5 3.5v1" />
      <path d="m7.5 21-3-3 3-3" />
      <path d="M4.5 18h12a3.5 3.5 0 0 0 3.5-3.5v-1" />
    </BaseIcon>
  );
}

export function IconWallet(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <rect height="13" rx="2.5" width="17" x="3.5" y="6" />
      <path d="M3.5 10.5h17" />
      <path d="M16.5 15h.01" />
    </BaseIcon>
  );
}

export function IconShield(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m12 3.2 7.5 3v5.5c0 4.3-3 7.8-7.5 9.1-4.5-1.3-7.5-4.8-7.5-9.1V6.2z" />
    </BaseIcon>
  );
}

export function IconBuilding(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 20.5h16" />
      <path d="M5.5 20.5V4.5a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v16" />
      <path d="M9 8h2" />
      <path d="M13 8h2" />
      <path d="M9 12h2" />
      <path d="M13 12h2" />
      <path d="M10.5 20.5v-4h3v4" />
    </BaseIcon>
  );
}

export function IconTrendingUp(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m3.5 17 6-6 4 4 7-7" />
      <path d="M15 8h5.5v5.5" />
    </BaseIcon>
  );
}

export function IconMegaphone(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M4 10.5v3a1.5 1.5 0 0 0 1.5 1.5H7l9 4.5v-15L7 9H5.5A1.5 1.5 0 0 0 4 10.5z" />
      <path d="M19 9.5a3.2 3.2 0 0 1 0 5" />
      <path d="M7 15v5" />
    </BaseIcon>
  );
}

export function IconStar(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m12 3.5 2.6 5.3 5.9.85-4.25 4.15 1 5.85L12 16.9 6.75 19.6l1-5.85L3.5 9.65l5.9-.85z" />
    </BaseIcon>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="m16.2 16.2 4.3 4.3" />
    </BaseIcon>
  );
}

export function IconTag(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="M11.2 3.5H4.5a1 1 0 0 0-1 1v6.7a1 1 0 0 0 .3.7l8.3 8.3a1.5 1.5 0 0 0 2.1 0l6.1-6.1a1.5 1.5 0 0 0 0-2.1l-8.3-8.3a1 1 0 0 0-.8-.2z" />
      <path d="M7.8 7.8h.01" />
    </BaseIcon>
  );
}

export function IconBroadcast(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <circle cx="12" cy="12" r="2.2" />
      <path d="M8 8a5.7 5.7 0 0 0 0 8" />
      <path d="M16 16a5.7 5.7 0 0 0 0-8" />
      <path d="M5.2 5.2a9.6 9.6 0 0 0 0 13.6" />
      <path d="M18.8 18.8a9.6 9.6 0 0 0 0-13.6" />
    </BaseIcon>
  );
}

export function IconSparkles(props: IconProps) {
  return (
    <BaseIcon {...props}>
      <path d="m10 3.5 1.5 4L15.5 9l-4 1.5-1.5 4-1.5-4L4.5 9l4-1.5z" />
      <path d="m17.5 14 .9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9z" />
    </BaseIcon>
  );
}
