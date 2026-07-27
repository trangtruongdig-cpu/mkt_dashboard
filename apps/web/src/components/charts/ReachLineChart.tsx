"use client";

import type { ReachResponse } from "@ptit/shared";
import type { EChartsOption } from "echarts";
import { useChartTokens } from "@/lib/chart-tokens";
import { formatCompact, formatDayMonth, formatNumber } from "@/lib/format";
import { EChart } from "./EChart";

interface ReachLineChartProps {
  data: ReachResponse;
}

/** Lượt tiếp cận theo ngày — tối đa 3 kênh, mỗi kênh một khe màu cố định. */
export function ReachLineChart({ data }: ReachLineChartProps) {
  const tokens = useChartTokens();

  const option: EChartsOption | null = tokens && {
    color: [tokens["--series-1"], tokens["--series-2"], tokens["--series-3"]],
    grid: { top: 16, right: 20, bottom: 48, left: 8, containLabel: true },
    tooltip: {
      trigger: "axis",
      backgroundColor: tokens["--surface"],
      borderColor: tokens["--baseline"],
      borderWidth: 1,
      textStyle: { color: tokens["--ink"], fontSize: 12 },
      axisPointer: {
        type: "line",
        lineStyle: { color: tokens["--baseline"], width: 1 },
      },
      valueFormatter: (value) => formatNumber(Number(value)),
    },
    legend: {
      bottom: 0,
      icon: "roundRect",
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 20,
      textStyle: { color: tokens["--ink-secondary"], fontSize: 12 },
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: data.dates.map(formatDayMonth),
      axisLine: { lineStyle: { color: tokens["--baseline"], width: 1 } },
      axisTick: { show: false },
      axisLabel: { color: tokens["--ink-muted"], fontSize: 11 },
    },
    yAxis: {
      type: "value",
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: tokens["--grid"], width: 1 } },
      axisLabel: {
        color: tokens["--ink-muted"],
        fontSize: 11,
        formatter: (value: number) => formatCompact(value),
      },
    },
    series: data.series.map((serie) => ({
      name: serie.label,
      type: "line",
      data: serie.values,
      smooth: false,
      showSymbol: false,
      symbol: "circle",
      symbolSize: 8,
      lineStyle: { width: 2, cap: "round", join: "round" },
      emphasis: { focus: "series", scale: false },
    })),
  };

  return (
    <EChart
      option={option}
      height={300}
      ariaLabel={`Biểu đồ đường lượt tiếp cận theo ngày của ${data.series
        .map((s) => s.label)
        .join(", ")}`}
    />
  );
}
