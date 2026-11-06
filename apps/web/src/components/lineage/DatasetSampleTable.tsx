import type { Dataset, DatasetSample } from "@ptit/shared";
import { formatNumber } from "@/lib/format";

interface DatasetSampleTableProps {
  sample: DatasetSample;
  dataset: Dataset | undefined;
}

/**
 * Vài dòng đầu của một bảng thô, hiện đúng như nó nằm trong kho.
 *
 * Không làm đẹp, không đổi tên cột, không định dạng lại số: đây là chỗ người xem đối
 * chiếu với dữ liệu gốc, nên mọi phép làm đẹp đều làm giảm giá trị của nó. Bảng cuộn
 * ngang trong khung riêng để trang không bao giờ cuộn ngang theo.
 */
export function DatasetSampleTable({ sample, dataset }: DatasetSampleTableProps) {
  return (
    <section className="rounded-lg border border-hairline bg-surface">
      <header className="border-b border-hairline px-3 py-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <code className="font-mono text-xs text-ink">{sample.dataset}</code>
          <span className="text-[11px] text-ink-muted">
            {sample.limit} dòng đầu
            {dataset?.rowCount != null
              ? ` trên ${formatNumber(dataset.rowCount)} dòng`
              : null}
            {" · "}
            {sample.columns.length} cột
          </span>
        </div>
        {dataset ? (
          <p className="mt-0.5 text-[11px] leading-snug text-ink-secondary">
            {dataset.description}
          </p>
        ) : null}
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-[11px]">
          <caption className="sr-only">
            {sample.limit} dòng đầu của bảng {sample.dataset}
          </caption>
          <thead>
            <tr className="border-b border-hairline text-left">
              {sample.columns.map((c) => (
                <th
                  key={c}
                  className="px-2.5 py-1.5 font-mono font-medium whitespace-nowrap text-ink-muted"
                  scope="col"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sample.rows.map((dong, i) => (
              // Dòng dữ liệu thô không có khoá tự nhiên ổn định ở tầng trình bày;
              // thứ tự là thứ tự kho trả về nên chỉ số dòng là khoá đúng ở đây.
              <tr key={i} className="border-b border-hairline last:border-b-0">
                {dong.map((o, j) => (
                  <td
                    key={j}
                    className="max-w-[22rem] truncate px-2.5 py-1.5 font-mono text-ink-secondary"
                    title={o ?? "NULL"}
                  >
                    {o === null ? (
                      <span className="text-ink-muted italic">NULL</span>
                    ) : (
                      o
                    )}
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
