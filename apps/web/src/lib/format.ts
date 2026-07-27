import type { MetricUnit } from "@ptit/shared";

const VI = "vi-VN";

/** Số nguyên có dấu phân cách hàng nghìn theo chuẩn Việt Nam. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat(VI, { maximumFractionDigits: 0 }).format(value);
}

/** Rút gọn số lớn cho ô chỉ số: 1.284 · 12,9 N · 1,15 Tr. */
export function formatCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `${new Intl.NumberFormat(VI, { maximumFractionDigits: 2 }).format(value / 1_000_000)} Tr`;
  }
  if (Math.abs(value) >= 10_000) {
    return `${new Intl.NumberFormat(VI, { maximumFractionDigits: 1 }).format(value / 1_000)} N`;
  }
  return formatNumber(value);
}

export function formatPercent(value: number, fractionDigits = 1): string {
  return `${new Intl.NumberFormat(VI, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value)}%`;
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat(VI, {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Tiền ở quy mô ngân sách: `857.000.000.000 ₫` không đọc được trên một ô chỉ số và
 * cũng không phải cách người ta nói. Rút về `857 tỷ ₫` / `1,15 nghìn tỷ ₫`.
 */
export function formatCurrencyCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000_000) {
    return `${new Intl.NumberFormat(VI, { maximumFractionDigits: 2 }).format(value / 1_000_000_000_000)} nghìn tỷ ₫`;
  }
  if (abs >= 1_000_000_000) {
    return `${new Intl.NumberFormat(VI, { maximumFractionDigits: 1 }).format(value / 1_000_000_000)} tỷ ₫`;
  }
  if (abs >= 1_000_000) {
    return `${new Intl.NumberFormat(VI, { maximumFractionDigits: 1 }).format(value / 1_000_000)} Tr ₫`;
  }
  return formatCurrency(value);
}

/**
 * Điểm xét tuyển (thang 30). Giữ nguyên phần thập phân, không rút gọn —
 * chênh 0,05 điểm là chuyện sống còn với thí sinh.
 */
export function formatScore(value: number): string {
  return new Intl.NumberFormat(VI, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatMetric(value: number, unit: MetricUnit): string {
  switch (unit) {
    case "percent":
      return formatPercent(value);
    case "currency":
      return formatCurrencyCompact(value);
    case "score":
      return formatScore(value);
    case "count":
      return formatCompact(value);
  }
}

/** `2026-07-27` → `27/07`. Dùng cho nhãn trục ngày. */
export function formatDayMonth(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${day}/${month}`;
}

/** `2026-07-27` → `27/07/2026`. */
export function formatFullDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

export function formatUpdatedAt(iso: string): string {
  return new Intl.DateTimeFormat(VI, {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(iso));
}
