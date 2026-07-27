"use client";

import { CRAWLER_RUN_STATUS_LABELS, type CrawlerRun, type CrawlerRunStatus } from "@ptit/shared";

/** Màu trạng thái luôn đi kèm nhãn chữ — không bao giờ chỉ dùng màu để truyền tin. */
const MAU_TRANG_THAI: Record<CrawlerRunStatus, string> = {
  cho_chay: "text-ink-muted",
  dang_chay: "text-[var(--status-warning)]",
  thanh_cong: "text-[var(--status-good)]",
  that_bai: "text-[var(--status-bad)]",
};

export function RunTable({ runs }: { runs: CrawlerRun[] }) {
  if (runs.length === 0) {
    return (
      <p className="rounded-xl border border-hairline bg-surface px-4 py-6 text-center text-xs text-ink-muted">
        Chưa có lượt thu thập nào. Bấm “Chạy ngay” hoặc đặt lịch cho một nguồn.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-hairline bg-surface">
      <table className="w-full min-w-[46rem] text-sm">
        <thead className="bg-surface-inset text-left text-xs text-ink-muted">
          <tr>
            <th className="px-4 py-2 font-medium">Bắt đầu</th>
            <th className="px-4 py-2 font-medium">Phạm vi</th>
            <th className="px-4 py-2 font-medium">Kích hoạt</th>
            <th className="px-4 py-2 font-medium">Trạng thái</th>
            <th className="px-4 py-2 text-right font-medium">Bài tìm được</th>
            <th className="px-4 py-2 text-right font-medium">Bản ghi mới</th>
            <th className="px-4 py-2 text-right font-medium">Toàn văn</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id} className="border-t border-hairline">
              <td className="px-4 py-2 text-xs text-ink-secondary">{dinhDangLuc(r.startedAt)}</td>
              <td className="px-4 py-2 text-xs text-ink">
                {r.sourceName ?? "Toàn bộ nguồn đang bật"}
              </td>
              <td className="px-4 py-2 text-xs text-ink-secondary">
                {r.trigger === "lich" ? "Theo lịch" : "Thủ công"}
              </td>
              <td className={`px-4 py-2 text-xs ${MAU_TRANG_THAI[r.status]}`}>
                {CRAWLER_RUN_STATUS_LABELS[r.status]}
                {r.errorMessage ? (
                  <div className="mt-1 max-w-sm truncate text-ink-muted" title={r.errorMessage}>
                    {r.errorMessage}
                  </div>
                ) : null}
              </td>
              <td className="px-4 py-2 text-right text-xs tabular-nums text-ink">
                {dinhDangSo(r.mentionsFound)}
              </td>
              <td className="px-4 py-2 text-right text-xs tabular-nums text-ink">
                {dinhDangSo(r.mentionsNew)}
              </td>
              <td className="px-4 py-2 text-right text-xs tabular-nums text-ink-secondary">
                {dinhDangSo(r.extractedOk)}
                <span className="text-ink-muted"> / {dinhDangSo(r.extractedOk + r.extractedFailed)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function dinhDangLuc(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dinhDangSo(n: number): string {
  return n.toLocaleString("vi-VN");
}
