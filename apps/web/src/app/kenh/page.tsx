import Link from "next/link";
import { Card } from "@/components/Card";
import { ChannelTable } from "@/components/ChannelTable";
import { StatTile } from "@/components/StatTile";
import { ChannelBarChart } from "@/components/charts/ChannelBarChart";
import { ReachLineChart } from "@/components/charts/ReachLineChart";
import { SentimentChart } from "@/components/charts/SentimentChart";
import { getDashboardData } from "@/lib/api";
import { formatCompact, formatPercent, formatUpdatedAt } from "@/lib/format";

export const revalidate = 300;

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
          Dashboard Marketing số &amp; Thương hiệu
        </h1>
        <p className="mt-1.5 text-sm text-ink-secondary">
          {overview.period.label} · Cập nhật{" "}
          {formatUpdatedAt(overview.updatedAt)}
        </p>
        <nav className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link className="text-series-1 underline underline-offset-2" href="/">
            ← Bảng điều khiển mục tiêu
          </Link>
          <Link
            className="text-series-1 underline underline-offset-2"
            href="/muc-tieu"
          >
            → Chuỗi suy diễn mục tiêu
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
        <Card
          title="Lượt tiếp cận theo ngày"
          subtitle="Ba kênh có quy mô lớn nhất. Di chuột lên biểu đồ để xem số liệu từng ngày."
        >
          <ReachLineChart data={reach} />
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card
          title="Lượt tương tác theo kênh"
          subtitle={`Cộng dồn trong ${overview.period.label.toLowerCase()}`}
        >
          <ChannelBarChart data={channels} />
        </Card>

        <Card
          title="Sắc thái thảo luận theo tuần"
          subtitle={`${sentiment.totalMentions.toLocaleString("vi-VN")} lượt nhắc · mô hình ${sentiment.modelVersion}`}
        >
          <SentimentChart data={sentiment} />
        </Card>
      </div>

      <Card
        title="Hiệu quả chi tiết theo kênh"
        subtitle="Bảng số liệu đầy đủ, dùng được với trình đọc màn hình và khi in đen trắng."
      >
        <ChannelTable data={channels} />
      </Card>

      <footer className="mt-10 border-t border-hairline pt-5 text-xs leading-relaxed text-ink-muted">
        <p>
          Bản demo giao diện. Số liệu hiển thị là{" "}
          <strong className="font-medium text-ink-secondary">
            dữ liệu giả lập
          </strong>{" "}
          sinh tất định trong <code>@ptit/shared</code>, chưa đấu nối Airbyte và
          dbt — không dùng cho báo cáo.
        </p>
        <p className="mt-1">
          Nhiệm vụ nghiên cứu: xây dựng dashboard theo dõi hoạt động marketing số
          và thương hiệu — Học viện Công nghệ Bưu chính Viễn thông.
        </p>
      </footer>
    </div>
  );
}
