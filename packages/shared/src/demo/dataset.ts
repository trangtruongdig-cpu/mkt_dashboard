import type { ChannelsResponse } from "../schemas/channels";
import { PLATFORM_LABELS, type Period } from "../schemas/common";
import type { OverviewResponse } from "../schemas/overview";
import type { ReachResponse } from "../schemas/reach";
import type { SentimentResponse } from "../schemas/sentiment";

/**
 * Bộ dữ liệu GIẢ LẬP phục vụ demo giao diện khi chưa đấu nối Airbyte/dbt.
 *
 * Toàn bộ số liệu sinh bằng bộ sinh số tất định (seed cố định theo ngày) — không
 * dùng Math.random — để server và client render ra cùng một kết quả, tránh lệch
 * hydration của Next.js, và để ảnh chụp màn hình trong hồ sơ nghiệm thu tái lập được.
 *
 * KHÔNG dùng module này ở nhánh code chạy với dữ liệu thật.
 */

const DAYS = 14;
const WEEKS = 8;

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Bộ sinh số giả ngẫu nhiên tất định (linear congruential). */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatVnDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** Sinh dãy ngày kết thúc tại `endDate`, tính theo UTC để không lệch múi giờ. */
function buildDates(endDate: Date, count: number): string[] {
  const end = Date.UTC(
    endDate.getUTCFullYear(),
    endDate.getUTCMonth(),
    endDate.getUTCDate(),
  );
  return Array.from({ length: count }, (_, i) =>
    toIsoDate(new Date(end - (count - 1 - i) * 86_400_000)),
  );
}

/** Lượt tiếp cận một ngày: nền + dao động tất định + hụt cuối tuần. */
function reachFor(base: number, iso: string, salt: string): number {
  const rnd = seeded(hashString(`${salt}:${iso}`));
  const weekday = new Date(`${iso}T00:00:00Z`).getUTCDay();
  const weekendFactor = weekday === 0 || weekday === 6 ? 0.72 : 1;
  const noise = 0.78 + rnd() * 0.44;
  return Math.round(base * weekendFactor * noise);
}

export function buildDemoDataset(referenceDate: Date = new Date()): {
  overview: OverviewResponse;
  reach: ReachResponse;
  channels: ChannelsResponse;
  sentiment: SentimentResponse;
} {
  const dates = buildDates(referenceDate, DAYS);
  const first = dates[0]!;
  const last = dates[dates.length - 1]!;

  const period: Period = {
    from: first,
    to: last,
    label: `${DAYS} ngày gần nhất (${formatVnDate(first)} – ${formatVnDate(last)})`,
  };

  const facebook = dates.map((d) => reachFor(42_000, d, "fb"));
  const tiktok = dates.map((d) => reachFor(26_500, d, "tt"));
  const youtube = dates.map((d) => reachFor(7_800, d, "yt"));
  const website = dates.map((d) => reachFor(9_400, d, "web"));
  const zalo = dates.map((d) => reachFor(2_600, d, "zl"));

  const sum = (xs: number[]): number => xs.reduce((a, b) => a + b, 0);

  const reach: ReachResponse = {
    period,
    dates,
    series: [
      { platform: "facebook", label: PLATFORM_LABELS.facebook, values: facebook },
      { platform: "tiktok", label: PLATFORM_LABELS.tiktok, values: tiktok },
      { platform: "youtube", label: PLATFORM_LABELS.youtube, values: youtube },
    ],
  };

  const channelSpec = [
    { platform: "facebook", values: facebook, erate: 5.8, cvr: 0.0042 },
    { platform: "tiktok", values: tiktok, erate: 7.9, cvr: 0.0021 },
    { platform: "youtube", values: youtube, erate: 4.2, cvr: 0.0018 },
    { platform: "website", values: website, erate: 2.6, cvr: 0.0135 },
    { platform: "zalo", values: zalo, erate: 9.4, cvr: 0.0068 },
  ] as const;

  const channels: ChannelsResponse = {
    period,
    channels: channelSpec.map((c) => {
      const total = sum([...c.values]);
      return {
        platform: c.platform,
        label: PLATFORM_LABELS[c.platform],
        reach: total,
        engagement: Math.round((total * c.erate) / 100),
        engagementRate: c.erate,
        admissionVisits: Math.round(total * c.cvr * 12),
        applications: Math.round(total * c.cvr),
      };
    }),
  };

  const totalReach = sum(channels.channels.map((c) => c.reach));
  const totalApplications = sum(channels.channels.map((c) => c.applications));
  const totalAdmissionVisits = sum(channels.channels.map((c) => c.admissionVisits));
  const weightedEngagementRate =
    sum(channels.channels.map((c) => c.engagement)) / totalReach;

  // Sắc thái: 8 tuần gần nhất, xu hướng tích cực tăng nhẹ.
  const byWeek = Array.from({ length: WEEKS }, (_, i) => {
    const rnd = seeded(hashString(`sent:${last}:${i}`));
    const volume = Math.round(380 + rnd() * 190);
    const positiveShare = 0.55 + i * 0.011 + rnd() * 0.05;
    const negativeShare = 0.14 - i * 0.006 + rnd() * 0.03;
    const positive = Math.round(volume * positiveShare);
    const negative = Math.round(volume * Math.max(negativeShare, 0.04));
    return {
      weekLabel: `Tuần ${i + 1}`,
      positive,
      negative,
      neutral: volume - positive - negative,
    };
  });

  const sentiment: SentimentResponse = {
    period,
    modelVersion: "phobert-base-v1 (dữ liệu giả lập)",
    totalMentions: sum(byWeek.map((w) => w.positive + w.neutral + w.negative)),
    total: {
      positive: sum(byWeek.map((w) => w.positive)),
      neutral: sum(byWeek.map((w) => w.neutral)),
      negative: sum(byWeek.map((w) => w.negative)),
    },
    byWeek,
  };

  const positiveShare =
    (sentiment.total.positive / sentiment.totalMentions) * 100;

  const overview: OverviewResponse = {
    period,
    updatedAt: new Date(`${last}T02:00:00Z`).toISOString(),
    headline: {
      key: "total_reach",
      label: "Tổng lượt tiếp cận",
      value: totalReach,
      unit: "count",
      deltaPct: 12.4,
      higherIsBetter: true,
      hint: "Cộng gộp Facebook, TikTok, YouTube, Website và Zalo OA",
    },
    metrics: [
      {
        key: "engagement_rate",
        label: "Tỷ lệ tương tác",
        value: Number((weightedEngagementRate * 100).toFixed(1)),
        unit: "percent",
        deltaPct: 3.1,
        higherIsBetter: true,
        hint: "Bình quân gia quyền theo lượt tiếp cận",
      },
      {
        key: "admission_visits",
        label: "Lượt vào trang tuyển sinh",
        value: totalAdmissionVisits,
        unit: "count",
        deltaPct: 18.7,
        higherIsBetter: true,
      },
      {
        key: "applications",
        label: "Hồ sơ đăng ký xét tuyển",
        value: totalApplications,
        unit: "count",
        deltaPct: 9.2,
        higherIsBetter: true,
      },
      {
        key: "positive_share",
        label: "Tỷ lệ thảo luận tích cực",
        value: Number(positiveShare.toFixed(1)),
        unit: "percent",
        deltaPct: 2.6,
        higherIsBetter: true,
        hint: "Chấm bằng PhoBERT trên bình luận và tin bài",
      },
      {
        key: "cost_per_application",
        label: "Chi phí mỗi hồ sơ",
        value: 74_500,
        unit: "currency",
        deltaPct: -6.3,
        higherIsBetter: false,
        hint: "Càng thấp càng tốt",
      },
      {
        key: "share_of_voice",
        label: "Thị phần thảo luận",
        value: 21.8,
        unit: "percent",
        deltaPct: -1.4,
        higherIsBetter: true,
        hint: "So với nhóm trường kỹ thuật đối sánh",
      },
    ],
  };

  return { overview, reach, channels, sentiment };
}
