import type { KpiMetric } from "@ptit/shared";
import { SummaryTile } from "@/components/home/SummaryTile";
import { InfoHint } from "@/components/ui/InfoHint";
import { formatMetric, formatPercent } from "@/lib/format";

interface StatTileProps {
  metric: KpiMetric;
}

/**
 * Ô chỉ số dựng từ một `KpiMetric`.
 *
 * Phần hiển thị dùng lại `SummaryTile` thay vì tự vẽ. Trước đây file này có bản vẽ
 * riêng, nên cùng một bảng điều khiển hiện hai kiểu ô chỉ số khác nhau: trang chủ
 * một kiểu (có thanh đo, có hình), trang Kênh một kiểu khác. Giữ ở đây đúng phần
 * việc riêng của nó: quy một `KpiMetric` về các thuộc tính của ô.
 *
 * Chiều biến động không bao giờ chỉ dựa vào màu — `SummaryTile` luôn kèm mũi tên, nên
 * đọc được khi mù màu và khi in đen trắng.
 */
export function StatTile({ metric }: StatTileProps) {
  const { deltaPct, higherIsBetter } = metric;
  const good = deltaPct === null ? null : deltaPct >= 0 === higherIsBetter;

  return (
    <SummaryTile
      delta={
        deltaPct === null || good === null
          ? undefined
          : { text: formatPercent(Math.abs(deltaPct)), good }
      }
      hint={
        // Một con số biến động mà không nói so với cái gì thì không đọc được. Mốc so
        // sánh luôn phải ghi ra, kể cả khi chỉ số không có diễn giải riêng.
        deltaPct !== null || metric.hint ? (
          <InfoHint label={`Diễn giải chỉ số ${metric.label}`}>
            {deltaPct !== null ? <p>Mức biến động so với kỳ báo cáo trước.</p> : null}
            {metric.hint ? (
              <p className={deltaPct !== null ? "mt-2" : ""}>{metric.hint}</p>
            ) : null}
          </InfoHint>
        ) : undefined
      }
      label={metric.label}
      value={formatMetric(metric.value, metric.unit)}
    />
  );
}
