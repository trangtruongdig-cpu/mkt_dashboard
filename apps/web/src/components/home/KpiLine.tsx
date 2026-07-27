import {
  completionRatio,
  KPI_CADENCE_LABELS,
  type CascadeKpi,
} from "@ptit/shared";
import {
  GlyphIcon,
  READINESS_GLYPH,
  STATUS_GLYPH,
} from "@/components/kpi/glyphs";
import { InfoHint } from "@/components/ui/InfoHint";
import { Meter } from "@/components/ui/Meter";
import { formatMetric } from "@/lib/format";

interface KpiLineProps {
  kpi: CascadeKpi;
}

/**
 * MỘT CHỈ SỐ TRÊN MỘT DÒNG.
 *
 * Bản trước của bảng điều khiển dành cho mỗi chỉ số một thẻ với diễn giải tích cực,
 * diễn giải tiêu cực, nền tảng, trường dữ liệu và việc cần làm — tất cả đều hiện.
 * Đọc hết hai mươi chỉ số như vậy là đọc một bài viết, không phải xem một bảng điều
 * khiển. Ở đây mỗi chỉ số rút về một dòng quét được bằng mắt:
 *
 *     [hình trạng thái] tên chỉ số ............ giá trị / mục tiêu  [nguồn]  (i)
 *                       ▓▓▓▓▓▓▓▓░░░░░░░░ thanh đo mức hoàn thành
 *
 * Toàn bộ phần chữ không mất đi — nó nằm sau nút (i), một cú bấm là ra, và vẫn in ra
 * được cho hồ sơ nghiệm thu.
 */
export function KpiLine({ kpi }: KpiLineProps) {
  const status = STATUS_GLYPH[kpi.status];
  const readiness = READINESS_GLYPH[kpi.requirement.readiness];
  const ratio = completionRatio(kpi.value, kpi.target, kpi.higherIsBetter);

  return (
    <li className="border-b border-hairline py-2 last:border-b-0">
      <div className="flex items-center gap-2">
        <GlyphIcon className="h-4 w-4" glyph={status} />

        <p className="min-w-0 flex-1 truncate text-[13px] text-ink" title={kpi.label}>
          {kpi.label}
        </p>

        <p className="shrink-0 text-[13px] font-semibold text-ink tabular-nums">
          {kpi.value === null ? (
            <span className="text-ink-muted" title="Chưa có số liệu">
              —
            </span>
          ) : (
            formatMetric(kpi.value, kpi.unit)
          )}
          {kpi.target === null ? null : (
            <span className="ml-1 text-[11px] font-normal text-ink-muted">
              / {formatMetric(kpi.target, kpi.unit)}
            </span>
          )}
        </p>

        <GlyphIcon className="h-3.5 w-3.5" glyph={readiness} />

        <InfoHint label={`Diễn giải chỉ số ${kpi.label}`}>
          <p className="mb-2 text-[13px] font-semibold text-ink">{kpi.label}</p>

          {kpi.hint ? <p className="mb-2">{kpi.hint}</p> : null}

          <dl className="space-y-1.5">
            <div className="flex gap-1.5">
              <dt
                className="shrink-0 font-medium"
                style={{ color: "var(--delta-good)" }}
              >
                <span aria-hidden="true">▲</span> Tích cực
              </dt>
              <dd>{kpi.interpretation.positive}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt
                className="shrink-0 font-medium"
                style={{ color: "var(--delta-bad)" }}
              >
                <span aria-hidden="true">▼</span> Tiêu cực
              </dt>
              <dd>{kpi.interpretation.negative}</dd>
            </div>
          </dl>

          <dl className="mt-2.5 space-y-1 border-t border-hairline pt-2 text-[11px]">
            <div className="flex gap-1.5">
              <dt className="shrink-0 text-ink-muted">Nhịp</dt>
              <dd>{KPI_CADENCE_LABELS[kpi.cadence]}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt className="shrink-0 text-ink-muted">Nguồn</dt>
              <dd>
                {kpi.requirement.platform ?? "Chưa xác định nền tảng"} ·{" "}
                <span style={{ color: readiness.color }}>{readiness.label}</span>
              </dd>
            </div>
            {kpi.requirement.todo ? (
              <div className="flex gap-1.5">
                <dt className="shrink-0 text-ink-muted">Còn phải làm</dt>
                <dd>{kpi.requirement.todo}</dd>
              </div>
            ) : null}
            <div className="flex gap-1.5">
              <dt className="shrink-0 text-ink-muted">Xuất xứ</dt>
              <dd>
                {kpi.provenance.url ? (
                  <a
                    className="underline underline-offset-2 hover:text-ink"
                    href={kpi.provenance.url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {kpi.provenance.label}
                  </a>
                ) : (
                  kpi.provenance.label
                )}
                {kpi.provenance.legalBasis ? ` · ${kpi.provenance.legalBasis}` : null}
              </dd>
            </div>
          </dl>
        </InfoHint>
      </div>

      {ratio === null ? null : (
        <div className="mt-1.5 pr-14 pl-6">
          <Meter
            ariaLabel={`${kpi.label}: đạt ${Math.round(ratio * 100)}% mục tiêu`}
            color={status.color}
            ratio={ratio}
          />
        </div>
      )}
    </li>
  );
}
