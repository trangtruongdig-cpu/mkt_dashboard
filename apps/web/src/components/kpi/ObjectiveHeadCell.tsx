import {
  COMMUNICATION_GOAL_LABELS,
  GROWTH_SOURCE_LABELS,
  type CascadeKpi,
  type Objective,
} from "@ptit/shared";

interface ObjectiveHeadCellProps {
  objective: Objective;
  kpis: CascadeKpi[];
}

/**
 * Cột 1 của bảng điều khiển: mục tiêu.
 *
 * Ô này đứng đầu hàng và các chỉ số ở cột 2 là của riêng nó. Nhờ cách sắp này, câu
 * hỏi "chỉ số này liên quan tới mục tiêu gì" không cần trả lời bằng chú thích —
 * nó được trả lời bằng chính vị trí trên màn hình.
 */
export function ObjectiveHeadCell({
  objective,
  kpis,
}: ObjectiveHeadCellProps) {
  const badge =
    objective.growthSource !== null
      ? `Nguồn tăng trưởng: ${GROWTH_SOURCE_LABELS[objective.growthSource]}`
      : objective.communicationGoal !== null
        ? COMMUNICATION_GOAL_LABELS[objective.communicationGoal]
        : null;

  const measured = kpis.filter((k) => k.value !== null).length;

  return (
    <div
      className={`h-full rounded-lg border p-3.5 ${
        objective.isFocus
          ? "border-series-1/50 bg-series-1/5 ring-1 ring-series-1/20"
          : "border-hairline bg-surface"
      }`}
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        {badge ? (
          <span className="rounded-full border border-hairline px-2 py-0.5 text-[11px] text-ink-secondary">
            {badge}
          </span>
        ) : null}
        {objective.isFocus ? (
          <span className="rounded-full px-2 py-0.5 text-[11px] font-medium text-series-1 ring-1 ring-series-1/40">
            ★ Trọng tâm
          </span>
        ) : null}
      </div>

      <h3 className="text-sm leading-snug font-semibold text-ink">
        {objective.statement}
      </h3>
      <p className="mt-1.5 text-[11px] leading-relaxed text-ink-secondary">
        {objective.rationale}
      </p>
      <p className="mt-2.5 border-t border-hairline pt-2 text-[11px] text-ink-muted">
        {measured}/{kpis.length} chỉ số đã có số liệu
      </p>
    </div>
  );
}
