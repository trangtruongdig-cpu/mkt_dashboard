export type QuadrantTone = "good" | "warning" | "bad" | "neutral";

export interface QuadrantCell {
  /** Kết luận của ô, viết thành câu đọc được — đây là nội dung chính, không phải màu. */
  verdict: string;
  body: string;
  tone: QuadrantTone;
}

interface QuadrantMatrixProps {
  title: string;
  /** Bài trong khoá IBMC sinh ra ma trận này. */
  lesson: string;
  intro: string;
  rowLabels: [string, string];
  colLabels: [string, string];
  /** Theo thứ tự đọc của lưới: trên-trái, trên-phải, dưới-trái, dưới-phải. */
  cells: [QuadrantCell, QuadrantCell, QuadrantCell, QuadrantCell];
}

/**
 * MA TRẬN 2×2 CỦA KHUNG IBMC — dựng bằng `<table>`, không bằng lưới CSS.
 *
 * Một ma trận 2×2 *là* một bảng hai chiều: hai nhãn hàng, hai nhãn cột, bốn ô kết
 * luận. Dùng `<table>` với `scope` đúng thì trình đọc màn hình đọc được "hàng doanh
 * số tăng, cột tăng chậm hơn ngành" — còn lưới `div` thì chỉ đọc ra bốn khối chữ rời
 * nhau, mất hẳn cái làm nên ý nghĩa của ma trận.
 *
 * Màu chỉ là lớp phụ: kết luận của mỗi ô luôn được viết thành chữ (`verdict`). Ô "tệ
 * nhất" phải đọc ra được khi in đen trắng cho hồ sơ nghiệm thu và khi người xem mù màu.
 */
export function QuadrantMatrix({
  title,
  lesson,
  intro,
  rowLabels,
  colLabels,
  cells,
}: QuadrantMatrixProps) {
  const tone: Record<QuadrantTone, string> = {
    good: "border-l-status-good",
    warning: "border-l-status-warning",
    bad: "border-l-status-bad",
    neutral: "border-l-status-none",
  };

  return (
    <section className="rounded-xl border border-hairline bg-surface">
      <header className="border-b border-hairline px-4 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          <span className="text-[11px] text-ink-muted">Bài {lesson}</span>
        </div>
        <p className="mt-1 text-xs leading-snug text-ink-secondary">{intro}</p>
      </header>

      <div className="overflow-x-auto">
        {/*
          `table-fixed` để hai ô của một hàng luôn rộng bằng nhau: ma trận 2×2 mà hai ô
          lệch bề rộng thì mắt đọc ra một ô quan trọng hơn ô kia, trong khi bốn ô là bốn
          khả năng ngang hàng. Cột nhãn hàng ghim 7rem, phần còn lại chia đôi.
        */}
        <table className="w-full min-w-[32rem] table-fixed border-collapse text-left">
          <caption className="sr-only">
            {title} — ma trận hai chiều, bốn kết luận
          </caption>
          <thead>
            <tr>
              <td className="w-28" />
              {colLabels.map((label) => (
                <th
                  key={label}
                  className="border-b border-hairline px-3 py-2 align-bottom text-[11px] font-medium text-ink-muted"
                  scope="col"
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowLabels.map((rowLabel, hang) => (
              <tr key={rowLabel}>
                <th
                  className="border-r border-hairline px-3 py-3 align-top text-[11px] font-medium text-ink-muted"
                  scope="row"
                >
                  {rowLabel}
                </th>
                {[cells[hang * 2], cells[hang * 2 + 1]].map((cell, cot) => (
                  <td
                    key={cot}
                    className={`border-l-[3px] px-3 py-3 align-top ${tone[cell.tone]} ${
                      hang === 0 ? "border-b border-b-hairline" : ""
                    }`}
                  >
                    <p className="text-xs font-semibold text-ink">
                      {cell.verdict}
                    </p>
                    <p className="mt-1 text-[11px] leading-snug text-ink-secondary">
                      {cell.body}
                    </p>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
