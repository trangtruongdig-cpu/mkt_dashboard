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
 * Sắc thái thảo luận theo tháng.
 *
 * Đây là thang phân cực nên dùng cặp màu đối lập với xám ở giữa, không dùng ba
 * màu rời rạc: xám phải đọc ra là "không nghiêng về bên nào".
 * Các đoạn trong cột cách nhau bằng khe 2px màu nền, không viền.
 *
 * Cột chồng theo SỐ ĐẾM tuyệt đối, không theo phần trăm — và đó là lựa chọn có chủ ý:
 * chiều cao cột chính là mẫu số. Vẽ theo phần trăm thì một tháng có 2 thảo luận trông
 * hệt một tháng có 200, và người xem không có cách nào biết mình đang nhìn cái gì.
 *
 * Tháng dưới `minSampleForTrend` bị làm mờ: có mặt để không tạo khoảng trống giả trên
 * trục thời gian, nhưng không được đọc như một mức sắc thái đáng tin.
 */
export function SentimentChart({ data }: SentimentChartProps) {
  const tokens = useChartTokens();

  const duMau = data.byMonth.map((m) => m.total >= data.minSampleForTrend);

  const segments = [
    {
      name: "Tích cực",
      color: tokens?.["--sentiment-positive"],
      values: data.byMonth.map((m) => m.positive),
    },
    {
      name: "Trung tính",
      color: tokens?.["--sentiment-neutral"],
      values: data.byMonth.map((m) => m.neutral),
    },
    {
      name: "Tiêu cực",
      color: tokens?.["--sentiment-negative"],
      values: data.byMonth.map((m) => m.negative),
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
      // Tự dựng nội dung thay vì dùng valueFormatter: tooltip phải nói được tỷ lệ
      // tích cực VÀ mẫu số của tháng đó. Chỉ hiện ba con số đếm thì người xem phải tự
      // nhẩm, và phần lớn sẽ không nhẩm.
      formatter: (params) => {
        const items = Array.isArray(params) ? params : [params];
        const i = Number(items[0]?.dataIndex ?? 0);
        const thang = data.byMonth[i];
        if (!thang) return "";

        const dong = items
          .map(
            (p) =>
              `${p.marker as string} ${p.seriesName}: ${formatNumber(Number(p.value))}`,
          )
          .join("<br/>");

        const tyLe = thang.total
          ? Math.round((thang.positive / thang.total) * 1000) / 10
          : 0;
        const canhBao = duMau[i]
          ? ""
          : `<br/><span style="opacity:.7">Dưới ${data.minSampleForTrend} lượt — chưa đủ để kết luận</span>`;

        return `<strong>${thang.monthLabel}</strong><br/>${dong}<br/>Tổng: ${formatNumber(
          thang.total,
        )} · tích cực ${tyLe.toLocaleString("vi-VN")}%${canhBao}`;
      },
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
      data: data.byMonth.map((m) => m.monthLabel),
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
      // Tháng thiếu mẫu vẫn vẽ nhưng mờ đi. Bỏ hẳn chúng sẽ tạo khoảng trống trên trục
      // thời gian, và khoảng trống thì bị đọc thành "tháng đó không ai nói gì".
      data: segment.values.map((value, i) => ({
        value,
        itemStyle: duMau[i] ? {} : { opacity: 0.35 },
      })),
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
      ariaLabel="Biểu đồ cột chồng phân bố sắc thái thảo luận theo tháng, chiều cao cột là số lượt thảo luận"
    />
  );
}
