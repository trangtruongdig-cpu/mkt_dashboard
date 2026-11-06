import type { MentionFunnelStage } from "@ptit/shared";

interface PipelineFunnelProps {
  stages: readonly MentionFunnelStage[];
}

/**
 * Phễu từ dữ liệu thô tới danh sách đang hiển thị.
 *
 * Vì sao phải hiện: người xem thấy 90 ý kiến mà không biết hệ thống đã thu về 208 thì sẽ
 * tưởng độ phủ chỉ có vậy. Thấy cả 208 → 90 kèm lý do từng bước thì mới đánh giá được là
 * lọc đúng hay lọc quá tay — và đó chính là câu hội đồng nghiệm thu sẽ hỏi.
 *
 * Thanh vẽ theo TỶ LỆ so với bước đầu tiên, không co giãn theo bước lớn nhất: mắt phải
 * đọc được ngay "còn lại chưa tới một nửa", chứ không phải nhìn bốn thanh gần bằng nhau.
 */
export function PipelineFunnel({ stages }: PipelineFunnelProps) {
  if (stages.length === 0) return null;

  const goc = stages[0]?.count ?? 0;
  if (goc === 0) return null;

  return (
    <ol className="flex flex-col gap-2">
      {stages.map((stage, i) => {
        const tyLe = Math.max(2, Math.round((stage.count / goc) * 100));
        const rot = i > 0 ? (stages[i - 1]?.count ?? stage.count) - stage.count : 0;

        return (
          <li key={stage.key}>
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="text-ink">
                {i + 1}. {stage.label}
              </span>
              <span className="shrink-0 tabular-nums text-ink-secondary">
                {stage.count.toLocaleString("vi-VN")}
                {rot > 0 && (
                  <span className="ml-2 text-ink-muted">−{rot.toLocaleString("vi-VN")}</span>
                )}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full rounded-full bg-grid">
              <div
                className="h-1.5 rounded-full bg-series-1"
                style={{ width: `${tyLe}%` }}
              />
            </div>
            {stage.note && (
              <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">{stage.note}</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
