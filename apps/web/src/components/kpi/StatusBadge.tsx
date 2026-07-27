import { KPI_STATUS_LABELS, type KpiStatus } from "@ptit/shared";

/**
 * Nhãn trạng thái KPI.
 *
 * Trạng thái KHÔNG BAO GIỜ chỉ mã hoá bằng màu: mỗi mức có ký hiệu hình riêng và
 * nhãn chữ đầy đủ, để đọc được khi mù màu và khi in đen trắng cho hồ sơ nghiệm thu.
 */
const STATUS_STYLE: Record<KpiStatus, { glyph: string; color: string }> = {
  on_track: { glyph: "●", color: "var(--status-good)" },
  at_risk: { glyph: "◐", color: "var(--status-warning)" },
  off_track: { glyph: "○", color: "var(--status-bad)" },
  baseline_pending: { glyph: "–", color: "var(--status-none)" },
};

interface StatusBadgeProps {
  status: KpiStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { glyph, color } = STATUS_STYLE[status];

  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium"
      style={{ color }}
    >
      <span aria-hidden="true">{glyph}</span>
      {KPI_STATUS_LABELS[status]}
    </span>
  );
}
