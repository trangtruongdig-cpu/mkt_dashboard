import type { Dataset } from "@ptit/shared";
import { IconLock } from "@/components/ui/icons";
import { formatNumber } from "@/lib/format";

interface StageColumnProps {
  label: string;
  note: string;
  datasets: Dataset[];
  /** Chỉ số nào đọc bảng nào, để đánh dấu bảng là mắt xích cuối. */
  kpiTheoBang: Map<string, string[]>;
}

/**
 * Một tầng của đường ống.
 *
 * Bảng chứa dữ liệu vận hành được đánh dấu bằng khoá và nhãn chữ, không chỉ bằng màu —
 * người xem phải biết ngay vì sao bảng đó không có dữ liệu mẫu, kể cả khi in đen trắng.
 */
export function StageColumn({
  label,
  note,
  datasets,
  kpiTheoBang,
}: StageColumnProps) {
  return (
    <section
      aria-label={label}
      className="rounded-lg border border-hairline bg-surface p-3"
    >
      <header className="mb-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-xs font-semibold text-ink">{label}</h3>
          <span className="text-[11px] text-ink-muted">{datasets.length} bảng</span>
        </div>
        <p className="mt-1 text-[11px] leading-snug text-ink-muted">{note}</p>
      </header>

      {datasets.length === 0 ? (
        <p className="text-[11px] text-ink-muted">Chưa có bảng nào ở tầng này.</p>
      ) : (
        <ul className="space-y-2">
          {datasets.map((d) => {
            const chiSo = kpiTheoBang.get(d.name) ?? [];
            return (
              <li
                key={d.name}
                className="rounded border border-hairline bg-surface-inset p-2.5"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <code className="font-mono text-[11px] break-all text-ink">
                    {d.name}
                  </code>
                  <span className="shrink-0 text-[11px] tabular-nums text-ink-secondary">
                    {d.rowCount === null ? "—" : formatNumber(d.rowCount)}
                  </span>
                </div>

                <p className="mt-1 text-[11px] leading-snug text-ink-secondary">
                  {d.description}
                </p>

                {d.producedBy ? (
                  <p className="mt-1.5 font-mono text-[10px] break-all text-ink-muted">
                    $ {d.producedBy}
                  </p>
                ) : null}

                <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px]">
                  {d.sensitivity === "internal" ? (
                    <span
                      className="inline-flex items-center gap-1"
                      style={{ color: "var(--status-warning)" }}
                      title="Dữ liệu vận hành của Học viện — không hiện mẫu"
                    >
                      <IconLock aria-hidden="true" className="h-3 w-3 shrink-0" /> nội bộ,
                      không hiện mẫu
                    </span>
                  ) : (
                    <span className="text-ink-muted">nguồn công khai</span>
                  )}

                  {chiSo.length > 0 ? (
                    <span className="text-ink-muted">
                      · {chiSo.length} chỉ số đọc
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
