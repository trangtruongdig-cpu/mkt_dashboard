import { kpisByObjective } from "@ptit/shared";
import { CascadeDiagram } from "@/components/theory/CascadeDiagram";
import { FrameworkObjectives } from "@/components/theory/FrameworkObjectives";
import { InputMatrix } from "@/components/theory/InputMatrix";
import { QuadrantMatrix } from "@/components/theory/QuadrantMatrix";
import { TheoryFoundations } from "@/components/theory/TheoryFoundations";
import { TheoryProvenanceList } from "@/components/theory/TheoryProvenanceList";
import { InfoHint } from "@/components/ui/InfoHint";
import { getKpiData } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * TRANG KHUNG LÝ THUYẾT.
 *
 * Thứ tự các phần là nội dung, không phải trang trí: nền tảng → khung tổng hợp →
 * chi tiết. Bản đầu tiên của trang này mở thẳng bằng IBMC rồi mới rải tác giả ở cuối,
 * tức là bắt đầu từ giữa — người đọc gặp một cái tên Việt Nam trước khi biết nó đứng
 * trên vai ai.
 *
 * Sơ đồ ba tầng và danh sách xuất xứ đọc từ CÂY MỤC TIÊU THẬT qua API, không viết cứng:
 * nếu viết cứng, trang sẽ còn đúng mãi trong khi cascade đã trôi đi. Ba ma trận và danh
 * sách nền tảng thì viết cứng, vì chúng là lý thuyết chứ không phải dữ liệu.
 */
export default async function TrangKhungLyThuyet() {
  const { source, apiUrl, cascade } = await getKpiData();
  const kpiMap = kpisByObjective(cascade);
  const co_canh_bao = cascade.objectives.filter(
    (o) => o.theory.caveat !== null,
  );
  const nguon = new Set(cascade.kpis.map((k) => k.provenance.label));
  const daCoSo = cascade.kpis.filter((k) => k.value !== null).length;

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6">
      <header>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
          <h1 className="text-lg font-semibold text-ink">
            Khung lý thuyết của bảng điều khiển
          </h1>
          <span className="text-[11px] text-ink-muted">
            {source === "api"
              ? "Đọc từ cây mục tiêu thật"
              : "Cây mục tiêu giả lập"}
            <InfoHint label="Về nguồn của sơ đồ">
              <p>
                Sơ đồ ba tầng và danh sách xuất xứ dựng từ chính cây mục tiêu
                các trang khác đang dùng
                {source === "api" && apiUrl ? `, đọc qua ${apiUrl}` : ""}. Lệch
                giữa trang này và trang Mục tiêu là dấu hiệu cây mục tiêu đã
                trôi.
              </p>
            </InfoHint>
          </span>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-secondary">
          Vì sao bảng điều khiển đo đúng những thứ này. Đọc từ trên xuống: các
          công trình gốc nói gì → khung IBMC ghép chúng lại ra sao → từng mục
          tiêu trên bảng dựa vào khái niệm nào.
        </p>
      </header>

      {/* 1 · NỀN TẢNG. Phải đứng đầu: khung là bản tổng hợp, nên nguồn đi trước bản tổng hợp. */}
      <section className="mt-7">
        <h2 className="text-sm font-semibold text-ink">
          Nền tảng — ai nói gì, nói thế nào
        </h2>
        <p className="mt-1 mb-3 max-w-2xl text-xs leading-snug text-ink-secondary">
          Hai mươi mốt công trình, xếp theo thời gian. Mỗi mục ghi câu họ nói và{" "}
          <strong className="text-ink">
            câu đó sinh ra mục tiêu nào trong IBMC
          </strong>{" "}
          — đọc dòng mũi tên là thấy nền tảng chảy vào đâu. Khối viền vàng là
          chỗ công trình đó phản bác điều khác trong khung, hoặc nêu giới hạn
          phải biết trước khi dùng.
        </p>
        <TheoryFoundations />
      </section>

      {/* 2 · BẢN TỔNG HỢP. Đứng sau nền tảng, và nói rõ phần nào là của nó. */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold text-ink">
          IBMC — bản tổng hợp ghép chúng lại
        </h2>
        <div className="mt-2 rounded-xl border border-hairline bg-surface p-4">
          <p className="text-xs leading-relaxed text-ink-secondary">
            <strong className="text-ink">IBMC</strong> — Integrated Business ·
            Marketing · Communication — do{" "}
            <strong className="text-ink">Trương Đình Trang</strong>, giảng viên
            marketing của Học viện, tổng hợp trong khoá 16 bài &ldquo;Đặt mục
            tiêu cho thương hiệu&rdquo; (2025).{" "}
            <strong className="text-ink">
              Không khái niệm nào ở trên là phát minh của khoá học.
            </strong>{" "}
            Đóng góp của bản tổng hợp nằm ở ba chỗ:
          </p>

          <ol className="mt-3 space-y-2 text-xs leading-snug text-ink-secondary">
            <li className="flex gap-2.5">
              <span className="w-4 shrink-0 font-mono text-ink-muted">1.</span>
              <span>
                <strong className="text-ink">
                  Nối ba truyền thống vốn rời nhau thành một chuỗi bắt buộc.
                </strong>{" "}
                Drucker và PIMS ở tầng kinh doanh, Ehrenberg ở tầng marketing,
                Colley–Aaker–Keller ở tầng truyền thông hiếm khi được dạy như
                một đường thẳng có mũi. Ràng buộc &ldquo;mỗi mục tiêu phải trỏ
                lên tầng trên&rdquo; chính là thứ bảng điều khiển này cài vào
                hợp đồng dữ liệu.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="w-4 shrink-0 font-mono text-ink-muted">2.</span>
              <span>
                <strong className="text-ink">
                  Dịch sang điều kiện Việt Nam và ngôn ngữ của người làm thật.
                </strong>{" "}
                Hệ phân phối, chiết khấu, giá tạp hoá, ngưỡng lợi nhuận theo
                ngành, cải tiến bao bì để giữ phần trăm lợi nhuận — phần này
                không có trong công trình nào ở trên.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="w-4 shrink-0 font-mono text-ink-muted">3.</span>
              <span>
                <strong className="text-ink">Nén thành luật dùng được.</strong>{" "}
                &ldquo;Chỉ thương hiệu dẫn đầu mới nên giáo dục thị
                trường&rdquo;, &ldquo;thông điệp là thứ phủ lên mục tiêu&rdquo;,
                &ldquo;không có mục tiêu thì không có KPI&rdquo; — Kotler cộng
                Ries &amp; Trout, nén tới mức nhớ được.
              </span>
            </li>
          </ol>

          <p className="mt-3 border-t border-hairline pt-3 font-mono text-[11px] leading-relaxed text-ink">
            kinh doanh → marketing → truyền thông → chỉ số
          </p>
          <p className="mt-1 text-[11px] leading-snug text-ink-secondary">
            Muốn đạt số liệu thì phải đổi hành vi; muốn đổi hành vi thì phải đổi
            nhận thức. Hệ quả kỹ thuật: không tồn tại chỉ số mồ côi — ràng buộc
            này kiểm ở tầng hợp đồng dữ liệu, không ở giao diện.
          </p>
        </div>

        {/*
          Chiều ngược lại của danh sách nền tảng. Danh sách trên đi từ tác giả sang mục
          tiêu; bảng này đi từ mục tiêu sang tác giả, và đó mới là chiều kiểm được rằng
          không mục tiêu nào đang đứng mà không có nền.
        */}
        <h3 className="mt-5 text-xs font-semibold text-ink">
          Mười hai mục tiêu con, mười hai cơ sở
        </h3>
        <p className="mt-1 mb-2 max-w-2xl text-xs leading-snug text-ink-secondary">
          Bảng này đọc ngược danh sách trên: từ mục tiêu về tác giả. Quy tắc giữ
          nó đúng — thêm một mục tiêu vào khung thì phải thêm một dòng kèm cơ
          sở; không nêu được cơ sở nghĩa là mục tiêu đó đặt ra vì{" "}
          <em>có dữ liệu</em>, không phải vì <em>có lý do</em>.
        </p>
        <FrameworkObjectives />
        <p className="mt-2 max-w-2xl text-[11px] leading-snug text-ink-muted">
          Khung gốc có 12 mục tiêu con. Cây mục tiêu của Học viện ở dưới có 13,
          vì tách Lựa chọn và Trung thành thành hai — với đào tạo, được chọn lúc
          xét tuyển và giữ chân sau khi nhập học cách nhau 4–5 năm và dùng nguồn
          dữ liệu khác nhau. Đây là chỗ cố ý đi khác bài giảng, không phải sai
          sót.
        </p>
      </section>

      {/* 3 · CHI TIẾT — từ đây trở xuống là cây mục tiêu thật của Học viện. */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold text-ink">
          Chuỗi suy diễn ba tầng
        </h2>
        <p className="mt-1 mb-3 text-xs leading-snug text-ink-secondary">
          Cây mục tiêu đang chạy, đọc xuống là đi từ con số tới nguyên nhân của
          con số.
        </p>
        <CascadeDiagram
          kpisByObjectiveKey={kpiMap}
          objectives={[...cascade.objectives]}
        />
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-ink">
          Ba quy tắc ra quyết định
        </h2>
        <p className="mt-1 mb-3 text-xs leading-snug text-ink-secondary">
          Chỗ khung biến thành quyết định. Vị trí hiện tại của Học viện ghi
          trong phần dẫn của từng ma trận.
        </p>

        <div className="space-y-4">
          <QuadrantMatrix
            cells={[
              {
                verdict: "Tăng trưởng khoẻ mạnh",
                body: "Được cả doanh số lẫn thị phần — ô duy nhất đáng ăn mừng.",
                tone: "good",
              },
              {
                verdict: "Được số nhưng MẤT thị phần",
                body: "Ô nguy hiểm nhất: số tuyệt đối vẫn đẹp, mọi chỉ số vẫn xanh, nhưng đối thủ tăng nhanh hơn. Chỉ số growth_vs_category_gap sinh ra để chặn đúng ô này.",
                tone: "warning",
              },
              {
                verdict: "Mất số nhưng vẫn tăng thị phần",
                body: "Tăng trưởng âm, nhưng cả lĩnh vực còn giảm sâu hơn.",
                tone: "neutral",
              },
              {
                verdict: "Mất cả số lẫn thị phần",
                body: "Trường hợp tệ nhất.",
                tone: "bad",
              },
            ]}
            colLabels={["Tăng nhanh hơn lĩnh vực", "Tăng chậm hơn lĩnh vực"]}
            intro="Tăng trưởng của một thương hiệu chỉ có nghĩa khi đặt cạnh tăng trưởng của ngành. Học viện CHƯA xác định được mình ở ô nào — tăng trưởng của lĩnh vực chưa thu thập được."
            lesson="2.3"
            rowLabels={["Nhập học tăng", "Nhập học giảm"]}
            title="Tăng trưởng của Học viện so với lĩnh vực"
          />

          <QuadrantMatrix
            cells={[
              {
                verdict: "Ngành khoẻ mạnh",
                body: "Nhiều người tham gia hơn và trả cao hơn. Lĩnh vực đào tạo công nghệ thông tin đang ở đây.",
                tone: "good",
              },
              {
                verdict: "Nhu cầu còn, giá trị giảm",
                body: "Ngành mất dần tầm quan trọng, hoặc công nghệ đã phổ thông hoá nên rẻ đi.",
                tone: "warning",
              },
              {
                verdict: "Bão hoà, đang nâng cấp giá",
                body: "Nhu cầu không tăng nhưng giá trị tăng — nâng người đang dùng lên hạng cao hơn.",
                tone: "neutral",
              },
              {
                verdict: "Ngành suy",
                body: "Mất cả nhu cầu lẫn giá trị, thường vì bị thay thế.",
                tone: "bad",
              },
            ]}
            colLabels={["Giá trị tăng", "Giá trị giảm"]}
            intro="Trước khi hỏi mình làm tốt hay không, hỏi sân mình đang chơi có đáng chơi không."
            lesson="2.4"
            rowLabels={["Sản lượng tăng", "Sản lượng giảm"]}
            title="Sức khoẻ của ngành hàng"
          />

          <QuadrantMatrix
            cells={[
              {
                verdict: "Cùng nhau xây ngành hàng",
                body: "Chưa ai chiếm lĩnh thì giành giật miếng bánh nhỏ là vô nghĩa.",
                tone: "neutral",
              },
              {
                verdict: "Thâm nhập bằng lợi ích KHÁC BIỆT",
                body: "Dùng chung thông điệp với đối thủ dẫn đầu thì người vào ngành sẽ chọn nhãn nổi nhất — tức là đối thủ hưởng lợi.",
                tone: "neutral",
              },
              {
                verdict: "Dẫn đầu: chọn gì cũng được",
                body: "Việc quan trọng nhất khi dẫn đầu là đừng làm gì sai và phòng thủ.",
                tone: "good",
              },
              {
                verdict: "Đi lấy thị phần, ĐỪNG giáo dục thị trường",
                body: "Đứng thứ ba trở xuống mà giáo dục thị trường là tăng trưởng hộ nhãn dẫn đầu, vì người ta chỉ nhớ nhãn đầu tiên. ĐÂY LÀ Ô CỦA HỌC VIỆN.",
                tone: "warning",
              },
            ]}
            colLabels={["Cạnh tranh thấp", "Cạnh tranh cao"]}
            intro="Chọn sai nguồn tăng trưởng là sai chiến lược, không phải sai số liệu. Học viện ở ô dưới–phải: lĩnh vực đã trưởng thành, cạnh tranh cao, và Học viện không dẫn đầu."
            lesson="3.4"
            rowLabels={["Thâm nhập thấp", "Thâm nhập cao"]}
            title="Chọn nguồn tăng trưởng nào"
          />
        </div>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="text-sm font-semibold text-ink">
            Từng mục tiêu dựa vào khái niệm nào
          </h2>
          <span className="text-[11px] text-ink-muted">
            {cascade.objectives.length} mục tiêu · {co_canh_bao.length} có lưu ý
            khi dùng
          </span>
        </div>
        <p className="mt-1 mb-3 max-w-2xl text-xs leading-snug text-ink-secondary">
          Trang Dữ liệu trả lời &ldquo;con số này ở đâu ra&rdquo;. Khối này trả
          lời câu còn lại:{" "}
          <strong className="text-ink">căn cứ nào để chọn đo thứ này</strong>.
          Trường xuất xứ là bắt buộc, nên mục tiêu mới không nêu được căn cứ sẽ
          bị chặn ngay khi dựng.
        </p>
        <TheoryProvenanceList objectives={[...cascade.objectives]} />
      </section>

      {/*
        Khép vòng: từ lý thuyết xuống tới đầu vào thật. Đặt cuối cùng vì chỉ đọc được
        sau khi đã biết mục tiêu nào là mục tiêu gì.
      */}
      <section className="mt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <h2 className="text-sm font-semibold text-ink">
            Đầu vào nào nuôi mục tiêu nào
          </h2>
          <span className="text-[11px] text-ink-muted">
            {nguon.size} nguồn · {cascade.kpis.length} chỉ số · {daCoSo} đã có
            số
          </span>
        </div>
        <p className="mt-1 mb-3 max-w-2xl text-xs leading-snug text-ink-secondary">
          Mỗi nguồn dữ liệu, các chỉ số nó cấp, mục tiêu chúng nuôi, mức cần đạt
          — và <strong className="text-ink">đối thủ đang ở đâu</strong>. Câu
          cuối là tính chất của nguồn chứ không của chỉ số: một nguồn hoặc phủ
          được cả nhóm sáu trường đối sánh, hoặc không. Nguồn so được với đối
          thủ xếp lên trước.
        </p>
        <InputMatrix cascade={cascade} />
        <p className="mt-2 max-w-2xl text-[11px] leading-snug text-ink-muted">
          Thị phần, tăng trưởng và mọi phép so sánh chỉ có nghĩa khi mẫu số đủ.
          Hiện phần lớn nguồn kinh doanh mới phủ một phần nhóm đối sánh — nút
          thắt lớn nhất của dự án. Tài liệu nguồn đều buộc công khai nên không
          phải xin phép ai, nhưng <em>công khai</em> không đồng nghĩa với{" "}
          <em>máy đọc được</em>: học phí hiện có số ở 3 trên 7 dòng đối sánh,
          bốn dòng còn lại thiếu vì đề án là ảnh scan hoặc bảng số do JavaScript
          dựng. Phần đó phải nhập tay kèm đường dẫn nguồn — là giới hạn của
          nguồn, không phải việc chưa làm.
        </p>
      </section>

      <section className="mt-8 rounded-xl border border-hairline bg-surface-inset p-4">
        <h2 className="text-sm font-semibold text-ink">Lần về nguồn</h2>
        <p className="mt-1 text-xs leading-relaxed text-ink-secondary">
          Bản đầy đủ nằm trong{" "}
          <code className="font-mono text-ink">docs/ly-thuyet/</code> của mã
          nguồn — không phục vụ qua web vì là tài liệu nghiệm thu, đi kèm repo:
          toàn văn khung, phép ánh xạ sang Học viện, phả hệ từng khái niệm về
          tác giả gốc, bảng đầu vào – đầu ra, và bản gỡ băng cả 16 bài.
        </p>
        <p className="mt-2 text-[11px] text-ink-muted">
          Khoá học gốc:{" "}
          <a
            className="text-ink-secondary underline underline-offset-2 hover:text-ink"
            href="https://www.youtube.com/playlist?list=PLoA7J_Cpj57VhPi3Up6GAFSOooV5oP8Rj"
            rel="noreferrer noopener"
            target="_blank"
          >
            IBMC — Đặt mục tiêu cho thương hiệu (V2025)
          </a>
        </p>
      </section>
    </main>
  );
}
