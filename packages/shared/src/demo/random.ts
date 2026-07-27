/**
 * Tiện ích sinh dữ liệu giả lập TẤT ĐỊNH.
 *
 * Không dùng `Math.random`: server và client phải render ra cùng một kết quả để
 * tránh lệch hydration của Next.js, và ảnh chụp màn hình trong hồ sơ nghiệm thu
 * phải tái lập được.
 */

export function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Bộ sinh số giả ngẫu nhiên tất định (linear congruential). */
export function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

export function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function formatVnDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Sinh dãy ngày kết thúc tại `endDate`, tính theo UTC để không lệch múi giờ. */
export function buildDates(endDate: Date, count: number): string[] {
  const end = Date.UTC(
    endDate.getUTCFullYear(),
    endDate.getUTCMonth(),
    endDate.getUTCDate(),
  );
  return Array.from({ length: count }, (_, i) =>
    toIsoDate(new Date(end - (count - 1 - i) * 86_400_000)),
  );
}

const DAY_MS = 86_400_000;

/**
 * Sinh dãy ngày thứ Hai của `count` tuần gần nhất tính tới `endDate`.
 *
 * Google Trends trả dữ liệu theo tuần bắt đầu từ Chủ nhật ở một số vùng; ở đây chuẩn
 * hoá về thứ Hai theo thông lệ Việt Nam và giữ nguyên quy ước đó ở mọi tầng.
 */
export function buildWeekStarts(endDate: Date, count: number): string[] {
  const end = Date.UTC(
    endDate.getUTCFullYear(),
    endDate.getUTCMonth(),
    endDate.getUTCDate(),
  );
  // getUTCDay: 0 = Chủ nhật. Lùi về thứ Hai của tuần chứa `endDate`.
  const weekday = new Date(end).getUTCDay();
  const offsetToMonday = (weekday + 6) % 7;
  const lastMonday = end - offsetToMonday * DAY_MS;

  return Array.from({ length: count }, (_, i) =>
    toIsoDate(new Date(lastMonday - (count - 1 - i) * 7 * DAY_MS)),
  );
}
