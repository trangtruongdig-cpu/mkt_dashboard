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
    </article>
  );
}
