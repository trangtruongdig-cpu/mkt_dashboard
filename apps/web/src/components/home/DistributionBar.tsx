import { GlyphPill, type Glyph } from "@/components/kpi/glyphs";
import type { ReactNode } from "react";

interface Segment {
  key: string;
  count: number;
  glyph: Glyph;
}

interface DistributionBarProps {
  title: string;
  segments: Segment[];
  total: number;
  /** Nút (i) đặt cạnh tiêu đề. */
  hint?: ReactNode;
}

/**
 * Thanh phân bố xếp chồng + chú giải.
 *
 * Hai quy tắc giữ nguyên từ bộ quy ước biểu đồ: khe hở 2px màu nền làm ranh giới giữa
 * các đoạn (không vẽ viền quanh đoạn), và chú giải luôn có mặt kèm HÌNH RIÊNG cho
 * từng mức — trạng thái không bao giờ chỉ mã hoá bằng màu.
 */
export function DistributionBar({
  title,
  segments,
  total,
  hint,
}: DistributionBarProps) {
  const shown = segments.filter((segment) => segment.count > 0);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium text-ink-muted">{title}</p>
        <div className="flex items-center gap-1">
          <p className="text-[11px] text-ink-muted tabular-nums">{total}</p>
          {hint}
        </div>
      </div>

      <div
        aria-label={`${title}: ${shown
          .map((segment) => `${segment.glyph.label} ${segment.count}`)
          .join(", ")}`}
        className="flex h-2 w-full gap-0.5"
        role="img"
      >
        {shown.map((segment) => (
          <span
            className="h-full rounded-full"
            key={segment.key}
            style={{
              flexGrow: segment.count,
              backgroundColor: segment.glyph.color,
            }}
          />
        ))}
      </div>

      <ul className="mt-2.5 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2 lg:grid-cols-1">
        {segments.map((segment) => (
          <li key={segment.key}>
            <GlyphPill count={segment.count} glyph={segment.glyph} />
          </li>
        ))}
      </ul>
    </div>
  );
}
