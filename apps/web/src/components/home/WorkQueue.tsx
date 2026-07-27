import type { CascadeKpi, DataReadiness } from "@ptit/shared";
import { GlyphPill, READINESS_GLYPH } from "@/components/kpi/glyphs";
import { IconChevronDown, IconCode } from "@/components/ui/icons";

interface WorkQueueProps {
  kpis: CascadeKpi[];
}

/**
 * Thứ tự cấp bách: việc phải xin phép người khác nằm trên (thời gian chờ nằm ngoài
 * tầm kiểm soát của nhóm), rồi tới việc chỉ cần ngồi viết mã, cuối cùng là việc chỉ
 * cần chờ job chạy đủ kỳ.
 */
const URGENCY: readonly DataReadiness[] = [
  "not_planned",
  "needs_access",
  "needs_build",
  "public_ready",
  "connected",
] as const;

/**
 * HÀNG ĐỢI CÔNG VIỆC KỸ THUẬT — gấp lại, mở ra khi cần.
 *
 * Ô trống trên bảng điều khiển không phải chỗ khuyết mà là việc chưa làm. Danh sách
 * đó là thứ nhóm kỹ thuật cần, còn người xem báo cáo thì không — nên nó nằm sau một
 * cú bấm chứ không chiếm chỗ ở màn hình đầu tiên.
 */
export function WorkQueue({ kpis }: WorkQueueProps) {
  const rows = kpis
    .filter((kpi) => kpi.requirement.todo !== null)
    .sort(
      (a, b) =>
        URGENCY.indexOf(a.requirement.readiness) -
        URGENCY.indexOf(b.requirement.readiness),
    );

  if (rows.length === 0) {
    return null;
  }

  return (
    <details className="rounded-xl border border-hairline bg-surface shadow-sm">
      <summary className="flex items-center justify-between gap-3 px-4 py-2.5">
        <span className="flex min-w-0 items-center gap-2">
          <IconCode className="h-4 w-4 shrink-0 text-ink-muted" />
          <span className="truncate text-[13px] font-semibold text-ink">
            Hàng đợi công việc kỹ thuật
          </span>
          <span className="shrink-0 rounded-full bg-surface-inset px-1.5 py-0.5 text-[11px] text-ink-secondary tabular-nums">
            {rows.length}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[11px] text-ink-muted">
          Xem chi tiết
          <IconChevronDown className="h-4 w-4" />
        </span>
      </summary>

      <div className="overflow-x-auto border-t border-hairline">
        <table className="w-full min-w-[46rem] text-xs">
          <caption className="sr-only">
            Việc kỹ thuật còn lại của từng chỉ số, xếp theo mức cấp bách
          </caption>
          <thead>
            <tr className="border-b border-hairline bg-surface-inset text-[10px] tracking-wide text-ink-muted uppercase">
              <th className="px-4 py-2 text-left font-medium" scope="col">
                Chỉ số
              </th>
              <th className="px-3 py-2 text-left font-medium" scope="col">
                Nền tảng
              </th>
              <th className="px-3 py-2 text-left font-medium" scope="col">
                Mức sẵn sàng
              </th>
              <th className="px-4 py-2 text-left font-medium" scope="col">
                Việc cần làm
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((kpi) => {
              const glyph = READINESS_GLYPH[kpi.requirement.readiness];

              return (
                <tr className="border-b border-hairline last:border-b-0" key={kpi.key}>
                  <th
                    className="px-4 py-2 text-left align-top font-medium text-ink"
                    scope="row"
                  >
                    {kpi.label}
                  </th>
                  <td className="px-3 py-2 align-top text-ink-secondary">
                    {kpi.requirement.platform ?? "Chưa xác định"}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <GlyphPill glyph={glyph} />
                  </td>
                  <td className="px-4 py-2 align-top text-ink-secondary">
                    {kpi.requirement.todo}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}
