import {
  completionRatio,
  KPI_CADENCE_LABELS,
  type CascadeKpi,
} from "@ptit/shared";
import { formatMetric } from "@/lib/format";
import { StatusBadge } from "./StatusBadge";

interface KpiRowProps {
  kpi: CascadeKpi;
}

/**
 * Một chỉ số trong cascade.
 *
 * Mỗi dòng phải trả lời được ba câu mà không cần hỏi thêm: đang ở đâu, cần tới đâu,
 * và con số này lấy từ nguồn nào. Bỏ vế thứ ba là quay lại đúng cái dashboard chỉ
 * biểu diễn số liệu mà nhiệm vụ này muốn tránh.
 */
export function KpiRow({ kpi }: KpiRowProps) {
  const ratio = completionRatio(kpi.value, kpi.target, kpi.higherIsBetter);
  const barWidth = ratio === null ? 0 : Math.min(Math.max(ratio, 0), 1) * 100;

  const barColor =
    kpi.status === "on_track"
      ? "var(--status-good)"
      : kpi.status === "at_risk"
        ? "var(--status-warning)"
        : "var(--status-bad)";

  return (
    <li className="border-t border-hairline py-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm text-ink">{kpi.label}</p>
        <StatusBadge status={kpi.status} />
      </div>

      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <p className="text-xl font-semibold text-ink tabular-nums">
          {kpi.value === null ? (
            <span className="text-ink-muted">—</span>
          ) : (
            formatMetric(kpi.value, kpi.unit)
          )}
        </p>
        {kpi.target !== null ? (
          <p className="text-xs text-ink-secondary tabular-nums">
            Mục tiêu {formatMetric(kpi.target, kpi.unit)}
          </p>
        ) : null}
        <p className="text-[11px] text-ink-muted">
          {KPI_CADENCE_LABELS[kpi.cadence]}
        </p>
      </div>

      {ratio !== null ? (
        <div
          className="mt-2 h-1 w-full overflow-hidden rounded-full bg-grid"
          role="img"
          aria-label={`Đạt ${Math.round(ratio * 100)}% mục tiêu`}
        >
          <div
            className="h-full rounded-full"
            style={{ width: `${barWidth}%`, backgroundColor: barColor }}
          />
        </div>
      ) : null}

      {kpi.hint ? (
        <p className="mt-2 text-[11px] leading-snug text-ink-secondary">
          {kpi.hint}
        </p>
      ) : null}

      <p className="mt-1.5 text-[11px] leading-snug text-ink-muted">
        Nguồn:{" "}
        {kpi.provenance.url ? (
          <a
            className="underline underline-offset-2 hover:text-ink-secondary"
            href={kpi.provenance.url}
            rel="noreferrer"
            target="_blank"
          >
            {kpi.provenance.label}
          </a>
        ) : (
          kpi.provenance.label
        )}
        {kpi.provenance.legalBasis ? ` · ${kpi.provenance.legalBasis}` : null}
      </p>
    </li>
  );
}
