import {
  COMMUNICATION_GOAL_LABELS,
  GROWTH_SOURCE_LABELS,
  OBJECTIVE_TIER_LABELS,
  ObjectiveTierSchema,
  type CascadeKpi,
  type Objective,
  type ObjectiveTier,
} from "@ptit/shared";

interface CascadeDiagramProps {
  objectives: Objective[];
  kpisByObjectiveKey: Map<string, CascadeKpi[]>;
}

/** Thứ nguyên của mỗi tầng — đây là phần LÝ THUYẾT, không suy ra được từ dữ liệu. */
const TIER_SUBJECT: Record<ObjectiveTier, string> = {
  business: "số liệu của Học viện",
  marketing: "hành vi của người học",
  communication: "nhận thức của người học",
};

const TIER_CONCEPTS: Record<ObjectiveTier, string> = {
  business: "Sale · Share · Growth · Profit",
  marketing: "Penetration · Frequency · Consumption · Choice · Loyalty",
  communication:
    "Awareness · Key attributes · Creative quality · Hiệu quả kênh",
};

/** Câu nối giữa hai tầng — chính là lập luận của khung, nên viết ra chứ không chỉ vẽ mũi tên. */
const TIER_BRIDGE: Record<ObjectiveTier, string | null> = {
  business: "Muốn đạt những con số đó, phải thay đổi hành vi của người học:",
  marketing:
    "Muốn thay đổi hành vi, phải thay đổi nhận thức — hành vi là do cách nghĩ:",
  communication: null,
};

/**
 * SƠ ĐỒ BA TẦNG, DỰNG TỪ CÂY MỤC TIÊU THẬT.
 *
 * Cố ý đọc `objectives` từ API chứ không viết cứng ba tầng vào trang: nếu cây mục tiêu
 * đổi mà sơ đồ lý thuyết không đổi theo thì trang này trở thành một bài giảng treo
 * tường, và người xem không còn cách nào biết dashboard có thật sự dựng theo khung hay
 * không. Sơ đồ lệch so với trang Mục tiêu là dấu hiệu cascade đã trôi.
 *
 * Trình bày dọc chứ không ngang: chuỗi suy diễn có chiều, và chiều dọc đọc được ở cả
 * màn hình điện thoại.
 */
export function CascadeDiagram({
  objectives,
  kpisByObjectiveKey,
}: CascadeDiagramProps) {
  return (
    <ol className="space-y-3">
      {ObjectiveTierSchema.options.map((tier) => {
        const trong_tang = objectives.filter((o) => o.tier === tier);
        const so_chi_so = trong_tang.reduce(
          (tong, o) => tong + (kpisByObjectiveKey.get(o.key)?.length ?? 0),
          0,
        );
        const bridge = TIER_BRIDGE[tier];

        return (
          <li key={tier}>
            <section className="rounded-xl border border-hairline bg-surface p-4">
              <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h3 className="text-sm font-semibold text-ink">
                  {OBJECTIVE_TIER_LABELS[tier]}
                  <span className="ml-2 font-normal text-ink-muted">
                    — đo {TIER_SUBJECT[tier]}
                  </span>
                </h3>
                <span className="text-[11px] text-ink-muted">
                  {trong_tang.length} mục tiêu · {so_chi_so} chỉ số
                </span>
              </header>

              <p className="mt-1 font-mono text-[11px] text-ink-secondary">
                {TIER_CONCEPTS[tier]}
              </p>

              <ul className="mt-3 space-y-1.5">
                {trong_tang.map((objective) => {
                  // Nhãn khái niệm của khung: tầng marketing mang nguồn tăng trưởng,
                  // tầng truyền thông mang nhóm mục tiêu truyền thông.
                  const khai_niem =
                    objective.growthSource !== null
                      ? GROWTH_SOURCE_LABELS[objective.growthSource]
                      : objective.communicationGoal !== null
                        ? COMMUNICATION_GOAL_LABELS[objective.communicationGoal]
                        : null;

                  return (
                    <li
                      key={objective.key}
                      className="rounded-lg border border-hairline bg-surface-inset px-3 py-2"
                    >
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        {khai_niem ? (
                          <span className="text-[11px] font-medium text-ink">
                            {khai_niem}
                          </span>
                        ) : null}
                        <code className="font-mono text-[10px] text-ink-muted">
                          {objective.key}
                        </code>
                        {objective.isFocus ? (
                          <span className="text-[10px] text-ink-muted">
                            · trọng tâm kỳ này
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-xs leading-snug text-ink-secondary">
                        {objective.statement}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </section>

            {bridge ? (
              <p className="px-4 py-2 text-xs leading-snug text-ink-secondary">
                <span aria-hidden="true" className="mr-1.5 text-ink-muted">
                  ↓
                </span>
                {bridge}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
