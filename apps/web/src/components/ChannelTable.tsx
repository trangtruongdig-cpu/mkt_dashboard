import type { ChannelsResponse } from "@ptit/shared";
import { formatNumber, formatPercent } from "@/lib/format";

interface ChannelTableProps {
  data: ChannelsResponse;
}

/**
 * Bảng số liệu đầy đủ — không phải phần phụ trợ.
 *
 * Đây là kênh đọc thay thế khi biểu đồ không dùng được: người dùng trình đọc màn
 * hình, bản in đen trắng, và những giá trị mà biểu đồ cố tình không dán nhãn.
 */
export function ChannelTable({ data }: ChannelTableProps) {
  const columns = [
    "Kênh",
    "Tiếp cận",
    "Tương tác",
    "Tỷ lệ tương tác",
    "Vào trang tuyển sinh",
    "Hồ sơ",
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[42rem] border-collapse text-sm">
        <caption className="sr-only">
          Hiệu quả từng kênh marketing số trong {data.period.label}
        </caption>
        <thead>
          <tr className="border-b border-hairline text-left">
            {columns.map((column, index) => (
              <th
                key={column}
                scope="col"
                className={`py-2 text-xs font-medium text-ink-muted ${
                  index === 0 ? "" : "text-right"
                }`}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {data.channels.map((channel) => (
            <tr key={channel.platform} className="border-b border-hairline/60">
              <th
                scope="row"
                className="py-2.5 text-left font-medium text-ink"
              >
                {channel.label}
              </th>
              <td className="py-2.5 text-right text-ink-secondary">
                {formatNumber(channel.reach)}
              </td>
              <td className="py-2.5 text-right text-ink-secondary">
                {formatNumber(channel.engagement)}
              </td>
              <td className="py-2.5 text-right text-ink-secondary">
                {formatPercent(channel.engagementRate)}
              </td>
              <td className="py-2.5 text-right text-ink-secondary">
                {formatNumber(channel.admissionVisits)}
              </td>
              <td className="py-2.5 text-right font-medium text-ink">
                {formatNumber(channel.applications)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
