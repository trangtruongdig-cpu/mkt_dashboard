import {
  SENTIMENT_LABEL_TEXT,
  SOCIAL_CONTENT_TYPE_LABELS,
  SOCIAL_PLATFORM_LABELS,
  type SocialMention,
} from "@ptit/shared";

interface MentionCardProps {
  mention: SocialMention;
  /** Dưới ngưỡng này thì nhãn sắc thái không đủ chắc để đọc như kết luận. */
  confidenceThreshold: number;
}

/** Màu viền trái theo sắc thái. Lấy từ token Tailwind, không hardcode mã hex. */
const VIEN: Record<SocialMention["sentiment"], string> = {
  positive: "border-l-sentiment-positive",
  neutral: "border-l-sentiment-neutral",
  negative: "border-l-sentiment-negative",
};

const CHU: Record<SocialMention["sentiment"], string> = {
  positive: "text-sentiment-positive",
  neutral: "text-ink-secondary",
  negative: "text-sentiment-negative",
};

/**
 * Một ý kiến, đọc được nguyên văn.
 *
 * Ba quyết định trình bày, mỗi cái chống một cách hiểu sai:
 *
 *  1. NGUYÊN VĂN, không cắt. Cắt một câu phàn nàn ở giữa là đổi nghĩa của nó.
 *  2. Nhãn sắc thái luôn đi kèm mức chắc chắn, và dưới ngưỡng thì đổi thành "model không
 *     chắc". Hiện "Tiêu cực" trần cho một câu model chỉ chắc 52% là để máy kết luận thay
 *     người đọc.
 *  3. Link về nguồn gốc là bắt buộc khi có. Một trích dẫn không tra ngược được thì không
 *     khác gì một câu bịa — và đây là dashboard sẽ đưa ra hội đồng nghiệm thu.
 */
export function MentionCard({ mention, confidenceThreshold }: MentionCardProps) {
  const duChac = mention.confidence >= confidenceThreshold;
  const ngay = new Date(mention.occurredAt).toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <article
      className={`border-l-4 ${VIEN[mention.sentiment]} bg-surface rounded-r-md border-y border-r border-baseline p-4`}
    >
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
        <span className={`font-medium ${duChac ? CHU[mention.sentiment] : "text-ink-muted"}`}>
          {duChac
            ? SENTIMENT_LABEL_TEXT[mention.sentiment]
            : `${SENTIMENT_LABEL_TEXT[mention.sentiment]} — model không chắc`}
        </span>
        <span aria-hidden>·</span>
        <span>{Math.round(mention.confidence * 100)}% chắc chắn</span>
        <span aria-hidden>·</span>
        <span>
          {SOCIAL_PLATFORM_LABELS[mention.platform]} ·{" "}
          {SOCIAL_CONTENT_TYPE_LABELS[mention.contentType]}
        </span>
        <span aria-hidden>·</span>
        <span className="truncate">{mention.sourceName}</span>
      </div>

      <p className="text-sm leading-relaxed whitespace-pre-line text-ink">
        {mention.text}
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
        <span>
          {ngay}
          {mention.occurredAtEstimated && (
            <span title="Nguồn không cho biết ngày đăng — đây là lần đầu hệ thống nhìn thấy">
              {" "}
              (ước lượng)
            </span>
          )}
        </span>
        {mention.likeCount > 0 && (
          <>
            <span aria-hidden>·</span>
            <span>{mention.likeCount.toLocaleString("vi-VN")} lượt thích</span>
          </>
        )}
        {mention.truncated && (
          <>
            <span aria-hidden>·</span>
            <span title="Nội dung dài hơn giới hạn của model, sắc thái chỉ chấm trên phần đầu">
              chấm trên phần đầu
            </span>
          </>
        )}
        {mention.url && (
          <>
            <span aria-hidden>·</span>
            <a
              href={mention.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-ink"
            >
              Xem nguồn gốc
            </a>
          </>
        )}
      </div>

      {/*
        Dữ liệu thô, đóng sẵn.
        Dùng <details> chứ không dùng state: khối này là phần phụ để KIỂM CHỨNG, không
        phải phần chính để đọc. Mở sẵn thì mỗi câu dài thêm mười dòng và người ta thôi
        đọc chính nội dung. Dùng thẻ gốc của trình duyệt nên chạy được cả khi JavaScript
        chưa tải, và trình đọc màn hình hiểu ngay.
      */}
      <details className="mt-3 border-t border-hairline pt-2">
        <summary className="cursor-pointer text-xs text-ink-muted hover:text-ink">
          Dữ liệu thô và cách chấm
        </summary>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-[11px] leading-relaxed text-ink-muted">
          <dt>mention_key</dt>
          <dd className="break-all">{mention.provenance.mentionKey}</dd>

          <dt>author_ref</dt>
          <dd className="break-all">
            {mention.provenance.authorRef ?? "—"}
            {mention.provenance.authorRef?.startsWith("anon:") && (
              <span className="ml-2 font-sans not-italic">
                (đã băm lúc thu thập, không lưu tên hiển thị)
              </span>
            )}
          </dd>

          <dt>discovered_via</dt>
          <dd>{mention.provenance.discoveredVia}</dd>

          <dt>search_term</dt>
          <dd>{mention.provenance.searchTerm ?? "— (bình luận đi kèm video, không tự tìm)"}</dd>

          <dt>first_seen_at</dt>
          <dd>{new Date(mention.provenance.firstSeenAt).toLocaleString("vi-VN")}</dd>

          <dt>published_at</dt>
          <dd>
            {new Date(mention.occurredAt).toLocaleString("vi-VN")}
            {mention.occurredAtEstimated && " (ước lượng)"}
          </dd>

          <dt>body_chars</dt>
          <dd>{mention.text.length}</dd>

          <dt className="pt-1">điểm model</dt>
          <dd className="pt-1">
            tích cực {mention.provenance.scores.positive.toFixed(4)} · trung tính{" "}
            {mention.provenance.scores.neutral.toFixed(4)} · tiêu cực{" "}
            {mention.provenance.scores.negative.toFixed(4)}
          </dd>
        </dl>
        <p className="mt-2 text-[11px] leading-relaxed text-ink-muted">
          Cả ba điểm đều hiện, không chỉ nhãn thắng: một câu 0,34/0,33/0,33 và một câu
          0,99/0,01/0,00 đều ra cùng một nhãn, nhưng mức độ chắc chắn khác hẳn nhau.
        </p>
      </details>
    </article>
  );
}
