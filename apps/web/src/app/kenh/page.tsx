import { SENTIMENT_SOURCE_LABELS } from "@ptit/shared";
import Link from "next/link";
import { ChannelTable } from "@/components/ChannelTable";
import { StatTile } from "@/components/StatTile";
import { ChannelBarChart } from "@/components/charts/ChannelBarChart";
import { ReachLineChart } from "@/components/charts/ReachLineChart";
import { SentimentChart } from "@/components/charts/SentimentChart";
import { Panel } from "@/components/home/Panel";
import { InfoHint } from "@/components/ui/InfoHint";
import {
  IconBarChart,
  IconDatabase,
  IconMegaphone,
  IconTrendingUp,
} from "@/components/ui/icons";
import { getDashboardData } from "@/lib/api";
import { formatCompact, formatPercent, formatUpdatedAt } from "@/lib/format";

/**
 * Render động, nhưng dữ liệu vẫn được cache 5 phút ở tầng `fetch`.
 *
 * Không dùng `export const revalidate`: nó khiến Next.js dựng sẵn HTML lúc BUILD, thời
 * điểm API còn chưa chạy. Kết quả là bản đầu tiên sau mỗi lần triển khai luôn hiện
 * "Nguồn: số liệu giả lập", và phải chờ hết chu kỳ mới tự sửa — người mở dashboard ngay
 * sau khi deploy sẽ thấy số bịa và không biết đó là số bịa nếu không đọc kỹ dòng nhỏ.
 *
 * `next: { revalidate: 300 }` trong `src/lib/api.ts` vẫn giữ nguyên: trang render mỗi
 * lượt truy cập, nhưng bốn lệnh gọi API dùng lại kết quả cache trong 5 phút. Tươi mà
 * không tăng tải.
 */
export const dynamic = "force-dynamic";

export default async function TrangKenh() {
  const { source, apiUrl, overview, reach, channels, sentiment } =
    await getDashboardData();

  const headlineDelta = overview.headline.deltaPct;

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 sm:px-8 sm:py-12">
      <header className="mb-8">
        <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">
          Học viện Công nghệ Bưu chính Viễn thông
        </p>
        <h1 className="mt-1 text-xl font-semibold text-ink sm:text-2xl">
          Hiệu quả theo kênh
        </h1>
        <p className="mt-1.5 text-sm text-ink-secondary">
          {overview.period.label} · Cập nhật{" "}
          {formatUpdatedAt(overview.updatedAt)}
        </p>
        <nav className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link
            className="text-series-1 underline underline-offset-2"
            href="/muc-tieu"
          >
            → Chuỗi suy diễn mục tiêu
          </Link>
          <Link
            className="text-series-1 underline underline-offset-2"
            href="/lang-nghe"
          >
            → Đọc từng ý kiến của người ngoài
          </Link>
        </nav>
      </header>

      <div
        className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-hairline bg-surface px-4 py-3 text-xs"
        role="status"
      >
        <span className="font-medium text-ink">
          {source === "api" ? "Nguồn: API" : "Nguồn: số liệu giả lập"}
        </span>
        <span className="text-ink-muted">
          {source === "api"
            ? `Đang đọc dữ liệu từ ${apiUrl}`
            : apiUrl
              ? `Không gọi được ${apiUrl} — trang đang hiển thị dữ liệu mẫu để minh hoạ giao diện.`
              : "Chưa cấu hình NEXT_PUBLIC_API_URL — trang đang hiển thị dữ liệu mẫu để minh hoạ giao diện."}
        </span>
      </div>

      {/* Chỉ số dẫn dắt — đúng một cái cho toàn trang. */}
      <section className="mb-6 rounded-xl border border-hairline bg-surface p-6">
        <p className="text-sm text-ink-secondary">{overview.headline.label}</p>
        <p className="mt-1 text-5xl font-semibold tracking-tight text-ink sm:text-6xl">
          {formatCompact(overview.headline.value)}
        </p>
        <p className="mt-2 text-sm">
          {headlineDelta !== null ? (
            <span
              className="font-medium"
              style={{
                color:
                  headlineDelta >= 0 === overview.headline.higherIsBetter
                    ? "var(--delta-good)"
                    : "var(--delta-bad)",
              }}
            >
              {headlineDelta >= 0 ? "▲" : "▼"}{" "}
              {formatPercent(Math.abs(headlineDelta))}
            </span>
          ) : null}{" "}
          <span className="text-ink-muted">{overview.headline.hint}</span>
        </p>
      </section>

      <section
        aria-label="Các chỉ số chính"
        className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        {overview.metrics.map((metric) => (
          <StatTile key={metric.key} metric={metric} />
        ))}
      </section>

      <div className="mb-6">
        <Panel
          hint={
            <InfoHint label="Về biểu đồ lượt tiếp cận">
              Chỉ vẽ ba kênh có quy mô lớn nhất: bảng màu dành đúng ba khe cho chuỗi dữ
              liệu, chuỗi thứ tư sẽ phá ngưỡng phân biệt màu của người mù màu. Di chuột
              lên biểu đồ để xem số liệu từng ngày.
            </InfoHint>
          }
          icon={IconTrendingUp}
          title="Lượt tiếp cận theo ngày"
        >
          <ReachLineChart data={reach} />
        </Panel>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel
          icon={IconBarChart}
          // Kỳ báo cáo đã ghi ở đầu trang. Lặp lại cả câu ở đây làm `meta` dài hơn
          // chỗ còn trống của khối nửa chiều ngang, và tiêu đề bị cắt cụt.
          meta="Cộng dồn cả kỳ"
          title="Lượt tương tác theo kênh"
        >
          <ChannelBarChart data={channels} />
        </Panel>

        <Panel
          hint={
            <InfoHint label="Về biểu đồ sắc thái">
              <p>
                Chấm bằng mô hình <code>{sentiment.modelVersion}</code>. Chiều cao cột là
                số lượt nhắc, nên cột thấp nghĩa là ít dữ liệu chứ không phải ít cảm xúc.
              </p>
              <p className="mt-2">
                Tháng có dưới {sentiment.minSampleForTrend} lượt được làm mờ: một tỷ lệ
                tính trên vài lượt nhắc không nói được xu hướng nào.
              </p>
            </InfoHint>
          }
          icon={IconMegaphone}
          meta={`${sentiment.totalMentions.toLocaleString("vi-VN")} lượt nhắc`}
          title={`Sắc thái theo tháng — ${SENTIMENT_SOURCE_LABELS[sentiment.source]}`}
        >
          <SentimentChart data={sentiment} />
        </Panel>
      </div>

      <Panel
        bodyClassName=""
        hint={
          <InfoHint label="Về bảng số liệu chi tiết">
            Bảng này là bản đọc được bằng chữ của ba biểu đồ phía trên — mọi biểu đồ
            trên bảng điều khiển đều phải có một đường đọc không cần nhìn màu, cho trình
            đọc màn hình và cho bản in đen trắng của hồ sơ nghiệm thu.
          </InfoHint>
        }
        icon={IconDatabase}
        title="Hiệu quả chi tiết theo kênh"
      >
        <ChannelTable data={channels} />
      </Panel>

      <footer className="mt-10 border-t border-hairline pt-5 text-xs leading-relaxed text-ink-muted">
        {source === "api" ? (
          <p>
            Khối sắc thái đọc từ kho thật (
            <code>mart__social_sentiment</code>). Ba khối còn lại —{" "}
            <strong className="font-medium text-ink-secondary">
              tiếp cận, hiệu quả kênh, chỉ số tổng quan
            </strong>{" "}
            — vẫn là dữ liệu giả lập vì chưa đấu nối xong, không dùng cho báo cáo.
          </p>
        ) : (
          <p>
            Số liệu hiển thị là{" "}
            <strong className="font-medium text-ink-secondary">
              dữ liệu giả lập
            </strong>{" "}
            sinh tất định trong <code>@ptit/shared</code> — không dùng cho báo cáo.
          </p>
        )}
        <p className="mt-1">
          Nhiệm vụ nghiên cứu: xây dựng dashboard theo dõi hoạt động marketing số
          và thương hiệu — Học viện Công nghệ Bưu chính Viễn thông.
        </p>
      </footer>
    </div>
  );
}
