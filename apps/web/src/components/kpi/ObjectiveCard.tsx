import {
  COMMUNICATION_GOAL_LABELS,
  GROWTH_SOURCE_LABELS,
  OBJECTIVE_TIER_LABELS,
  type CascadeKpi,
  type Objective,
} from "@ptit/shared";
import type { ReactNode } from "react";
import { InfoHint } from "@/components/ui/InfoHint";
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
 *
 * `theory.caveat` đứng ngay cạnh phát biểu mục tiêu chứ không nằm riêng ở trang Lý
 * thuyết: nó là thứ làm người đọc đổi cách DIỄN GIẢI con số bên dưới. "Thị phần tìm
 * kiếm là proxy hành vi, không phải top of mind" mà đọc sau khi đã kết luận thì đã
 * muộn. Bốn thuộc tính còn lại của `theory` thuộc về trang /khung, không nhét vào đây.
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

        <div className="flex items-start gap-1.5">
          <h3 className="text-sm leading-snug font-semibold text-ink">
            {objective.statement}
          </h3>
          {/* Chỉ dựng nút khi THẬT SỰ có cảnh báo — nút (i) rỗng làm người xem mất
              công bấm để đọc một bảng trống. */}
          {objective.theory.caveat ? (
            <InfoHint
              label={`Giới hạn lý thuyết của mục tiêu ${objective.statement}`}
            >
              <p className="mb-1.5 font-medium text-ink">
                {objective.theory.concept} — {objective.theory.origin}
              </p>
              <p>{objective.theory.caveat}</p>
            </InfoHint>
          ) : null}
        </div>
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
