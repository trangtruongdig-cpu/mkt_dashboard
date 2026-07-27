"use client";

import type { SentimentResponse } from "@ptit/shared";
import type { EChartsOption } from "echarts";
import { useChartTokens } from "@/lib/chart-tokens";
import { formatNumber } from "@/lib/format";
import { EChart } from "./EChart";

interface SentimentChartProps {
  data: SentimentResponse;
}

/**
 * Sắc thái thảo luận theo tuần.
 *
 * Đây là thang phân cực nên dùng cặp màu đối lập với xám ở giữa, không dùng ba
 * màu rời rạc: xám phải đọc ra là "không nghiêng về bên nào".
 * Các đoạn trong cột cách nhau bằng khe 2px màu nền, không viền.
 */
export function SentimentChart({ data }: SentimentChartProps) {
  const tokens = useChartTokens();

  const segments = [
    {
      name: "Tích cực",
      color: tokens?.["--sentiment-positive"],
      values: data.byWeek.map((w) => w.positive),
    },
    {
      name: "Trung tính",
      color: tokens?.["--sentiment-neutral"],
      values: data.byWeek.map((w) => w.neutral),
    },
    {
      name: "Tiêu cực",
      color: tokens?.["--sentiment-negative"],
      values: data.byWeek.map((w) => w.negative),
    },
  ];

  const option: EChartsOption | null = tokens && {
    grid: { top: 16, right: 12, bottom: 48, left: 8, containLabel: true },
    tooltip: {
      trigger: "axis",
      backgroundColor: tokens["--surface"],
      borderColor: tokens["--baseline"],
      borderWidth: 1,
      textStyle: { color: tokens["--ink"], fontSize: 12 },
      axisPointer: { type: "shadow", shadowStyle: { color: tokens["--grid"] } },
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
      data: data.byWeek.map((w) => w.weekLabel),
      axisLine: { lineStyle: { color: tokens["--baseline"], width: 1 } },
      axisTick: { show: false },
      axisLabel: { color: tokens["--ink-muted"], fontSize: 11 },
    },
    yAxis: {
      type: "value",
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: tokens["--grid"], width: 1 } },
      axisLabel: { color: tokens["--ink-muted"], fontSize: 11 },
    },
    series: segments.map((segment, index) => ({
      name: segment.name,
      type: "bar",
      stack: "sentiment",
      data: segment.values,
      barMaxWidth: 24,
      itemStyle: {
        color: segment.color,
        // Khe 2px màu nền tách các đoạn — ECharts vẽ khe bằng viền cùng màu nền.
        borderColor: tokens["--surface"],
        borderWidth: 2,
        borderRadius:
          index === segments.length - 1
            ? ([4, 4, 0, 0] as [number, number, number, number])
            : 0,
      },
    })),
  };

  return (
    <EChart
      option={option}
      height={260}
      ariaLabel="Biểu đồ cột chồng phân bố sắc thái thảo luận theo tuần"
    />
  );
}
