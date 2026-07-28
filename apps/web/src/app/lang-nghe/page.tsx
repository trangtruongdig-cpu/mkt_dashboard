import {
  SENTIMENT_LABEL_TEXT,
  SOCIAL_PLATFORM_LABELS,
  SocialMentionsQuerySchema,
  type SentimentLabel,
  type SocialPlatform,
} from "@ptit/shared";
import Link from "next/link";
import { Card } from "@/components/Card";
import { MentionCard } from "@/components/MentionCard";
import { getSocialMentions } from "@/lib/api";

/**
 * Trang này KHÔNG dùng ISR.
 *
 * `revalidate` khiến Next.js dựng sẵn HTML lúc build — thời điểm API còn chưa chạy —
 * nên bản đầu tiên sau mỗi lần triển khai luôn là bản "không có dữ liệu", và phải chờ
 * hết chu kỳ mới tự sửa. Với biểu đồ tổng hợp thì chấp nhận được; với danh sách ý kiến
 * thì không: người mở trang để ĐỌC xem có ai vừa nói gì, mà lại thấy trang trống.
 *
 * Trang cũng đọc tham số lọc từ URL nên vốn đã động.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Lắng nghe — người ngoài nói gì về Học viện",
};

const SAC_THAI: readonly SentimentLabel[] = ["negative", "neutral", "positive"];
const NEN_TANG: readonly SocialPlatform[] = ["youtube", "reddit", "forum"];

interface TrangProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Dựng link giữ nguyên các bộ lọc khác, chỉ đổi một chiều. */
function duongDan(
  hien_tai: { sentiment?: string; platform?: string },
  doi: { sentiment?: string | null; platform?: string | null },
): string {
  const p = new URLSearchParams();
  const sentiment =
    doi.sentiment === undefined ? hien_tai.sentiment : (doi.sentiment ?? undefined);
  const platform =
    doi.platform === undefined ? hien_tai.platform : (doi.platform ?? undefined);
  if (sentiment) p.set("sentiment", sentiment);
  if (platform) p.set("platform", platform);
  const q = p.toString();
  return q ? `/lang-nghe?${q}` : "/lang-nghe";
}

function Chip({
  href,
  dang_chon,
  children,
}: {
  href: string;
  dang_chon: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={dang_chon ? "true" : undefined}
      className={
        dang_chon
          ? "rounded-full border border-series-1 bg-series-1/10 px-3 py-1 text-xs font-medium text-series-1"
          : "rounded-full border border-hairline px-3 py-1 text-xs text-ink-secondary hover:border-baseline hover:text-ink"
      }
    >
      {children}
    </Link>
  );
}

export default async function TrangLangNghe({ searchParams }: TrangProps) {
  const thamSo = await searchParams;

  // Kiểm bằng chính schema dùng chung với backend. Tham số hỏng trên URL thì bỏ qua bộ
  // lọc chứ không làm sập trang — người ta hay sửa tay thanh địa chỉ.
  const daKiem = SocialMentionsQuerySchema.safeParse(thamSo);
  const boLoc = daKiem.success ? daKiem.data : { limit: 50 as const };
  const hienTai = {
    sentiment: daKiem.success ? daKiem.data.sentiment : undefined,
    platform: daKiem.success ? daKiem.data.platform : undefined,
  };

  const { mentions, reason } = await getSocialMentions(boLoc);

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-5 py-8 sm:px-8 sm:py-12">
      <header className="mb-6">
        <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">
          Học viện Công nghệ Bưu chính Viễn thông
        </p>
        <h1 className="mt-1 text-xl font-semibold text-ink sm:text-2xl">
          Lắng nghe — người ngoài nói gì
        </h1>
        <p className="mt-1.5 text-sm text-ink-secondary">
          Bình luận và bài đăng công khai nhắc tới Học viện, kèm sắc thái do mô hình chấm.
          Sắp theo mức ưu tiên đọc: ý kiến tiêu cực trước.
        </p>
        <nav className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link className="text-series-1 underline underline-offset-2" href="/">
            ← Bảng điều khiển mục tiêu
          </Link>
          <Link className="text-series-1 underline underline-offset-2" href="/kenh">
            → Biểu đồ sắc thái theo tháng
          </Link>
        </nav>
      </header>

      {mentions === null ? (
        <Card title="Chưa đọc được kho ý kiến">
          <p className="text-sm text-ink-secondary">{reason}</p>
          <p className="mt-3 text-xs text-ink-muted">
            Danh sách này cố ý KHÔNG có bản giả lập. Các khối số liệu tổng hợp bịa được vì
            người xem đọc chúng như xu hướng và bảng đã ghi rõ là số giả; nhưng bịa ra
            những câu như thể có người thật đã viết chúng về Học viện thì khác hẳn — đó là
            dựng lời cho người không nói.
          </p>
        </Card>
      ) : (
        <>
          <div className="mb-5 flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-ink-muted">Sắc thái:</span>
              <Chip
                href={duongDan(hienTai, { sentiment: null })}
                dang_chon={!hienTai.sentiment}
              >
                Tất cả ({mentions.totalMatching})
              </Chip>
              {SAC_THAI.map((s) => (
                <Chip
                  key={s}
                  href={duongDan(hienTai, { sentiment: s })}
                  dang_chon={hienTai.sentiment === s}
                >
                  {SENTIMENT_LABEL_TEXT[s]} ({mentions.counts[s]})
                </Chip>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-ink-muted">Nền tảng:</span>
              <Chip
                href={duongDan(hienTai, { platform: null })}
                dang_chon={!hienTai.platform}
              >
                Tất cả
              </Chip>
              {NEN_TANG.map((n) => (
                <Chip
                  key={n}
                  href={duongDan(hienTai, { platform: n })}
                  dang_chon={hienTai.platform === n}
                >
                  {SOCIAL_PLATFORM_LABELS[n]}
                </Chip>
              ))}
            </div>
          </div>

          <p className="mb-4 text-xs text-ink-muted">
            {mentions.mentions.length} / {mentions.totalMatching} ý kiến · mô hình{" "}
            {mentions.modelVersion} · tài khoản người viết đã ẩn danh bằng mã băm ngay từ
            lúc thu thập
          </p>

          {mentions.mentions.length === 0 ? (
            <Card title="Không có ý kiến nào khớp bộ lọc">
              <p className="text-sm text-ink-secondary">
                Thử bỏ bớt bộ lọc. Kho hiện có {mentions.totalMatching} ý kiến.
              </p>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {mentions.mentions.map((m) => (
                <MentionCard
                  key={m.key}
                  mention={m}
                  confidenceThreshold={mentions.confidenceThreshold}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
