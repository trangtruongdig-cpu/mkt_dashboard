import { DATA_READINESS_LABELS, type DataReadiness } from "@ptit/shared";

/**
 * Mức sẵn sàng của nguồn dữ liệu.
 *
 * Như mọi nhãn trạng thái khác trong hệ thống: có ký hiệu hình và nhãn chữ, không
 * bao giờ chỉ mã hoá bằng màu.
 */
const READINESS_STYLE: Record<DataReadiness, { glyph: string; color: string }> =
  {
    connected: { glyph: "●", color: "var(--status-good)" },
    public_ready: { glyph: "◐", color: "var(--status-warning)" },
    needs_build: { glyph: "◔", color: "var(--status-none)" },
    needs_access: { glyph: "🔒", color: "var(--status-bad)" },
    not_planned: { glyph: "○", color: "var(--status-none)" },
  };

interface ReadinessBadgeProps {
  readiness: DataReadiness;
}

export function ReadinessBadge({ readiness }: ReadinessBadgeProps) {
  const { glyph, color } = READINESS_STYLE[readiness];

  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-medium"
      style={{ color }}
    >
      <span aria-hidden="true">{glyph}</span>
      {DATA_READINESS_LABELS[readiness]}
    </span>
  );
}
