"use client";

import type { BenchmarkDimension } from "@ptit/shared";
import type { EChartsOption } from "echarts";
import { useChartTokens } from "@/lib/chart-tokens";
import { formatMetric } from "@/lib/format";
import { EChart } from "./EChart";

interface BenchmarkRankChartProps {
  dimension: BenchmarkDimension;
}

/** Chiều cao một hàng, đủ cho nhãn 11px và khoảng thở giữa hai thanh. */
const CHIEU_CAO_HANG = 34;

/**
 * Xếp hạng Học viện so với nhóm đối sánh ở MỘT chiều — thanh ngang, làm nổi một thanh.
 *
 * Vì sao là thanh ngang chứ không phải sáu màu: sáu trường là sáu chuỗi, nhưng câu hỏi
 * không phải "phân biệt sáu trường" mà là "TA đang ở đâu giữa họ". Đó là hình thức
 * *emphasis* — một thanh mang màu nhấn, năm thanh còn lại lùi về màu bối cảnh. Cấp sáu
 * màu phân loại ở đây vừa vượt trần phân biệt được khi mù màu, vừa chôn mất đúng cái
 * thanh người xem cần tìm.
 *
 * Tên trường nằm trên trục nên danh tính không phụ thuộc vào màu — đọc được cả khi in
 * đen trắng cho hồ sơ nghiệm thu.
 *
 * Trường CHƯA CÓ SỐ bị loại khỏi biểu đồ chứ không vẽ thanh bằng 0: một thanh 0 đọc ra
 * là "trường đó có thị phần bằng không", trong khi sự thật là ta chưa đo được họ. Danh
 * sách những trường đó hiện bằng chữ ngay dưới biểu đồ.
 */
export function BenchmarkRankChart({ dimension }: BenchmarkRankChartProps) {
  const tokens = useChartTokens();

  const coSo = dimension.rows.filter((r) => r.value !== null);
  const chuaCoSo = dimension.rows.filter((r) => r.value === null);

  // ECharts vẽ trục giá trị ngang từ dưới lên, nên đảo mảng để hạng 1 nằm trên cùng.
  const theoThuTu = [...coSo].reverse();

  const option: EChartsOption | null = tokens && {
    grid: { top: 4, right: 64, bottom: 4, left: 8, containLabel: true },
    tooltip: {
      trigger: "item",
      backgroundColor: tokens["--surface"],
      borderColor: tokens["--baseline"],
      borderWidth: 1,
      textStyle: { color: tokens["--ink"], fontSize: 12 },
      formatter: (params: unknown) => {
        const p = params as { dataIndex: number };
        const row = theoThuTu[p.dataIndex];
        if (!row || row.value === null) return "";
        return `${row.brand.label}<br/>Hạng ${row.rank} · ${formatMetric(
          row.value,
          dimension.unit,
        )}`;
      },
    },
    xAxis: {
      type: "value",
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: tokens["--grid"], width: 1 } },
      axisLabel: { show: false },
    },
    yAxis: {
      type: "category",
      data: theoThuTu.map((r) => r.brand.shortLabel),
      axisLine: { lineStyle: { color: tokens["--baseline"], width: 1 } },
      axisTick: { show: false },
      axisLabel: {
        color: tokens["--ink-secondary"],
        fontSize: 11,
        width: 150,
        overflow: "truncate",
      },
    },
    series: [
      {
        type: "bar",
        data: theoThuTu.map((r) => ({
          value: r.value ?? 0,
          itemStyle: {
            // Đúng một thanh mang màu nhấn. Năm thanh kia KHÔNG phải năm màu khác —
            // chúng là bối cảnh, nên dùng chung một màu xám.
            color: r.brand.isUs
              ? tokens["--series-1"]
              : tokens["--series-context"],
            borderRadius: [0, 4, 4, 0],
          },
        })),
        barWidth: 14,
        label: {
          show: true,
          position: "right",
          distance: 8,
          color: tokens["--ink-secondary"],
          fontSize: 11,
          formatter: (params: { dataIndex: number }) => {
            const row = theoThuTu[params.dataIndex];
            return row?.value === null || row?.value === undefined
              ? ""
              : formatMetric(row.value, dimension.unit);
          },
        },
      },
    ],
  };

  return (
    <div>
      <EChart
        ariaLabel={`${dimension.label} của từng trường trong nhóm đối sánh, xếp giảm dần`}
        height={Math.max(coSo.length * CHIEU_CAO_HANG + 16, 80)}
        option={option}
      />
      {chuaCoSo.length > 0 ? (
        <p className="mt-1 text-[11px] leading-snug text-ink-muted">
          Chưa có số: {chuaCoSo.map((r) => r.brand.shortLabel).join(" · ")}. Các
          trường này không xuất hiện trên biểu đồ vì chưa đo được, không phải vì
          bằng 0.
        </p>
      ) : null}
    </div>
  );
}
