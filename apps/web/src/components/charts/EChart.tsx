"use client";

import type { EChartsOption } from "echarts";
import dynamic from "next/dynamic";

const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false,
  loading: () => <div className="h-full w-full rounded-md bg-grid/40" />,
});

interface EChartProps {
  option: EChartsOption | null;
  height?: number;
  /** Mô tả nội dung biểu đồ cho trình đọc màn hình. */
  ariaLabel: string;
}

/**
 * Vỏ bọc chung cho mọi biểu đồ. Dùng renderer SVG để nét ở màn hình retina và
 * để in ra hồ sơ nghiệm thu không bị vỡ.
 */
export function EChart({ option, height = 320, ariaLabel }: EChartProps) {
  return (
    <div style={{ height }} role="img" aria-label={ariaLabel}>
      {option === null ? (
        <div className="h-full w-full rounded-md bg-grid/40" />
      ) : (
        <ReactECharts
          option={option}
          notMerge
          lazyUpdate
          opts={{ renderer: "svg" }}
          style={{ height: "100%", width: "100%" }}
        />
      )}
    </div>
  );
}
