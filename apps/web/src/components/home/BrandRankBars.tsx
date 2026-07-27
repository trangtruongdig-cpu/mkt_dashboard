import type { BrandRank } from "@ptit/shared";
import { formatPercent } from "@/lib/format";

interface BrandRankBarsProps {
  rows: BrandRank[];
}

/**
 * Xếp hạng thị phần tìm kiếm tuần gần nhất — vừa là bảng, vừa là biểu đồ cột ngang.
 *
 * Bảng này bắt buộc phải có: trên biểu đồ đường, năm trường đối sánh dùng chung một
 * màu bối cảnh nên không đọc được tên. Danh tính quay lại đầy đủ ở đây, và vì nó là
 * `<table>` thật nên trình đọc màn hình và bản in đen trắng đều dùng được.
 *
 * Cột thay đổi chỉ tô màu cho hàng của Học viện. Với năm trường còn lại, thị phần
 * tăng KHÔNG phải tin tốt cho Học viện — tô xanh cho một đối thủ đang đi lên là nói
 * ngược ý nghĩa, nên phần đó để nguyên màu chữ và chỉ giữ mũi tên chỉ chiều.
 */
export function BrandRankBars({ rows }: BrandRankBarsProps) {
  const max = Math.max(...rows.map((row) => row.sharePct), 1);

  return (
    <table className="w-full text-xs">
      <caption className="sr-only">
        Thị phần tìm kiếm tuần gần nhất theo trường, xếp giảm dần
      </caption>
      <thead>
        <tr className="text-[10px] tracking-wide text-ink-muted uppercase">
          <th className="pb-1.5 text-left font-medium" scope="col">
            Trường
          </th>
          <th className="pb-1.5 text-right font-medium" scope="col">
            Thị phần
          </th>
          <th className="pb-1.5 text-right font-medium" scope="col">
            So với đầu kỳ
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.brand.key}>
            <td className="w-1/2 py-1 pr-3">
              <p
                className={`mb-1 truncate ${
                  row.brand.isUs
                    ? "font-semibold text-ink"
                    : "text-ink-secondary"
                }`}
                title={row.brand.label}
              >
                {row.brand.label}
              </p>
              <span
                aria-hidden="true"
                className="block h-1.5 rounded-full"
                style={{
                  width: `${(row.sharePct / max) * 100}%`,
                  backgroundColor: row.brand.isUs
                    ? "var(--series-1)"
                    : "var(--series-context)",
                  opacity: row.brand.isUs ? 1 : 0.5,
                }}
              />
            </td>
            <td className="py-1 pr-3 text-right align-top text-ink tabular-nums">
              {formatPercent(row.sharePct, 1)}
            </td>
            <td className="py-1 text-right align-top tabular-nums">
              {row.deltaPoints === null ? (
                <span className="text-ink-muted">—</span>
              ) : (
                <span
                  style={
                    row.brand.isUs
                      ? {
                          color:
                            row.deltaPoints >= 0
                              ? "var(--delta-good)"
                              : "var(--delta-bad)",
                        }
                      : { color: "var(--ink-muted)" }
                  }
                >
                  <span aria-hidden="true">
                    {row.deltaPoints >= 0 ? "▲" : "▼"}
                  </span>{" "}
                  {Math.abs(row.deltaPoints).toLocaleString("vi-VN", {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1,
                  })}
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
