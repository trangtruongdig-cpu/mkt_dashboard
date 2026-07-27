import {
  COMMUNICATION_GOAL_LABELS,
  GROWTH_SOURCE_LABELS,
  OBJECTIVE_TIER_LABELS,
  type CascadeKpi,
  type Objective,
} from "@ptit/shared";
import type { ReactNode } from "react";
import { KpiRow } from "./KpiRow";

interface ObjectiveCardProps {
  objective: Objective;
  kpis: CascadeKpi[];
  /** Nội dung phụ đặt dưới danh sách chỉ số, ví dụ biểu đồ của chính mục tiêu này. */
  children?: ReactNode;
}

/**
 * Một mục tiêu kèm các chỉ số đo nó.
 *
 * Thứ tự hiển thị là cố ý: phát biểu mục tiêu trước, lý do tồn tại ngay sau, rồi mới
 * tới chỉ số. Người xem phải đọc được "vì sao đo cái này" trước khi nhìn thấy con số,
 * chứ không phải ngược lại.
 */
export function ObjectiveCard({
  objective,
  kpis,
  children,
}: ObjectiveCardProps) {
  const badge =
    objective.growthSource !== null
      ? `Nguồn tăng trưởng: ${GROWTH_SOURCE_LABELS[objective.growthSource]}`
      : objective.communicationGoal !== null
        ? COMMUNICATION_GOAL_LABELS[objective.communicationGoal]
        : null;

  return (
    <article
      className={`rounded-xl border bg-surface p-5 ${
        objective.isFocus
          ? "border-series-1/50 ring-1 ring-series-1/20"
          : "border-hairline"
      }`}
    >
      <header className="mb-3">
        <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[11px] font-medium tracking-wide text-ink-muted uppercase">
            {OBJECTIVE_TIER_LABELS[objective.tier]}
          </span>
          {badge ? (
            <span className="rounded-full border border-hairline px-2 py-0.5 text-[11px] text-ink-secondary">
              {badge}
            </span>
          ) : null}
          {objective.isFocus ? (
            <span className="rounded-full px-2 py-0.5 text-[11px] font-medium text-series-1 ring-1 ring-series-1/40">
              ★ Trọng tâm kỳ này
            </span>
          ) : null}
        </div>

        <h3 className="text-sm leading-snug font-semibold text-ink">
          {objective.statement}
        </h3>
        <p className="mt-1.5 text-xs leading-relaxed text-ink-secondary">
          {objective.rationale}
        </p>
      </header>

      <ul className="border-t border-hairline pt-3">
        {kpis.map((kpi) => (
          <KpiRow key={kpi.key} kpi={kpi} />
        ))}
      </ul>

      {children}
    </article>
  );
}
