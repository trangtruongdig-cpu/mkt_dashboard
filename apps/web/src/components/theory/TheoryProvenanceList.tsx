import {
  OBJECTIVE_TIER_LABELS,
  ObjectiveTierSchema,
  type Objective,
} from "@ptit/shared";

interface TheoryProvenanceListProps {
  objectives: Objective[];
}

/**
 * XUẤT XỨ LÝ THUYẾT CỦA TỪNG MỤC TIÊU.
 *
 * Trang Dữ liệu trả lời "con số này ở đâu ra". Khối này trả lời câu còn lại, câu hội
 * đồng nghiệm thu sẽ hỏi: **căn cứ nào để chọn đo thứ này?**
 *
 * Khoá IBMC là bản TỔNG HỢP — không khái niệm nào trong khung là phát minh của khoá
 * học — nên mỗi mục tiêu phải trả được nợ nguồn tới tác giả thật. Dữ liệu lấy từ
 * trường `theory` trong hợp đồng dùng chung, không viết cứng ở đây: mục tiêu đổi thì
 * xuất xứ đổi theo, và một mục tiêu mới không có xuất xứ sẽ bị schema chặn ngay.
 */
export function TheoryProvenanceList({
  objectives,
}: TheoryProvenanceListProps) {
  return (
    <div className="space-y-5">
      {ObjectiveTierSchema.options.map((tier) => {
        const trong_tang = objectives.filter((o) => o.tier === tier);
        if (trong_tang.length === 0) return null;

        return (
          <section key={tier}>
            <h3 className="text-xs font-semibold tracking-wide text-ink-muted uppercase">
              {OBJECTIVE_TIER_LABELS[tier]}
            </h3>

            <ul className="mt-2 space-y-2">
              {trong_tang.map((objective) => (
                <li
                  key={objective.key}
                  className="rounded-lg border border-hairline bg-surface p-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="text-sm font-medium text-ink">
                      {objective.theory.concept}
                    </p>
                    <span className="text-[11px] whitespace-nowrap text-ink-muted">
                      Bài {objective.theory.lesson} ·{" "}
                      <code className="font-mono">{objective.key}</code>
                    </span>
                  </div>

                  <dl className="mt-2 space-y-1 text-[11px] leading-snug">
                    <div className="flex gap-2">
                      <dt className="w-20 shrink-0 text-ink-muted">Tác giả</dt>
                      <dd className="text-ink-secondary">
                        {objective.theory.origin}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="w-20 shrink-0 text-ink-muted">
                        Công trình
                      </dt>
                      <dd className="text-ink-secondary italic">
                        {objective.theory.work}
                      </dd>
                    </div>
                  </dl>

                  {/*
                    Cảnh báo nằm trong khung riêng và KHÔNG gấp lại sau nút (i): đây là
                    thứ làm người đọc đổi cách diễn giải con số, nên che nó đi là phản
                    tác dụng. Dùng viền vàng chứ không đỏ — lý thuyết gốc phản bác không
                    phải là lỗi của mục tiêu.
                  */}
                  {objective.theory.caveat !== null ? (
                    <p className="mt-2 border-l-[3px] border-l-status-warning bg-surface-inset px-3 py-2 text-[11px] leading-snug text-ink-secondary">
                      <span className="font-medium text-ink">
                        Lưu ý khi dùng:{" "}
                      </span>
                      {objective.theory.caveat}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
