"use client";

import type { ChannelsResponse } from "@ptit/shared";
import type { EChartsOption } from "echarts";
import { useChartTokens } from "@/lib/chart-tokens";
import { formatCompact, formatNumber } from "@/lib/format";
import { EChart } from "./EChart";

interface ChannelBarChartProps {
  data: ChannelsResponse;
}

/**
 * Lượt tương tác theo kênh.
 *
 * Một chuỗi dữ liệu duy nhất nên chỉ dùng một màu và không cần chú giải — màu ở
 * đây không mang thông tin, tô 5 màu khác nhau sẽ khiến người đọc đi tìm ý nghĩa
 * không tồn tại.
 */
export function ChannelBarChart({ data }: ChannelBarChartProps) {
  const tokens = useChartTokens();

  const sorted = [...data.channels].sort((a, b) => b.engagement - a.engagement);

  const option: EChartsOption | null = tokens && {
    grid: { top: 8, right: 72, bottom: 8, left: 8, containLabel: true },
    tooltip: {
      trigger: "item",
      backgroundColor: tokens["--surface"],
      borderColor: tokens["--baseline"],
      borderWidth: 1,
      textStyle: { color: tokens["--ink"], fontSize: 12 },
      formatter: (params) => {
        const point = Array.isArray(params) ? params[0] : params;
        const channel = sorted[point.dataIndex as number];
        if (!channel) return "";
        return [
          `<strong>${channel.label}</strong>`,
          `Tương tác: ${formatNumber(channel.engagement)}`,
          `Tiếp cận: ${formatNumber(channel.reach)}`,
          `Tỷ lệ tương tác: ${channel.engagementRate.toLocaleString("vi-VN")}%`,
        ].join("<br/>");
      },
    },
    xAxis: { type: "value", show: false },
    yAxis: {
      type: "category",
      inverse: true,
      data: sorted.map((c) => c.label),
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: tokens["--ink-secondary"], fontSize: 12 },
    },
    series: [
      {
        type: "bar",
        data: sorted.map((c) => c.engagement),
        barMaxWidth: 24,
        itemStyle: {
          color: tokens["--series-1"],
          borderRadius: [0, 4, 4, 0],
        },
        label: {
          show: true,
          position: "right",
          distance: 8,
          color: tokens["--ink-secondary"],
          fontSize: 12,
          formatter: (params) => formatCompact(Number(params.value)),
        },
      },
    ],
  };

  return (
    <EChart
      option={option}
      height={260}
      ariaLabel="Biểu đồ cột ngang lượt tương tác theo từng kênh"
    />
  );
}
