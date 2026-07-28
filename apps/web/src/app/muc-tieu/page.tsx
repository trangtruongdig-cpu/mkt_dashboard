import { kpisByObjective, type Objective } from "@ptit/shared";
import Link from "next/link";
import { ShareOfSearchChart } from "@/components/charts/ShareOfSearchChart";
import { BrandRankTable } from "@/components/kpi/BrandRankTable";
import { GrowthSourceStrip } from "@/components/kpi/GrowthSourceStrip";
import { ObjectiveCard } from "@/components/kpi/ObjectiveCard";
import { getKpiData } from "@/lib/api";
import { formatUpdatedAt } from "@/lib/format";

/**
 * Render động, nhưng dữ liệu vẫn được cache 5 phút ở tầng `fetch`.
 *
 * Không dùng `export const revalidate`: nó khiến Next.js dựng sẵn HTML lúc BUILD, thời
 * điểm API còn chưa chạy. Kết quả là bản đầu tiên sau mỗi lần triển khai luôn hiện
 * "Nguồn: số liệu giả lập", và phải chờ hết chu kỳ mới tự sửa — người mở dashboard ngay
 * sau khi deploy sẽ thấy số bịa và không biết đó là số bịa nếu không đọc kỹ dòng nhỏ.
 *
 * `next: { revalidate: 300 }` trong `src/lib/api.ts` vẫn giữ nguyên: trang render mỗi
 * lượt truy cập, nhưng bốn lệnh gọi API dùng lại kết quả cache trong 5 phút. Tươi mà
 * không tăng tải.
 */
export const dynamic = "force-dynamic";

/** Mục tiêu truyền thông nào được gắn biểu đồ thị phần tìm kiếm ngay bên trong. */
const OBJECTIVE_WITH_SEARCH_CHART = "com_awareness";

export default async function TrangMucTieu() {
  const { source, apiUrl, cascade, shareOfSearch } = await getKpiData();

  const kpiMap = kpisByObjective(cascade);

  const childrenOf = (parentKey: string): Objective[] =>
    cascade.objectives.filter((o) => o.parentKey === parentKey);

  // Trọng tâm kỳ này lên đầu, phần còn lại giữ nguyên thứ tự khai báo.
  const businessObjectives = cascade.objectives
    .filter((o) => o.tier === "business")
    .sort((a, b) => Number(b.isFocus) - Number(a.isFocus));

  const measured = cascade.kpis.filter((k) => k.value !== null).length;

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 sm:px-8 sm:py-12">
      <header className="mb-8">
        <p className="text-xs font-medium tracking-wide text-ink-muted uppercase">
          Học viện Công nghệ Bưu chính Viễn thông
        </p>
        <h1 className="mt-1 text-xl font-semibold text-ink sm:text-2xl">
          Mục tiêu &amp; Chỉ số
        </h1>
        <p className="mt-1.5 text-sm text-ink-secondary">
          {cascade.period.label} · Cập nhật {formatUpdatedAt(cascade.updatedAt)}
        </p>
        <nav className="mt-3 text-sm">
          <Link
            className="text-series-1 underline underline-offset-2"
            href="/"
          >
            → Xem dashboard hiệu quả theo kênh
          </Link>
        </nav>
      </header>

      <div
        className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-hairline bg-surface px-4 py-3 text-xs"
        role="status"
      >
        <span className="font-medium text-ink">
          {source === "api" ? "Nguồn: API" : "Nguồn: số liệu giả lập"}
        </span>
        <span className="text-ink-muted">
          {measured}/{cascade.kpis.length} chỉ số đã có số liệu. Cấu trúc mục tiêu và
          các mức mục tiêu là quyết định thật; giá trị hiện tại phần lớn còn chờ các
          job thu thập chạy đủ một mùa.
          {source === "demo" && apiUrl
            ? ` Không gọi được ${apiUrl}.`
            : null}
        </span>
      </div>

      <section aria-labelledby="nguon-tang-truong" className="mb-10">
        <h2
          className="mb-1 text-sm font-semibold text-ink"
          id="nguon-tang-truong"
        >
          Năm nguồn tăng trưởng
        </h2>
        <p className="mb-4 text-xs leading-relaxed text-ink-secondary">
          Câu hỏi phải trả lời trước mọi câu khác: Học viện đang lớn lên bằng nguồn
          nào. Chỉ tiêu tuyển sinh đã tăng gấp 2,09 lần trong 4 năm trong khi quy mô
          ngành chỉ tăng khoảng 6,5%/năm — tăng trưởng bằng mở rộng chỉ tiêu và tăng
          học phí đang tới trần, nên trọng tâm chuyển sang nguồn Lựa chọn.
        </p>
        <GrowthSourceStrip
          objectives={cascade.objectives}
          kpisByObjectiveKey={kpiMap}
        />
      </section>

      <section aria-labelledby="chuoi-suy-dien">
        <h2 className="mb-1 text-sm font-semibold text-ink" id="chuoi-suy-dien">
          Chuỗi suy diễn mục tiêu
        </h2>
        <p className="mb-5 text-xs leading-relaxed text-ink-secondary">
          Đọc từ trên xuống: mục tiêu kinh doanh sinh ra mục tiêu marketing, mục tiêu
          marketing sinh ra mục tiêu truyền thông, và chỉ số nằm ở tầng nào là để đo
          mục tiêu của chính tầng đó. Không có chỉ số nào đứng ngoài chuỗi này.
        </p>

        <div className="space-y-8">
          {businessObjectives.map((business) => (
            <div key={business.key}>
              <ObjectiveCard
                objective={business}
                kpis={kpiMap.get(business.key) ?? []}
              />

              {childrenOf(business.key).map((marketing) => (
                <div key={marketing.key} className="mt-3 ml-3 sm:ml-6">
                  <p className="mb-2 text-[11px] text-ink-muted">
                    ↳ Để đạt mục tiêu kinh doanh này, mục tiêu marketing là:
                  </p>
                  <div className="border-l-2 border-hairline pl-3 sm:pl-5">
                    <ObjectiveCard
                      objective={marketing}
                      kpis={kpiMap.get(marketing.key) ?? []}
                    />

                    {childrenOf(marketing.key).map((communication) => (
                      <div
                        key={communication.key}
                        className="mt-3 ml-3 sm:ml-6"
                      >
                        <p className="mb-2 text-[11px] text-ink-muted">
                          ↳ Để đạt mục tiêu marketing này, mục tiêu truyền thông là:
                        </p>
                        <div className="border-l-2 border-hairline pl-3 sm:pl-5">
                          <ObjectiveCard
                            objective={communication}
                            kpis={kpiMap.get(communication.key) ?? []}
                          >
                            {communication.key === OBJECTIVE_WITH_SEARCH_CHART ? (
                              <div className="mt-4 border-t border-hairline pt-4">
                                <h4 className="text-xs font-semibold text-ink">
                                  Thị phần tìm kiếm theo tuần
                                </h4>
                                <p className="mt-0.5 mb-3 text-[11px] leading-snug text-ink-muted">
                                  Chi tiết đằng sau chỉ số của chính mục tiêu này.{" "}
                                  {shareOfSearch.provenance.label}
                                </p>
                                <ShareOfSearchChart data={shareOfSearch} />
                                <div className="mt-4">
                                  <BrandRankTable data={shareOfSearch} />
                                </div>
                              </div>
                            ) : null}
                          </ObjectiveCard>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <footer className="mt-10 border-t border-hairline pt-5 text-xs leading-relaxed text-ink-muted">
        <p>
          Cây mục tiêu được kiểm tính liền mạch ngay ở tầng hợp đồng dữ liệu
          (<code>@ptit/shared</code>): chỉ số không gắn mục tiêu, mục tiêu trỏ sai
          tầng, hay trạng thái gắn lệch so với mức hoàn thành đều bị chặn trước khi
          hiển thị.
        </p>
        <p className="mt-1">
          Nhiệm vụ nghiên cứu: xây dựng dashboard theo dõi hoạt động marketing số và
          thương hiệu — Học viện Công nghệ Bưu chính Viễn thông.
        </p>
      </footer>
    </div>
  );
}
