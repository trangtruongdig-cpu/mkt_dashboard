import {
  datasetsByStage,
  PIPELINE_STAGE_LABELS,
  PIPELINE_STAGE_NOTES,
  upstreamOf,
  type Dataset,
} from "@ptit/shared";
import { DatasetSampleTable } from "@/components/lineage/DatasetSampleTable";
import { StageColumn } from "@/components/lineage/StageColumn";
import { InfoHint } from "@/components/ui/InfoHint";
import { getDataLineage } from "@/lib/api";
import { formatNumber, formatUpdatedAt } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * TRANG DỮ LIỆU THÔ & ĐƯỜNG ỐNG XỬ LÝ.
 *
 * Mục đích: cho phép lần từ một con số bất kỳ trên dashboard về tới đúng bảng đã sinh
 * ra nó, và thấy nó đi qua những bước nào. Một dashboard không làm được việc đó thì
 * mọi con số đều phải tin bằng niềm tin.
 *
 * Ranh giới đã chọn, và lý do: chỉ hiện dữ liệu mẫu của các bảng NGUỒN CÔNG KHAI —
 * tin bài, tài liệu công khai bắt buộc, Wikipedia. Bảng GA4 và bảng thảo luận mạng xã
 * hội là dữ liệu vận hành của Học viện và nội dung do người dùng viết; trang này có
 * thể được mở cho người ngoài xem trong buổi nghiệm thu nên chúng không bao giờ được
 * lấy mẫu. Ràng buộc đó nằm ở tầng hợp đồng dữ liệu, không phải ở đây.
 */
export default async function TrangDuLieu() {
  const { source, apiUrl, lineage } = await getDataLineage();

  if (lineage === null) {
    return (
      <>
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
          <h1 className="text-lg font-semibold text-ink">Dữ liệu thô &amp; đường ống</h1>
          <p className="mt-3 rounded-lg border border-hairline bg-surface p-4 text-sm leading-relaxed text-ink-secondary">
            Chưa đọc được kho dữ liệu
            {apiUrl ? ` qua ${apiUrl}` : " vì chưa cấu hình NEXT_PUBLIC_API_URL"}.
            Trang này cố ý <strong className="text-ink">không có bản giả lập</strong>: nó
            nói về trạng thái thật của kho, nên dựng một đường ống giả để màn hình đỡ
            trống chính là thứ nó sinh ra để chống.
          </p>
        </main>
      </>
    );
  }

  const theoTang = datasetsByStage(lineage);
  const kpiTheoBang = new Map<string, string[]>();
  for (const lk of lineage.kpiLinks) {
    kpiTheoBang.set(lk.dataset, [...(kpiTheoBang.get(lk.dataset) ?? []), lk.kpiKey]);
  }

  const tongDong = lineage.datasets.reduce((s, d) => s + (d.rowCount ?? 0), 0);
  const coMau = new Set(lineage.samples.map((m) => m.dataset));
  const congKhai = lineage.datasets.filter((d) => d.sensitivity === "public");

  /** Chuỗi bảng dẫn tới một mart, in thành một dòng đọc được. */
  const chuoiNguon = (d: Dataset): string =>
    upstreamOf(lineage, d.name).reverse().concat(d.name).join("  →  ");

  return (
    <>

      <main className="mx-auto w-full max-w-[92rem] flex-1 px-4 py-5 sm:px-6">
        <header className="mb-5">
          <h1 className="text-lg font-semibold text-ink">
            Dữ liệu thô &amp; đường ống xử lý
          </h1>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-ink-secondary">
            Toàn bộ chặng đường từ bảng thô tới con số trên dashboard. Mỗi bảng ghi rõ
            ai sinh ra nó và lệnh nào tạo lại được — hội đồng nghiệm thu lần ngược từ
            một con số về tới dữ liệu gốc mà không cần mở cơ sở dữ liệu.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px]">
            <span className="text-ink-secondary">
              {lineage.datasets.length} bảng · {formatNumber(tongDong)} dòng
            </span>
            <span className="text-ink-muted">
              Cập nhật {formatUpdatedAt(lineage.updatedAt)}
            </span>
            <span
              className="ml-auto flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-2.5 py-1"
              role="status"
            >
              <span
                aria-hidden="true"
                className="h-1.5 w-1.5 rounded-full"
                style={{
                  backgroundColor:
                    source === "api" ? "var(--status-good)" : "var(--status-warning)",
                }}
              />
              <span className="font-medium text-ink">
                {source === "api" ? "Đọc từ kho thật" : "Chưa nối kho"}
              </span>
            </span>
          </div>
        </header>

        {/* Bốn tầng, xếp theo đúng chiều dữ liệu chảy. */}
        <section
          aria-label="Bốn tầng của đường ống"
          className="mb-6 grid grid-cols-1 gap-3 lg:grid-cols-4"
        >
          {theoTang.map(({ stage, datasets }) => (
            <StageColumn
              key={stage}
              datasets={datasets}
              kpiTheoBang={kpiTheoBang}
              label={PIPELINE_STAGE_LABELS[stage]}
              note={PIPELINE_STAGE_NOTES[stage]}
            />
          ))}
        </section>

        {/* Chuỗi truy vết đầy đủ cho từng bảng mart. */}
        <section aria-labelledby="chuoi-truy-vet" className="mb-6">
          <h2 className="text-sm font-semibold text-ink" id="chuoi-truy-vet">
            Chuỗi truy vết của từng hợp đồng dữ liệu
          </h2>
          <p className="mt-0.5 mb-3 text-xs text-ink-secondary">
            Đọc từ trái sang phải: bảng thô nào, qua bước chuẩn hoá nào, thành bảng nào
            mà backend đọc.
          </p>

          <div className="overflow-x-auto rounded-lg border border-hairline bg-surface">
            <table className="w-full text-xs">
              <caption className="sr-only">
                Chuỗi bảng dẫn tới từng bảng mart và các chỉ số đọc nó
              </caption>
              <thead>
                <tr className="border-b border-hairline text-left text-ink-muted">
                  <th className="px-3 py-2 font-medium" scope="col">
                    Chuỗi bảng
                  </th>
                  <th className="px-3 py-2 font-medium" scope="col">
                    Chỉ số đọc bảng cuối
                  </th>
                </tr>
              </thead>
              <tbody>
                {lineage.datasets
                  .filter((d) => d.stage === "mart")
                  .map((d) => (
                    <tr key={d.name} className="border-b border-hairline last:border-b-0">
                      <td className="px-3 py-2 font-mono text-[11px] whitespace-nowrap text-ink-secondary">
                        {chuoiNguon(d)}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-ink-muted">
                        {(kpiTheoBang.get(d.name) ?? ["— chưa chỉ số nào đọc —"]).join(", ")}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Dữ liệu thô, chỉ với nguồn công khai. */}
        <section aria-labelledby="du-lieu-tho">
          <div className="mb-3 flex flex-wrap items-baseline gap-x-3">
            <h2 className="text-sm font-semibold text-ink" id="du-lieu-tho">
              Nhìn tận mắt dữ liệu thô
            </h2>
            <InfoHint label="Vì sao chỉ có một số bảng">
              Chỉ hiện mẫu của {congKhai.length} bảng thuộc <strong>nguồn công khai</strong> —
              tin bài, tài liệu công khai bắt buộc theo Thông tư 09/2024, lượt xem
              Wikipedia. Bảng Google Analytics và bảng thảo luận mạng xã hội là dữ liệu
              vận hành của Học viện và nội dung do người dùng viết, nên không bao giờ
              được lấy mẫu. Ràng buộc này kiểm ở tầng hợp đồng dữ liệu: nếu tầng đọc lỡ
              trả về mẫu của bảng nội bộ thì cả gói bị từ chối, màn hình sập chứ không rò.
            </InfoHint>
          </div>

          {lineage.samples.length === 0 ? (
            <p className="rounded-lg border border-hairline bg-surface p-4 text-xs text-ink-secondary">
              Chưa có bảng nguồn công khai nào có dữ liệu. Chạy các job thu thập trước.
            </p>
          ) : (
            <div className="space-y-4">
              {lineage.samples.map((mau) => {
                const bang = lineage.datasets.find((d) => d.name === mau.dataset);
                return (
                  <DatasetSampleTable
                    key={mau.dataset}
                    dataset={bang}
                    sample={mau}
                  />
                );
              })}
            </div>
          )}

          {congKhai.filter((d) => d.stage === "raw" && !coMau.has(d.name)).length > 0 ? (
            <p className="mt-3 text-[11px] text-ink-muted">
              Bảng công khai chưa có dòng nào:{" "}
              {congKhai
                .filter((d) => d.stage === "raw" && !coMau.has(d.name))
                .map((d) => d.name)
                .join(", ")}
              .
            </p>
          ) : null}
        </section>
      </main>
    </>
  );
}
