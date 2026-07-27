"use client";

import {
  CRAWLER_SCHEDULE_LABELS,
  CRAWLER_SOURCE_KIND_LABELS,
  CrawlerScheduleSchema,
  type CrawlerSchedule,
  type CrawlerSource,
} from "@ptit/shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { crawlerAdminApi } from "@/lib/admin-api";

const LICH = CrawlerScheduleSchema.options;

interface Props {
  sources: CrawlerSource[];
  /** Khoá nút "Chạy" khi đang có lượt khác chờ hoặc đang chạy. */
  dangBanRon: boolean;
}

export function SourceTable({ sources, dangBanRon }: Props) {
  const queryClient = useQueryClient();

  // Sửa xong thì nạp lại cả tổng quan lẫn danh sách: bật/tắt một nguồn làm đổi
  // số "nguồn đang bật" ở phần tổng quan.
  const lamMoi = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: ["crawler"] });
  };

  const sua = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Parameters<typeof crawlerAdminApi.updateSource>[1] }) =>
      crawlerAdminApi.updateSource(id, patch),
    onSuccess: lamMoi,
  });

  const chay = useMutation({
    mutationFn: (id: number) => crawlerAdminApi.runOne(id),
    onSuccess: lamMoi,
  });

  return (
    <div className="overflow-x-auto rounded-xl border border-hairline bg-surface">
      <table className="w-full min-w-[52rem] text-sm">
        <thead className="bg-surface-inset text-left text-xs text-ink-muted">
          <tr>
            <th className="px-4 py-2 font-medium">Nguồn</th>
            <th className="px-4 py-2 font-medium">Loại</th>
            <th className="px-4 py-2 font-medium">Trạng thái</th>
            <th className="px-4 py-2 font-medium">Lịch tự chạy</th>
            <th className="px-4 py-2 font-medium">Lần chạy gần nhất</th>
            <th className="px-4 py-2 font-medium sr-only">Thao tác</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((s) => (
            <tr key={s.id} className="border-t border-hairline align-middle">
              <td className="px-4 py-3">
                <div className="font-medium text-ink">{s.publisher}</div>
                <div className="text-xs text-ink-muted">{s.name}</div>
                {s.note ? (
                  <div className="mt-1 max-w-md text-xs text-[var(--status-warning)]">{s.note}</div>
                ) : null}
              </td>

              <td className="px-4 py-3 text-xs text-ink-secondary">
                {CRAWLER_SOURCE_KIND_LABELS[s.kind]}
              </td>

              <td className="px-4 py-3">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={s.enabled}
                    disabled={sua.isPending}
                    onChange={(e) =>
                      sua.mutate({ id: s.id, patch: { enabled: e.target.checked } })
                    }
                    className="size-4 accent-[var(--series-1)]"
                  />
                  {/* Không chỉ dùng màu để phân biệt: luôn có nhãn chữ đi kèm. */}
                  <span className={s.enabled ? "text-xs text-ink" : "text-xs text-ink-muted"}>
                    {s.enabled ? "Đang bật" : "Đã tắt"}
                  </span>
                </label>
              </td>

              <td className="px-4 py-3">
                <select
                  value={s.schedule}
                  disabled={sua.isPending || !s.enabled}
                  onChange={(e) =>
                    sua.mutate({
                      id: s.id,
                      patch: { schedule: e.target.value as CrawlerSchedule },
                    })
                  }
                  className="rounded-lg border border-hairline bg-surface-inset px-2 py-1 text-xs text-ink disabled:opacity-50"
                  aria-label={`Lịch chạy của ${s.publisher}`}
                >
                  {LICH.map((ma) => (
                    <option key={ma} value={ma}>
                      {CRAWLER_SCHEDULE_LABELS[ma]}
                    </option>
                  ))}
                </select>
              </td>

              <td className="px-4 py-3 text-xs text-ink-secondary">
                {s.lastRunAt ? (
                  <>
                    <div>{dinhDangLuc(s.lastRunAt)}</div>
                    {s.lastRunStatus === "that_bai" ? (
                      <div className="text-[var(--status-bad)]">Thất bại</div>
                    ) : null}
                  </>
                ) : (
                  <span className="text-ink-muted">Chưa chạy lần nào</span>
                )}
                {s.updatedBy ? (
                  <div className="mt-1 text-ink-muted">Sửa bởi {s.updatedBy}</div>
                ) : null}
              </td>

              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => chay.mutate(s.id)}
                  disabled={!s.enabled || dangBanRon || chay.isPending}
                  className="rounded-lg border border-hairline px-3 py-1 text-xs text-ink disabled:opacity-40"
                >
                  Chạy
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {sua.isError || chay.isError ? (
        <p role="alert" className="border-t border-hairline px-4 py-3 text-xs text-[var(--status-bad)]">
          {(sua.error ?? chay.error) instanceof Error
            ? ((sua.error ?? chay.error) as Error).message
            : "Không lưu được thay đổi"}
        </p>
      ) : null}
    </div>
  );
}

function dinhDangLuc(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
