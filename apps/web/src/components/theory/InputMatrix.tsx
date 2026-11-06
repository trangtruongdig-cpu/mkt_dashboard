import {
  BENCHMARK_COVERAGE_LABELS,
  OBJECTIVE_TIER_LABELS,
  type BenchmarkCoverage,
  type CascadeKpi,
  type DataProvenance,
  type KpiCascadeResponse,
} from "@ptit/shared";
import { formatMetric } from "@/lib/format";

interface InputMatrixProps {
  cascade: KpiCascadeResponse;
}

interface Nhom {
  provenance: DataProvenance;
  kpis: CascadeKpi[];
}

/** Thứ tự đọc: nguồn so được với đối thủ lên trước, nguồn chỉ đo được mình xuống sau. */
const THU_TU: Record<BenchmarkCoverage, number> = {
  full: 0,
  partial: 1,
  us_only: 2,
  not_applicable: 3,
};

const VIEN: Record<BenchmarkCoverage, string> = {
  full: "border-l-status-good",
  partial: "border-l-status-warning",
  us_only: "border-l-status-none",
  not_applicable: "border-l-status-none",
};

/**
 * BẢNG LIÊN KẾT: mỗi đầu vào nuôi mục tiêu nào, cần đạt mức nào, đối thủ đang ở đâu.
 *
 * Nhóm theo NGUỒN chứ không theo mục tiêu, vì câu "đối thủ đang ở đâu" là tính chất của
 * nguồn: một nguồn hoặc phủ được cả nhóm đối sánh, hoặc không. Nhóm theo mục tiêu sẽ
 * phải lặp lại câu trả lời đó ở mọi dòng và che mất chỗ hỏng thật — chỗ hỏng nằm ở đầu
 * vào, không nằm ở mục tiêu.
 *
 * Toàn bộ bảng đọc từ cây mục tiêu thật: thêm một chỉ số là bảng tự có thêm dòng.
 */
export function InputMatrix({ cascade }: InputMatrixProps) {
  const theoMucTieu = new Map(cascade.objectives.map((o) => [o.key, o]));

  const nhom = new Map<string, Nhom>();
  for (const kpi of cascade.kpis) {
    const khoa = kpi.provenance.label;
    const da_co = nhom.get(khoa);
    if (da_co) {
      da_co.kpis.push(kpi);
    } else {
      nhom.set(khoa, { provenance: kpi.provenance, kpis: [kpi] });
    }
  }

  const danh_sach = [...nhom.values()].sort((a, b) => {
    const ca = THU_TU[a.provenance.benchmark?.coverage ?? "not_applicable"];
    const cb = THU_TU[b.provenance.benchmark?.coverage ?? "not_applicable"];
    return ca - cb || b.kpis.length - a.kpis.length;
  });

  return (
    <div className="space-y-3">
      {danh_sach.map(({ provenance, kpis }) => {
        const coverage = provenance.benchmark?.coverage ?? "not_applicable";
        const do_duoc = kpis.filter((k) => k.value !== null).length;

        return (
          <section
            key={provenance.label}
            className={`rounded-xl border border-l-[3px] border-hairline bg-surface ${VIEN[coverage]}`}
          >
            <header className="border-b border-hairline px-3 py-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <h3 className="text-xs font-semibold text-ink">
                  {provenance.label}
                </h3>
                <span className="text-[11px] whitespace-nowrap text-ink-muted">
                  {do_duoc}/{kpis.length} chỉ số đã có số
                </span>
              </div>

              {provenance.legalBasis ? (
                <p className="mt-0.5 text-[11px] text-ink-muted">
                  Căn cứ pháp lý: {provenance.legalBasis}
                </p>
              ) : null}

              {/*
                Dòng đối thủ nằm ngay dưới tên nguồn chứ không ở cột riêng: nó quyết định
                cách đọc MỌI chỉ số bên dưới, nên không được để lọt xuống cuối hàng.
              */}
              <p className="mt-1.5 text-[11px] leading-snug text-ink-secondary">
                <span className="font-medium text-ink">
                  Đối thủ: {BENCHMARK_COVERAGE_LABELS[coverage]}.
                </span>{" "}
                {provenance.benchmark?.note ?? "Chưa khai mức phủ đối thủ."}
              </p>
            </header>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem] border-collapse text-left">
                <caption className="sr-only">
                  Các chỉ số lấy từ {provenance.label}
                </caption>
                <thead>
                  <tr className="border-b border-hairline">
                    <th
                      className="px-3 py-1.5 text-[10px] font-medium text-ink-muted"
                      scope="col"
                    >
                      Chỉ số
                    </th>
                    <th
                      className="w-40 px-3 py-1.5 text-[10px] font-medium text-ink-muted"
                      scope="col"
                    >
                      Nuôi mục tiêu
                    </th>
                    <th
                      className="w-24 px-3 py-1.5 text-right text-[10px] font-medium text-ink-muted"
                      scope="col"
                    >
                      Hiện tại
                    </th>
                    <th
                      className="w-24 px-3 py-1.5 text-right text-[10px] font-medium text-ink-muted"
                      scope="col"
                    >
                      Cần đạt
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {kpis.map((kpi) => {
                    const objective = theoMucTieu.get(kpi.objectiveKey);
                    return (
                      <tr
                        key={kpi.key}
                        className="border-b border-hairline last:border-b-0"
                      >
                        <th
                          className="px-3 py-2 align-top text-[11px] font-normal text-ink"
                          scope="row"
                        >
                          {kpi.label}
                        </th>
                        <td className="px-3 py-2 align-top text-[11px] text-ink-secondary">
                          <span title={objective?.statement}>
                            {objective?.shortName ?? "—"}
                          </span>
                          <span className="block text-[10px] text-ink-muted">
                            {OBJECTIVE_TIER_LABELS[kpi.tier].toLowerCase()}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right align-top font-mono text-[11px] text-ink">
                          {kpi.value === null ? (
                            <span className="text-ink-muted">—</span>
                          ) : (
                            formatMetric(kpi.value, kpi.unit)
                          )}
                        </td>
                        <td className="px-3 py-2 text-right align-top font-mono text-[11px] text-ink-secondary">
                          {kpi.target === null ? (
                            <span className="text-ink-muted italic">
                              chưa chốt
                            </span>
                          ) : (
                            formatMetric(kpi.target, kpi.unit)
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
