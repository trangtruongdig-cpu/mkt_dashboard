import {
  GROWTH_SOURCE_LABELS,
  GrowthSourceSchema,
  type CascadeKpi,
  type Objective,
} from "@ptit/shared";
import { StatusBadge } from "./StatusBadge";

interface GrowthSourceStripProps {
  objectives: Objective[];
  kpisByObjectiveKey: Map<string, CascadeKpi[]>;
}

/**
 * Năm nguồn tăng trưởng, đặt ngay đầu trang.
 *
 * Đây là câu hỏi phải trả lời trước mọi câu khác: Học viện đang lớn lên bằng nguồn
 * nào. Nguồn tăng trưởng là MỤC TIÊU MARKETING — chúng mô tả thay đổi trong hành vi
 * người học, không phải số liệu của Học viện; tầng kinh doanh là sale, share, growth,
 * profit.
 */
export function GrowthSourceStrip({
  objectives,
  kpisByObjectiveKey,
}: GrowthSourceStripProps) {
  // Duyệt theo thứ tự khai trong enum để hàng thẻ không đổi chỗ giữa các lần tải.
  const cards = GrowthSourceSchema.options.map((source) => {
    // Nhận diện bằng CHÍNH `growthSource`, không bằng tầng. Lọc kèm `tier` là giả
    // định thừa: nó đã từng đúng khi nguồn tăng trưởng nằm ở tầng kinh doanh, và khi
    // chúng chuyển xuống tầng marketing thì cả dải thẻ lặng lẽ render rỗng — kiểu dữ
    // liệu vẫn hợp lệ nên tsc không bắt được.
    const objective = objectives.find((o) => o.growthSource === source);
    return { source, objective };
  });

  return (
    <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map(({ source, objective }) => {
        const kpis = objective ? (kpisByObjectiveKey.get(objective.key) ?? []) : [];
        const doMeasured = kpis.filter((k) => k.value !== null).length;

        return (
          <li
            key={source}
            className={`rounded-xl border bg-surface p-4 ${
              objective?.isFocus
                ? "border-series-1/50 ring-1 ring-series-1/20"
                : "border-hairline"
            }`}
          >
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              {objective?.isFocus ? (
                <span className="text-series-1" title="Trọng tâm kỳ này">
                  ★
                </span>
              ) : null}
              {GROWTH_SOURCE_LABELS[source]}
            </p>

            {objective ? (
              <>
                <p className="mt-1.5 text-xs leading-snug text-ink-secondary">
                  {objective.statement}
                </p>
                <p className="mt-2.5 text-[11px] text-ink-muted">
                  {doMeasured}/{kpis.length} chỉ số đã có số liệu
                </p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                  {kpis.map((kpi) => (
                    <StatusBadge key={kpi.key} status={kpi.status} />
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-1.5 text-xs text-ink-muted">
                Chưa đặt mục tiêu cho nguồn tăng trưởng này.
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
