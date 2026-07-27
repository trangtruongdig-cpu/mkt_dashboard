import type { ShareOfSearchResponse } from "@ptit/shared";
import { formatPercent } from "@/lib/format";

interface BrandRankTableProps {
  data: ShareOfSearchResponse;
}

/**
 * Xếp hạng thị phần tìm kiếm của tuần gần nhất.
 *
 * Bảng này không phải phần trang trí thêm: trên biểu đồ, năm trường đối sánh dùng
 * chung một màu nền nên không đọc được tên. Bảng là nơi danh tính quay lại đầy đủ,
 * đồng thời là bản đọc được bằng trình đọc màn hình và khi in đen trắng.
 */
export function BrandRankTable({ data }: BrandRankTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">
          Thị phần tìm kiếm tuần gần nhất theo trường, giảm dần
        </caption>
        <thead>
          <tr className="border-b border-hairline text-left text-xs text-ink-muted">
            <th className="py-2 pr-3 font-medium" scope="col">
              #
            </th>
            <th className="py-2 pr-3 font-medium" scope="col">
              Trường
            </th>
            <th className="py-2 pr-3 text-right font-medium" scope="col">
              Thị phần
            </th>
            <th className="py-2 text-right font-medium" scope="col">
              So với đầu kỳ
            </th>
          </tr>
        </thead>
        <tbody>
          {data.latest.map((row, index) => (
            <tr
              key={row.brand.key}
              className={`border-b border-hairline last:border-b-0 ${
                row.brand.isUs ? "bg-series-1/5" : ""
              }`}
            >
              <td className="py-2 pr-3 text-ink-muted tabular-nums">
                {index + 1}
              </td>
              <td className="py-2 pr-3">
                <span
                  className={
                    row.brand.isUs
                      ? "font-semibold text-ink"
                      : "text-ink-secondary"
                  }
                >
                  {row.brand.isUs ? "◆ " : ""}
                  {row.brand.label}
                </span>
              </td>
              <td className="py-2 pr-3 text-right text-ink tabular-nums">
                {formatPercent(row.sharePct, 2)}
              </td>
              <td className="py-2 text-right tabular-nums">
                {row.deltaPoints === null ? (
                  <span className="text-ink-muted">—</span>
                ) : (
                  <span
                    style={{
                      color:
                        row.deltaPoints >= 0
                          ? "var(--delta-good)"
                          : "var(--delta-bad)",
                    }}
                  >
                    {row.deltaPoints >= 0 ? "▲" : "▼"}{" "}
                    {Math.abs(row.deltaPoints).toLocaleString("vi-VN", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    điểm
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-ink-muted">
        ◆ Học viện. Thay đổi tính bằng ĐIỂM phần trăm so với tuần đầu kỳ, không phải
        phần trăm tương đối.
      </p>
    </div>
  );
}
