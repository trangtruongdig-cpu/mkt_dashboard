import type { ComponentType, ReactNode } from "react";
import { Meter } from "@/components/ui/Meter";
import type { IconProps } from "@/components/ui/icons";

interface SummaryTileProps {
  icon: ComponentType<IconProps>;
  /** Nhãn ngắn, một dòng. Không đặt câu giải thích ở đây — đưa vào `hint`. */
  label: string;
  value: string;
  /** Đơn vị hoặc mẫu số đặt cạnh con số, cỡ nhỏ hơn. */
  unit?: string;
  delta?: { text: string; good: boolean };
  meter?: { ratio: number; color: string; label: string };
  /** Đường xu hướng nhỏ đặt dưới đáy ô. */
  trend?: ReactNode;
  /** Nút (i) — nơi cất phần diễn giải. */
  hint?: ReactNode;
  /** Làm nổi ô chỉ số dẫn dắt của cả trang. Đúng một ô mỗi hàng. */
  accent?: boolean;
}

/**
 * Ô chỉ số của hàng tổng quan.
 *
 * Cấu trúc cố định: hình → nhãn → con số → một kênh phụ (thanh đo hoặc đường xu
 * hướng). Giữ đúng thứ tự này ở cả bốn ô để mắt quét ngang một lần là đọc xong hàng,
 * không phải đọc lại bố cục ở từng ô.
 */
export function SummaryTile({
  icon: Icon,
  label,
  value,
  unit,
  delta,
  meter,
  trend,
  hint,
  accent = false,
}: SummaryTileProps) {
  return (
    <article
      className={`flex flex-col rounded-xl border bg-surface p-4 shadow-sm ${
        accent ? "border-series-1/40 ring-1 ring-series-1/15" : "border-hairline"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
            accent
              ? "bg-series-1/10 text-series-1"
              : "bg-surface-inset text-ink-secondary"
          }`}
        >
          <Icon className="h-4 w-4" />
        </span>
        {hint}
      </div>

      <p className="mt-3 text-[11px] leading-tight font-medium text-ink-muted">
        {label}
      </p>

      <p className="mt-1 flex items-baseline gap-1.5">
        {/* Con số lớn dùng chữ số tỷ lệ tự nhiên; tabular-nums chỉ để dành cho cột số. */}
        <span className="text-2xl leading-none font-semibold tracking-tight text-ink">
          {value}
        </span>
        {unit ? (
          <span className="text-xs text-ink-muted">{unit}</span>
        ) : null}
        {delta ? (
          <span
            className="text-xs font-medium"
            style={{
              color: delta.good ? "var(--delta-good)" : "var(--delta-bad)",
            }}
          >
            <span aria-hidden="true">{delta.good ? "▲" : "▼"}</span>{" "}
            {delta.text}
          </span>
        ) : null}
      </p>

      <div className="mt-auto pt-3">
        {meter ? (
          <Meter
            ariaLabel={meter.label}
            color={meter.color}
            ratio={meter.ratio}
          />
        ) : null}
        {trend}
      </div>
    </article>
  );
}
