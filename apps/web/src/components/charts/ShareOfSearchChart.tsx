"use client";

import type { ShareOfSearchResponse } from "@ptit/shared";
import type { EChartsOption } from "echarts";
import { useChartTokens } from "@/lib/chart-tokens";
import { formatDayMonth, formatPercent } from "@/lib/format";
import { EChart } from "./EChart";

interface ShareOfSearchChartProps {
  data: ShareOfSearchResponse;
}

/**
 * Thị phần tìm kiếm của Học viện so với nhóm trường đối sánh.
 *
 * Sáu chuỗi nhưng bảng màu chỉ có ba khe màu dữ liệu, và cấp thêm màu thì không ai
 * phân biệt nổi — nên ở đây làm nổi ĐÚNG MỘT đường là Học viện, năm đường còn lại
 * lùi về màu nền chung để đóng vai bối cảnh. Danh tính của năm trường kia được trả
 * lại đầy đủ ở bảng xếp hạng ngay bên dưới và ở chú giải khi di chuột.
 *
 * Đây cũng là lý do chú giải chỉ có hai mục: năm đường xám cùng màu nên liệt kê đủ
 * sáu tên cạnh sáu ô màu giống nhau chỉ làm người đọc rối thêm.
 */
export function ShareOfSearchChart({ data }: ShareOfSearchChartProps) {
  const tokens = useChartTokens();

  const us = data.series.find((s) => s.brand.isUs);
  const others = data.series.filter((s) => !s.brand.isUs);

  const option: EChartsOption | null = tokens && {
    grid: { top: 16, right: 56, bottom: 24, left: 8, containLabel: true },
    tooltip: {
      trigger: "axis",
      backgroundColor: tokens["--surface"],
      borderColor: tokens["--baseline"],
      borderWidth: 1,
      textStyle: { color: tokens["--ink"], fontSize: 12 },
      axisPointer: { type: "line", lineStyle: { color: tokens["--baseline"] } },
      // Xếp giảm dần để đọc ra thứ hạng ngay tại điểm đang trỏ.
      order: "valueDesc",
      valueFormatter: (value) => formatPercent(Number(value), 2),
    },
    xAxis: {
      type: "category",
      boundaryGap: false,
      data: data.weeks.map(formatDayMonth),
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
        formatter: "{value}%",
      },
    },
    series: [
      // Vẽ nhóm bối cảnh trước để đường của Học viện luôn nằm trên cùng.
      ...others.map((s) => ({
        name: s.brand.label,
        type: "line" as const,
        data: s.values,
        smooth: false,
        symbol: "none" as const,
        lineStyle: { color: tokens["--series-context"], width: 1.5, opacity: 0.55 },
        emphasis: { disabled: true as const },
        z: 1,
      })),
      ...(us
        ? [
            {
              name: us.brand.label,
              type: "line" as const,
              data: us.values,
              smooth: false,
              symbol: "circle" as const,
              symbolSize: 8,
              itemStyle: {
                color: tokens["--series-1"],
                // Vòng 2px màu nền để điểm không dính vào đường khi chồng nhau.
                borderColor: tokens["--surface"],
                borderWidth: 2,
              },
              lineStyle: { color: tokens["--series-1"], width: 2 },
              // Nhãn trực tiếp ở điểm cuối: không phải dò chú giải mới biết đường nào.
              endLabel: {
                show: true,
                color: tokens["--series-1"],
                fontSize: 11,
                fontWeight: "bold" as const,
                // Tính sẵn thay vì dùng callback: điểm cuối là cố định, không cần
                // hàm, và tránh phải khai kiểu tham số nội bộ của ECharts.
                formatter: formatPercent(
                  us.values[us.values.length - 1] ?? 0,
                  1,
                ),
              },
              z: 3,
            },
          ]
        : []),
    ],
  };

  return (
    <div>
      <ul className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-0.5 w-4 rounded-full"
            style={{ backgroundColor: "var(--series-1)" }}
          />
          <span className="text-ink-secondary">Học viện</span>
        </li>
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-0.5 w-4 rounded-full opacity-55"
            style={{ backgroundColor: "var(--series-context)" }}
          />
          <span className="text-ink-secondary">
            {others.length} trường đối sánh (xem tên ở bảng bên dưới)
          </span>
        </li>
      </ul>

      <EChart
        option={option}
        height={280}
        ariaLabel="Biểu đồ đường thị phần tìm kiếm theo tuần của Học viện so với nhóm trường đối sánh"
      />
    </div>
  );
}
