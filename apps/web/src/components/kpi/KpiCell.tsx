import { completionRatio, KPI_CADENCE_LABELS, type CascadeKpi } from "@ptit/shared";
import { formatMetric } from "@/lib/format";
import { StatusBadge } from "./StatusBadge";

interface KpiCellProps {
  kpi: CascadeKpi;
}

/**
 * Cột 2 của bảng điều khiển: chỉ số cần đạt.
 *
 * Bắt buộc có phần diễn giải hai chiều bên dưới con số. Một chỉ số không nói được
 * chiều nào là tích cực cho mục tiêu thì người xem chỉ đọc được con số chứ không
 * đọc được tình hình — và đó đúng là thứ bảng điều khiển này sinh ra để tránh.
 */
export function KpiCell({ kpi }: KpiCellProps) {
  const ratio = completionRatio(kpi.value, kpi.target, kpi.higherIsBetter);
  const barWidth = ratio === null ? 0 : Math.min(Math.max(ratio, 0), 1) * 100;
  const barColor =
    kpi.status === "on_track"
      ? "var(--status-good)"
      : kpi.status === "at_risk"
        ? "var(--status-warning)"
        : "var(--status-bad)";

  return (
    <div className="rounded-lg border border-hairline bg-surface p-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-medium text-ink">{kpi.label}</p>
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
            Cần đạt {formatMetric(kpi.target, kpi.unit)}
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

      <dl className="mt-3 space-y-1 border-t border-hairline pt-2.5 text-[11px] leading-snug">
        <div className="flex gap-1.5">
          <dt
            className="shrink-0 font-medium"
            style={{ color: "var(--delta-good)" }}
          >
            <span aria-hidden="true">▲</span> Tích cực
          </dt>
          <dd className="text-ink-secondary">{kpi.interpretation.positive}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt
            className="shrink-0 font-medium"
            style={{ color: "var(--delta-bad)" }}
          >
            <span aria-hidden="true">▼</span> Tiêu cực
          </dt>
          <dd className="text-ink-secondary">{kpi.interpretation.negative}</dd>
        </div>
      </dl>

      <p className="mt-2 text-[11px] leading-snug text-ink-muted">
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
    </div>
  );
}
