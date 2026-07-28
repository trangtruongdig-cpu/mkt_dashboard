import {
  DataReadinessSchema,
  KpiStatusSchema,
  kpisByObjective,
  OBJECTIVE_TIER_LABELS,
  ObjectiveTierSchema,
  type ObjectiveTier,
} from "@ptit/shared";
import { DistributionBar } from "@/components/home/DistributionBar";
import { ObjectiveTile } from "@/components/home/ObjectiveTile";
import { Panel } from "@/components/home/Panel";
import { SearchPanel } from "@/components/home/SearchPanel";
import { SummaryTile } from "@/components/home/SummaryTile";
import { WorkQueue } from "@/components/home/WorkQueue";
import {
  READINESS_GLYPH,
  STATUS_GLYPH,
  TIER_ICON,
} from "@/components/kpi/glyphs";
import { TopBar } from "@/components/layout/TopBar";
import { InfoHint } from "@/components/ui/InfoHint";
import {
  IconArrowDown,
  IconArrowRight,
  IconClock,
  IconCode,
  IconDatabase,
  IconGauge,
  IconPlug,
  IconTarget,
} from "@/components/ui/icons";
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

/** Diễn giải từng tầng — nằm sau nút (i) ở đầu cột, không chiếm chỗ trên màn hình. */
const TIER_NOTE: Record<ObjectiveTier, string> = {
  business:
    "Học viện lớn lên bằng nguồn nào. Mọi mục tiêu bên dưới đều là hệ quả của lựa chọn ở tầng này.",
  marketing:
    "Phải làm gì với thị trường để mục tiêu kinh doanh ở tầng trước thành hiện thực.",
  communication:
    "Truyền thông phải đạt điều gì để mục tiêu marketing ở tầng trước thành hiện thực.",
};

/**
 * TRANG CHỦ — BẢNG ĐIỀU KHIỂN.
 *
 * Trang này trả lời ba câu hỏi, theo đúng thứ tự nó được vẽ ra:
 *
 *   1. Hệ thống đang đo được tới đâu?      → hàng ô chỉ số tổng quan
 *   2. Tín hiệu sống hiện nay ra sao?      → khối thị phần tìm kiếm
 *   3. Từng mục tiêu đang đứng ở đâu?      → bản đồ cascade ba cột
 *
 * Nguyên tắc trình bày: mọi câu văn giải thích đều gấp lại sau nút (i) hoặc sau một
 * khối bung ra. Trên màn hình mặc định chỉ còn hình, con số, thanh đo và biểu đồ —
 * phần chữ vẫn nằm nguyên trong DOM nên trình đọc màn hình và bản in không mất gì.
 */
export default async function TrangChu() {
  const { source, apiUrl, cascade, shareOfSearch } = await getKpiData();

  const kpiMap = kpisByObjective(cascade);
  const total = cascade.kpis.length;
  const measured = cascade.kpis.filter((kpi) => kpi.value !== null).length;
  const onTrack = cascade.kpis.filter((kpi) => kpi.status === "on_track").length;
  const connected = cascade.kpis.filter(
    (kpi) =>
      kpi.requirement.readiness === "connected" ||
      kpi.requirement.readiness === "public_ready",
  ).length;
  const pendingWork = cascade.kpis.filter(
    (kpi) => kpi.requirement.todo !== null,
  ).length;

  const statusSegments = KpiStatusSchema.options.map((status) => ({
    key: status,
    count: cascade.kpis.filter((kpi) => kpi.status === status).length,
    glyph: STATUS_GLYPH[status],
  }));

  const readinessSegments = DataReadinessSchema.options.map((readiness) => ({
    key: readiness,
    count: cascade.kpis.filter(
      (kpi) => kpi.requirement.readiness === readiness,
    ).length,
    glyph: READINESS_GLYPH[readiness],
  }));

  const searchKpi = cascade.kpis.find((kpi) => kpi.key === "share_of_search");

  // Trọng tâm kỳ này lên đầu mỗi cột; phần còn lại giữ nguyên thứ tự khai báo.
  const objectivesOfTier = (tier: ObjectiveTier) =>
    cascade.objectives
      .filter((objective) => objective.tier === tier)
      .sort((a, b) => Number(b.isFocus) - Number(a.isFocus));

  return (
    <>
      <TopBar active="/" />

      <main className="mx-auto w-full max-w-[92rem] flex-1 px-4 py-5 sm:px-6">
        {/* Dải bối cảnh: kỳ báo cáo, thời điểm cập nhật, nguồn dữ liệu đang dùng. */}
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px]">
          <span className="flex items-center gap-1.5 text-ink-secondary">
            <IconClock className="h-3.5 w-3.5 text-ink-muted" />
            {cascade.period.label}
          </span>
          <span className="text-ink-muted">
            Cập nhật {formatUpdatedAt(cascade.updatedAt)}
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
                  source === "api"
                    ? "var(--status-good)"
                    : "var(--status-warning)",
              }}
            />
            <span className="font-medium text-ink">
              {source === "api" ? "Dữ liệu API" : "Dữ liệu giả lập"}
            </span>
            <InfoHint label="Về nguồn dữ liệu đang hiển thị">
              {source === "api" ? (
                <p>Trang đang đọc số liệu trực tiếp từ {apiUrl}.</p>
              ) : (
                <p>
                  {apiUrl
                    ? `Không gọi được ${apiUrl} nên trang quay về bộ số liệu giả lập trong @ptit/shared.`
                    : "Chưa cấu hình NEXT_PUBLIC_API_URL nên trang dùng bộ số liệu giả lập trong @ptit/shared."}{" "}
                  Cấu trúc mục tiêu và các mức cần đạt là quyết định thật; giá trị
                  hiện tại phần lớn còn chờ job thu thập chạy đủ một mùa.
                </p>
              )}
            </InfoHint>
          </span>
        </div>

        {/* 1 · Hệ thống đang đo được tới đâu. */}
        <section
          aria-label="Tổng quan mức độ đo được"
          className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4"
        >
          <SummaryTile
            hint={
              <InfoHint label="Về chỉ số đúng hướng">
                Số chỉ số đang đạt từ 95% mức cần đạt trở lên. Trạng thái do
                <code className="mx-1">evaluateStatus</code>
                suy ra từ giá trị và mục tiêu, không ai gắn nhãn bằng tay.
              </InfoHint>
            }
            icon={IconTarget}
            label="Chỉ số đúng hướng"
            meter={{
              ratio: onTrack / total,
              color: "var(--status-good)",
              label: `${onTrack} trên ${total} chỉ số đúng hướng`,
            }}
            unit={`/ ${total}`}
            value={String(onTrack)}
          />

          <SummaryTile
            hint={
              <InfoHint label="Về chỉ số đã có số liệu">
                Chỉ số chưa có nguồn dữ liệu chạy được thì để trống thay vì điền số
                ước chừng. Ràng buộc này được kiểm ngay ở tầng hợp đồng dữ liệu.
              </InfoHint>
            }
            icon={IconDatabase}
            label="Đã có số liệu"
            meter={{
              ratio: measured / total,
              color: "var(--series-1)",
              label: `${measured} trên ${total} chỉ số đã có số liệu`,
            }}
            unit={`/ ${total}`}
            value={String(measured)}
          />

          <SummaryTile
            hint={
              <InfoHint label="Về nguồn dữ liệu đã chạy được">
                Gồm hai mức: đã kết nối, và nguồn công khai đã viết xong mã chỉ chờ
                chạy đủ kỳ để có gốc so sánh.
              </InfoHint>
            }
            icon={IconPlug}
            label="Nguồn đã chạy được"
            meter={{
              ratio: connected / total,
              color: "var(--series-3)",
              label: `${connected} trên ${total} chỉ số đã có nguồn chạy được`,
            }}
            unit={`/ ${total}`}
            value={String(connected)}
          />

          <SummaryTile
            hint={
              <InfoHint label="Về hàng đợi công việc kỹ thuật">
                Mỗi ô trống trên bảng điều khiển tương ứng một việc kỹ thuật cụ thể.
                Danh sách đầy đủ nằm ở khối “Hàng đợi công việc kỹ thuật” cuối trang.
              </InfoHint>
            }
            icon={IconCode}
            label="Việc kỹ thuật còn lại"
            // Ô này cũng phải có thanh đo như ba ô trước. Thiếu nó thì đáy ô trống một
            // khoảng bằng đúng chiều cao thanh đo, và hàng bốn ô mất nhịp ngang.
            // Màu cảnh báo chứ không phải màu tốt: thanh càng dài nghĩa là càng còn
            // nhiều việc, đây không phải tiến độ đã hoàn thành.
            meter={{
              ratio: pendingWork / total,
              color: "var(--status-warning)",
              label: `${pendingWork} trên ${total} chỉ số còn việc kỹ thuật phải làm`,
            }}
            unit={`/ ${total}`}
            value={String(pendingWork)}
          />
        </section>

        {/* 2 · Tín hiệu sống + sức khoẻ toàn bộ tập chỉ số.
            Khối thị phần chiếm hai cột: nó có biểu đồ đường và bảng xếp hạng, cần bề
            ngang. Khối sức khoẻ chỉ có hai thanh phân bố nên một cột là đủ. Trước đây
            cả hai cùng chiếm một cột, bỏ trống hẳn cột thứ ba. */}
        <section className="mb-5 grid gap-3 lg:grid-cols-3">
          <SearchPanel
            className="lg:col-span-2"
            data={shareOfSearch}
            kpi={searchKpi}
          />

          <Panel
            bodyClassName="space-y-5 p-4"
            // Không kéo cao bằng khối biểu đồ bên trái: một thẻ rỗng nửa dưới trông
            // như phần chưa làm xong. Để nó cao đúng bằng nội dung của chính nó.
            className="self-start"
            hint={
              <InfoHint label="Về hai thanh phân bố">
                Thanh trên: {total} chỉ số đang ở trạng thái nào so với mức cần đạt.
                Thanh dưới: nguồn dữ liệu nuôi từng chỉ số đang ở mức sẵn sàng nào.
                Mỗi mức có hình riêng, không chỉ khác màu.
              </InfoHint>
            }
            icon={IconGauge}
            title="Sức khoẻ tập chỉ số"
          >
            <DistributionBar
              segments={statusSegments}
              title="Trạng thái so với mục tiêu"
              total={total}
            />
            <DistributionBar
              segments={readinessSegments}
              title="Mức sẵn sàng của nguồn dữ liệu"
              total={total}
            />
          </Panel>
        </section>

        {/* 3 · Bản đồ cascade: đọc từ trái sang phải là đọc chuỗi suy diễn. */}
        <section aria-labelledby="ban-do-muc-tieu" className="mb-5">
          <h2 className="sr-only" id="ban-do-muc-tieu">
            Bản đồ mục tiêu theo ba tầng
          </h2>

          <div className="grid gap-x-3 gap-y-5 lg:grid-cols-3">
            {ObjectiveTierSchema.options.map((tier, tierIndex) => {
              const TierIcon = TIER_ICON[tier];
              const objectives = objectivesOfTier(tier);

              return (
                <div className="flex flex-col gap-3" key={tier}>
                  <div className="flex items-center gap-2">
                    {tierIndex === 0 ? null : (
                      <span className="shrink-0 text-ink-muted">
                        <IconArrowDown className="h-4 w-4 lg:hidden" />
                        <IconArrowRight className="hidden h-4 w-4 lg:block" />
                        <span className="sr-only">Suy ra từ tầng trước</span>
                      </span>
                    )}
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-surface-inset text-ink-secondary">
                      <TierIcon className="h-3.5 w-3.5" />
                    </span>
                    <h3 className="text-[11px] font-semibold tracking-wide text-ink uppercase">
                      {OBJECTIVE_TIER_LABELS[tier]}
                    </h3>
                    <span className="text-[11px] text-ink-muted tabular-nums">
                      {objectives.length}
                    </span>
                    <InfoHint
                      align="left"
                      label={`Vai trò của ${OBJECTIVE_TIER_LABELS[tier].toLowerCase()}`}
                    >
                      {TIER_NOTE[tier]}
                    </InfoHint>
                  </div>

                  {objectives.map((objective) => (
                    <ObjectiveTile
                      key={objective.key}
                      kpis={kpiMap.get(objective.key) ?? []}
                      objective={objective}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </section>

        <WorkQueue kpis={cascade.kpis} />

        <footer className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-hairline pt-4 text-[11px] text-ink-muted">
          <span>
            Nhiệm vụ nghiên cứu khoa học — Học viện Công nghệ Bưu chính Viễn thông
          </span>
          <InfoHint align="left" label="Cách đọc bảng điều khiển">
            <p className="mb-2">
              Đọc theo chiều mũi tên: mục tiêu kinh doanh sinh ra mục tiêu marketing,
              mục tiêu marketing sinh ra mục tiêu truyền thông. Chỉ số nằm trong thẻ
              nào là để đo mục tiêu của chính thẻ đó — không có chỉ số nào đứng ngoài
              chuỗi này.
            </p>
            <p className="mb-2">
              Mỗi dòng chỉ số có hình trạng thái ở đầu dòng, giá trị và mức cần đạt ở
              cuối dòng, hình mức sẵn sàng của nguồn dữ liệu, và nút (i) mở ra diễn
              giải chiều tích cực — tiêu cực cùng xuất xứ số liệu.
            </p>
            <p>
              Cây mục tiêu được kiểm tính liền mạch ở tầng hợp đồng dữ liệu
              (<code>@ptit/shared</code>): chỉ số không gắn mục tiêu, mục tiêu trỏ sai
              tầng, hay có giá trị mà không có nguồn đều bị chặn trước khi hiển thị.
            </p>
          </InfoHint>
        </footer>
      </main>
    </>
  );
}
