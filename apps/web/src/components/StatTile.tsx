import type { KpiMetric } from "@ptit/shared";
import { formatMetric, formatPercent } from "@/lib/format";

interface StatTileProps {
  metric: KpiMetric;
}

/**
 * Ô chỉ số. Chiều biến động không chỉ dựa vào màu — luôn kèm mũi tên và dấu —
 * để người mù màu và bản in đen trắng vẫn đọc được.
 */
export function StatTile({ metric }: StatTileProps) {
  const { deltaPct, higherIsBetter } = metric;
  const isGood = deltaPct === null ? null : deltaPct >= 0 === higherIsBetter;

  return (
    <div className="rounded-xl border border-hairline bg-surface p-4">
      <p className="text-xs text-ink-secondary">{metric.label}</p>
      <p className="mt-1.5 text-2xl font-semibold text-ink">
        {formatMetric(metric.value, metric.unit)}
      </p>

      {deltaPct !== null ? (
        <p
          className="mt-1 text-xs font-medium"
          style={{
            color: isGood ? "var(--delta-good)" : "var(--delta-bad)",
          }}
        >
          {deltaPct >= 0 ? "▲" : "▼"} {formatPercent(Math.abs(deltaPct))}{" "}
          <span className="font-normal text-ink-muted">so với kỳ trước</span>
        </p>
      ) : null}

      {metric.hint ? (
        <p className="mt-2 text-[11px] leading-snug text-ink-muted">
          {metric.hint}
        </p>
      ) : null}
    </div>
  );
}
