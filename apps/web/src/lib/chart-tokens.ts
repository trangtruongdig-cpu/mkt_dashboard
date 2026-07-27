"use client";

import { useEffect, useState } from "react";

/**
 * Đọc mã màu thật từ biến CSS trong `globals.css`.
 *
 * Biểu đồ không tự khai báo màu — nhờ vậy đổi bảng màu chỉ sửa một chỗ, và chế độ
 * tối tự khớp mà không phải viết bản sao cấu hình biểu đồ.
 */
const TOKEN_NAMES = [
  "--surface",
  "--ink",
  "--ink-secondary",
  "--ink-muted",
  "--grid",
  "--baseline",
  "--series-1",
  "--series-2",
  "--series-3",
  "--series-context",
  "--sentiment-positive",
  "--sentiment-neutral",
  "--sentiment-negative",
] as const;

export type ChartTokenName = (typeof TOKEN_NAMES)[number];
export type ChartTokens = Record<ChartTokenName, string>;

function readTokens(): ChartTokens {
  const styles = getComputedStyle(document.documentElement);
  const entries = TOKEN_NAMES.map(
    (name) => [name, styles.getPropertyValue(name).trim()] as const,
  );
  return Object.fromEntries(entries) as ChartTokens;
}

export function useChartTokens(): ChartTokens | null {
  const [tokens, setTokens] = useState<ChartTokens | null>(null);

  useEffect(() => {
    const sync = () => setTokens(readTokens());
    sync();

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return tokens;
}
