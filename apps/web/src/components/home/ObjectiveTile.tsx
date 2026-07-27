import type { CascadeKpi, Objective } from "@ptit/shared";
import { objectiveGlyph } from "@/components/kpi/glyphs";
import { InfoHint } from "@/components/ui/InfoHint";
import { IconStar } from "@/components/ui/icons";
import { KpiLine } from "./KpiLine";

interface ObjectiveTileProps {
  objective: Objective;
  kpis: CascadeKpi[];
}

/**
 * Thẻ mục tiêu — hình phân loại, một câu mục tiêu, rồi tới các chỉ số đo nó.
 *
 * Câu “vì sao có mục tiêu này” (`rationale`) là phần dài nhất của dữ liệu và cũng là
 * phần ít người đọc lần thứ hai, nên nó nằm sau nút (i) cùng với phát biểu mục tiêu
 * đầy đủ. Mục tiêu trọng tâm của kỳ được đánh dấu bằng viền và ngôi sao — mỗi tầng
 * nhiều nhất một cái, ràng buộc này do schema giữ chứ không do giao diện.
 */
export function ObjectiveTile({ objective, kpis }: ObjectiveTileProps) {
  const glyph = objectiveGlyph(objective);
  const Icon = glyph.icon;

  return (
    <article
      className={`rounded-xl border bg-surface p-3.5 shadow-sm ${
        objective.isFocus
          ? "border-series-1/40 ring-1 ring-series-1/15"
          : "border-hairline"
      }`}
    >
      <header className="flex items-start gap-2.5">
        <span
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
            objective.isFocus
              ? "bg-series-1/10 text-series-1"
              : "bg-surface-inset text-ink-secondary"
          }`}
        >
          <Icon className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-[10px] font-medium tracking-wide text-ink-muted uppercase">
            {glyph.label}
            {objective.isFocus ? (
              <IconStar
                className="h-3 w-3 text-series-1"
                // Ngôi sao có nhãn chữ đi kèm ngay bên cạnh nên không cần lặp lại
                // cho trình đọc màn hình.
              />
            ) : null}
            {objective.isFocus ? (
              <span className="text-series-1 normal-case">Trọng tâm</span>
            ) : null}
          </p>
          <h3
            className="mt-0.5 line-clamp-2 text-[13px] leading-snug font-semibold text-ink"
            title={objective.statement}
          >
            {objective.statement}
          </h3>
        </div>

        <InfoHint label={`Vì sao có mục tiêu: ${objective.statement}`}>
          <p className="mb-2 text-[13px] font-semibold text-ink">
            {objective.statement}
          </p>
          <p>{objective.rationale}</p>
        </InfoHint>
      </header>

      <ul className="mt-2.5 border-t border-hairline pt-0.5">
        {kpis.map((kpi) => (
          <KpiLine key={kpi.key} kpi={kpi} />
        ))}
      </ul>
    </article>
  );
}
