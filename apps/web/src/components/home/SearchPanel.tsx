import {
  completionRatio,
  type CascadeKpi,
  type ShareOfSearchResponse,
} from "@ptit/shared";
import { ShareOfSearchChart } from "@/components/charts/ShareOfSearchChart";
import { STATUS_GLYPH } from "@/components/kpi/glyphs";
import { InfoHint } from "@/components/ui/InfoHint";
import { Meter } from "@/components/ui/Meter";
import { IconSearch } from "@/components/ui/icons";
import { formatPercent } from "@/lib/format";
import { BrandRankBars } from "./BrandRankBars";
import { Panel } from "./Panel";

interface SearchPanelProps {
  data: ShareOfSearchResponse;
  /** Chỉ số “Thị phần tìm kiếm” trong cascade — nơi giữ mức cần đạt và trạng thái. */
  kpi: CascadeKpi | undefined;
}

/**
 * KHỐI DẪN DẮT CỦA TRANG.
 *
 * Trong hai mươi chỉ số của cascade, thị phần tìm kiếm là chỉ số duy nhất vừa chạy
 * được ngay (nguồn công khai, không cần tài khoản quảng cáo), vừa biến động theo
 * tuần, vừa đi trước kết quả tuyển sinh. Vì vậy nó — chứ không phải một con số tổng
 * hợp nào khác — là hình ảnh lớn đầu tiên người xem gặp.
 *
 * Con số lớn, thanh đo so với mục tiêu và biểu đồ đường nói cùng một chuỗi dữ liệu:
 * số trên ô luôn bằng đúng điểm cuối của đường, không chép tay hai lần.
 */
export function SearchPanel({ data, kpi }: SearchPanelProps) {
  const us = data.series.find((series) => series.brand.isUs);
  const current = us?.values[us.values.length - 1] ?? null;
  const first = us?.values[0] ?? null;
  const delta = current !== null && first !== null ? current - first : null;

  const target = kpi?.target ?? null;
  const ratio =
    kpi === undefined
      ? null
      : completionRatio(kpi.value, kpi.target, kpi.higherIsBetter);
  const status = kpi ? STATUS_GLYPH[kpi.status] : null;

  return (
    <Panel
      bodyClassName="grid gap-5 p-4 lg:grid-cols-[13rem_minmax(0,1fr)]"
      footer={<BrandRankBars rows={data.latest} />}
      hint={
        <InfoHint align="left" label="Về chỉ số thị phần tìm kiếm">
          <p className="mb-2">
            Tỷ trọng mức độ quan tâm tìm kiếm dành cho Học viện trong nhóm sáu
            trường đối sánh, tính theo tuần.
          </p>
          <p className="mb-2">
            Đây là tín hiệu sớm: thị phần tìm kiếm đổi theo tuần, còn kết quả tuyển
            sinh mỗi năm mới có một lần. Giảm ở đây hôm nay là hụt nhập học của mùa
            sau.
          </p>
          <p className="text-[11px] text-ink-muted">
            Xuất xứ: {data.provenance.label}
          </p>
        </InfoHint>
      }
      icon={IconSearch}
      meta={data.period.label}
      title="Thị phần tìm kiếm"
    >
      <div>
        <p className="text-[11px] font-medium text-ink-muted">
          Tuần gần nhất
        </p>
        <p className="mt-1 text-5xl leading-none font-semibold tracking-tight text-ink">
          {current === null ? "—" : formatPercent(current, 1)}
        </p>

        {delta === null ? null : (
          <p
            className="mt-2 text-xs font-medium"
            style={{
              color: delta >= 0 ? "var(--delta-good)" : "var(--delta-bad)",
            }}
          >
            <span aria-hidden="true">{delta >= 0 ? "▲" : "▼"}</span>{" "}
            {Math.abs(delta).toLocaleString("vi-VN", {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}{" "}
            điểm
            <span className="ml-1 font-normal text-ink-muted">so với đầu kỳ</span>
          </p>
        )}

        {target !== null && ratio !== null && status !== null ? (
          <div className="mt-4">
            <div className="mb-1.5 flex items-baseline justify-between gap-2 text-[11px]">
              <span className="text-ink-muted">Mục tiêu</span>
              <span className="text-ink tabular-nums">
                {formatPercent(target, 0)}
              </span>
            </div>
            <Meter
              ariaLabel={`Đạt ${Math.round(ratio * 100)}% mục tiêu thị phần tìm kiếm`}
              color={status.color}
              ratio={ratio}
              size="md"
            />
            <p
              className="mt-1.5 text-[11px] font-medium"
              style={{ color: status.color }}
            >
              {status.label} · {Math.round(ratio * 100)}%
            </p>
          </div>
        ) : null}
      </div>

      <ShareOfSearchChart data={data} />
    </Panel>
  );
}
