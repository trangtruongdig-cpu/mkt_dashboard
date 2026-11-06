import {
  BENCHMARK_COVERAGE_LABELS,
  ourRank,
  rankedCount,
  type BenchmarkDimension,
} from "@ptit/shared";
import { BenchmarkRankChart } from "@/components/charts/BenchmarkRankChart";
import { InfoHint } from "@/components/ui/InfoHint";
import { getBenchmark } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * TRANG ĐỐI SÁNH — Học viện đứng ở đâu giữa nhóm trường cạnh tranh.
 *
 * Vì sao cần một trang riêng: mọi trang khác trả lời "chỉ số của TA so với mục tiêu
 * của TA". Khung IBMC đòi thêm một câu mà các trang đó không trả lời được — bài 2.2:
 * bán hết hàng không phải là thoả mãn mục tiêu nếu phần của mình trong thị trường
 * đang nhỏ lại.
 *
 * Nguyên tắc trình bày, lấy từ skill dataviz: câu hỏi ở đây không phải "phân biệt sáu
 * trường" mà là "ta ở đâu giữa họ", nên hình thức đúng là *emphasis* — một thanh mang
 * màu nhấn, phần còn lại lùi về bối cảnh. Không cấp sáu màu phân loại.
 */
export default async function TrangDoiSanh() {
  const { source, apiUrl, benchmark } = await getBenchmark();

  const xepDuoc = benchmark.dimensions.filter((d) => ourRank(d) !== null);
  const dauBang = xepDuoc.filter((d) => ourRank(d) === 1).length;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6">
      <header>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h1 className="text-lg font-semibold text-ink">
            Học viện đứng ở đâu so với đối thủ
          </h1>
          <span className="text-[11px] text-ink-muted">
            {source === "api" ? "Số liệu từ kho" : "Số liệu giả lập"}
            <InfoHint label="Về nguồn số liệu của bảng đối sánh">
              <p className="mb-2">
                {source === "api" && apiUrl
                  ? `Đọc qua ${apiUrl}. Giá trị của từng trường lấy thẳng từ các bảng mart theo cột mã trường.`
                  : "Chưa gọi được API nên đang hiển thị bộ số giả lập. Phần THẬT ở đây là cấu trúc: chiều nào phủ đủ nhóm, chiều nào mới một phần, trường nào chưa có số."}
              </p>
              <p className="text-[11px] text-ink-muted">
                Nhóm đối sánh cố định sáu trường để mọi tỷ trọng cùng một mẫu
                số.
              </p>
            </InfoHint>
          </span>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-secondary">
          Bán hết hàng không phải là thoả mãn mục tiêu nếu phần của mình trong
          thị trường đang nhỏ lại. Trang này trả lời câu đó: ở mỗi chiều đo
          được, Học viện xếp thứ mấy trong nhóm sáu trường kỹ thuật – công nghệ
          cạnh tranh trực tiếp.
        </p>
      </header>

      {/* Hàng tóm tắt: ba con số đủ để biết có cần đọc tiếp không. */}
      <section
        aria-label="Tóm tắt vị thế"
        className="mt-5 grid grid-cols-3 gap-3"
      >
        <SummaryCell
          label="Chiều xếp hạng được"
          sub={`trên ${benchmark.dimensions.length} chiều`}
          value={String(xepDuoc.length)}
        />
        <SummaryCell
          label="Chiều đang dẫn đầu"
          sub={
            xepDuoc.length === 0
              ? "chưa xếp được"
              : `trên ${xepDuoc.length} chiều`
          }
          value={String(dauBang)}
        />
        <SummaryCell
          label="Hạng tốt nhất"
          sub={
            xepDuoc.length === 0
              ? "chưa có"
              : (xepDuoc
                  .slice()
                  .sort((a, b) => (ourRank(a) ?? 99) - (ourRank(b) ?? 99))[0]
                  ?.label ?? "")
          }
          value={
            xepDuoc.length === 0
              ? "—"
              : String(Math.min(...xepDuoc.map((d) => ourRank(d) ?? 99)))
          }
        />
      </section>

      <div className="mt-5 space-y-4">
        {benchmark.dimensions.map((dimension) => (
          <DimensionCard dimension={dimension} key={dimension.key} />
        ))}
      </div>

      <p className="mt-5 max-w-2xl text-[11px] leading-snug text-ink-muted">
        Thiếu một chiều không có nghĩa Học viện yếu ở chiều đó — nghĩa là chưa
        đo được cả nhóm. Mức phủ của từng nguồn và việc còn phải làm để lấp, xem
        trang Lý thuyết, mục &ldquo;Đầu vào nào nuôi mục tiêu nào&rdquo;.
      </p>
    </main>
  );
}

function SummaryCell({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-hairline bg-surface px-3 py-2.5">
      <p className="text-[11px] leading-snug text-ink-muted">{label}</p>
      <p className="mt-1 text-2xl leading-none font-semibold text-ink">
        {value}
      </p>
      <p className="mt-1 truncate text-[11px] text-ink-muted">{sub}</p>
    </div>
  );
}

function DimensionCard({ dimension }: { dimension: BenchmarkDimension }) {
  const hang = ourRank(dimension);
  const soTruong = rankedCount(dimension);

  return (
    <section className="rounded-xl border border-hairline bg-surface">
      <header className="border-b border-hairline px-4 py-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="text-sm font-semibold text-ink">{dimension.label}</h2>
          <span className="text-[11px] whitespace-nowrap text-ink-muted">
            {dimension.periodLabel}
          </span>
        </div>

        <p className="mt-1 text-xs leading-snug text-ink-secondary">
          {hang === null ? (
            <>
              <span className="font-medium text-ink">
                Chưa xếp hạng được.
              </span>{" "}
            </>
          ) : (
            <>
              <span className="font-medium text-ink">
                Học viện hạng {hang} trên {soTruong} trường có số.
              </span>{" "}
            </>
          )}
          <span className="text-ink-muted">
            {BENCHMARK_COVERAGE_LABELS[dimension.coverage]} · {dimension.note}
          </span>
        </p>
      </header>

      <div className="px-4 py-3">
        {/*
          Không vẽ biểu đồ khi chưa trường nào có số. Một khung biểu đồ trống đọc ra là
          "mọi trường đều bằng 0", trong khi sự thật là chưa đo được trường nào — hai
          điều đó ngược hẳn nhau. Khi ấy chỉ còn danh sách trường và câu giải thích.
        */}
        {soTruong === 0 ? (
          <p className="text-[11px] leading-snug text-ink-muted">
            Chưa trường nào có số ở chiều này:{" "}
            {dimension.rows.map((r) => r.brand.shortLabel).join(" · ")}.
          </p>
        ) : (
          <BenchmarkRankChart dimension={dimension} />
        )}
      </div>
    </section>
  );
}
