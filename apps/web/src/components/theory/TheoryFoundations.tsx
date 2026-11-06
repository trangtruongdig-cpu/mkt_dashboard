interface Foundation {
  year: string;
  who: string;
  work: string;
  /** Họ nói gì — MỘT câu, càng gần phát biểu gốc càng tốt. */
  claim: string;
  /**
   * Câu đó sinh ra MỤC TIÊU NÀO trong IBMC.
   *
   * Đây là trường quan trọng nhất của cả khối. Thiếu nó thì danh sách chỉ là một bảng
   * tên tuổi: người đọc biết ai nói gì nhưng không biết vì sao nó nằm trong bảng điều
   * khiển này.
   */
  produces: string;
  /** Chỗ công trình này phản bác điều khác trong khung, hoặc giới hạn phải biết. */
  tension?: string;
}

/**
 * NỀN TẢNG — AI NÓI GÌ, VÀ CÂU ĐÓ SINH RA MỤC TIÊU NÀO.
 *
 * Xếp theo thời gian chứ không theo tầng, vì thứ cần thấy trước là một dòng chảy: từ
 * 1931 tới 2020, mỗi công trình đặt thêm một mục tiêu vào khung, và IBMC năm 2025 ghép
 * chúng lại thành một chuỗi.
 *
 * Mỗi mục đúng một câu nói và một dòng hệ quả. Ai muốn sâu hơn thì có
 * `docs/ly-thuyet/ibmc-xuat-xu-ly-thuyet.md`.
 */
const FOUNDATIONS: readonly Foundation[] = [
  {
    year: "1931",
    who: "Neil McElroy, Procter & Gamble",
    work: "Bản ghi nhớ “Brand Men”",
    claim:
      "Mỗi nhãn hàng phải có một đội riêng, vận hành như một doanh nghiệp riêng, chịu trách nhiệm tới cả kết quả bán hàng.",
    produces:
      "Doanh số và Lợi nhuận. Có người sở hữu lời lỗ của một nhãn thì hai mục tiêu này mới tồn tại.",
  },
  {
    year: "1954",
    who: "Peter Drucker",
    work: "The Practice of Management",
    claim:
      "Doanh nghiệp phải đặt mục tiêu ở nhiều lĩnh vực then chốt, trong đó có VỊ THẾ THỊ TRƯỜNG, chứ không chỉ ở lợi nhuận.",
    produces:
      "Thị phần. Đây là chỗ thị phần thành một mục tiêu phải đặt, không còn là con số để ngắm.",
  },
  {
    year: "1957",
    who: "Igor Ansoff",
    work: "Strategies for Diversification, HBR",
    claim:
      "Tăng trưởng chỉ có bốn hướng: thâm nhập thị trường, phát triển thị trường, phát triển sản phẩm, đa dạng hoá.",
    produces:
      "Tăng trưởng. Và ô đầu tiên của ông — thâm nhập thị trường — chính là mục tiêu Thâm nhập.",
  },
  {
    year: "1961",
    who: "Robert Lavidge & Gary Steiner",
    work: "Journal of Marketing",
    claim:
      "Doanh số tức thời là thước đo KHÔNG đầy đủ của quảng cáo; phải đo mức dịch chuyển của người tiêu dùng qua các bậc nhận thức.",
    produces:
      "Nhận biết. Và lý do cả tầng truyền thông phải có mục tiêu riêng thay vì bị đo bằng doanh thu.",
  },
  {
    year: "1961",
    who: "Russell Colley",
    work: "DAGMAR, Association of National Advertisers",
    claim:
      "Mục tiêu quảng cáo phải là mục tiêu TRUYỀN THÔNG, phát biểu đo được, có mốc gốc và công chúng cụ thể.",
    produces:
      "Khuôn của cả tầng truyền thông: bốn bậc biết → hiểu → tin → hành động là chỗ Nhận biết và Thuộc tính thương hiệu ra đời.",
    tension:
      "Hệ quả: không gán chỉ tiêu doanh số cho một chiến dịch truyền thông — quảng cáo chỉ là một phần của marketing mix.",
  },
  {
    year: "1962",
    who: "Everett Rogers",
    work: "Diffusion of Innovations",
    claim:
      "Cái mới lan ra theo đường cong S, qua nhóm tiếp nhận sớm rồi tới nhóm muộn.",
    produces:
      "Thâm nhập. Giải thích vì sao ngành mới thì thâm nhập thấp là quy luật, và vì sao lúc đó đòn đúng là kéo thêm người dùng mới.",
  },
  {
    year: "1967",
    who: "Philip Kotler",
    work: "Marketing Management (nhiều lần tái bản)",
    claim:
      "Nhãn dẫn đầu mở rộng tổng cầu bằng người dùng mới, công dụng mới và dùng nhiều hơn; đồng thời phải phòng thủ phần của mình.",
    produces:
      "Tần suất và Lượng tiêu dùng. Ba đòn mở rộng cầu của ông chính là ba nguồn tăng trưởng, kể cả Thâm nhập.",
  },
  {
    year: "1968",
    who: "Bruce Henderson, Boston Consulting Group",
    work: "Ma trận tăng trưởng – thị phần",
    claim:
      "Xếp danh mục trên hai trục: tốc độ tăng trưởng của NGÀNH, và thị phần tương đối so với đối thủ.",
    produces:
      "Tăng trưởng. Hai trục này chính là ma trận “tăng trưởng của Học viện so với lĩnh vực” ở phần dưới trang.",
  },
  {
    year: "1972",
    who: "Andrew Ehrenberg",
    work: "Repeat-Buying: Theory and Applications",
    claim:
      "Doanh số của một thương hiệu phân rã thành: bao nhiêu người mua × mua mấy lần × mỗi lần bao nhiêu × chiếm bao nhiêu phần trong giỏ của họ.",
    produces:
      "CẢ NĂM nguồn tăng trưởng của tầng marketing: Thâm nhập · Tần suất · Lượng tiêu dùng · Lựa chọn · Trung thành.",
    tension:
      "“Trung thành” ở đây là thị phần trong giỏ hàng, khác hẳn thị phần bán lẻ — hai con số không được trộn.",
  },
  {
    year: "1975",
    who: "Buzzell, Gale & Sultan",
    work: "Market Share — A Key to Profitability, HBR (dự án PIMS)",
    claim: "Thị phần cao đi cùng lợi nhuận cao.",
    produces:
      "Thị phần. Đây là bằng chứng thực nghiệm khiến thị phần đáng làm mục tiêu, chứ không chỉ là chỉ số theo dõi.",
    tension:
      "Bị Wernerfelt và Rumelt & Wensley thách thức — không được đọc như quan hệ nhân quả đã chứng minh.",
  },
  {
    year: "1980",
    who: "Michael Porter",
    work: "Competitive Strategy; Competitive Advantage (1985)",
    claim:
      "Cấu trúc ngành quyết định mức lợi nhuận khả dĩ; chiến lược là chọn một vị thế độc nhất, và bản chất của nó là chọn những gì KHÔNG làm.",
    produces:
      "KHÔNG sinh ra mục tiêu nào. Ông quyết định có nên chơi ở sân này không, và cho trục “mức độ cạnh tranh” khi chọn nguồn tăng trưởng.",
    tension:
      "Vì vậy chuỗi mục tiêu không bắt đầu từ Porter mà từ Drucker: Porter là nhà lý thuyết của vị thế, không phải của chỉ tiêu.",
  },
  {
    year: "1986",
    who: "Al Ries & Jack Trout",
    work: "Marketing Warfare",
    claim:
      "Thế đánh phải khớp vị thế: chỉ thương hiệu dẫn đầu mới nên phòng thủ, kẻ đi sau phải đánh sườn hoặc đánh du kích.",
    produces:
      "Lựa chọn. Kéo người dùng của đối thủ sang mình, và quy tắc ai được phép giáo dục thị trường.",
  },
  {
    year: "1987",
    who: "Gordon Brown, Millward Brown",
    work: "Hệ Link — kiểm quảng cáo trước khi phát sóng",
    claim:
      "Quảng cáo phải đạt điểm thuyết phục trong top 30% của ngành hàng, cộng ba thành phần thích thú – cuốn hút – nhớ thương hiệu, trước khi được phát.",
    produces: "Chất lượng sáng tạo. Toàn bộ mục tiêu này là hệ chỉ số của họ.",
    tension:
      "Cần ngân sách kiểm trước mà nhiệm vụ không có; ở đây chỉ còn tín hiệu hành vi trên nội dung đã phát.",
  },
  {
    year: "1990",
    who: "John Philip Jones",
    work: "Ad Spending: Maintaining Market Share, HBR",
    claim:
      "Thương hiệu có tỷ trọng tiếng nói cao hơn thị phần của mình thì tăng trưởng.",
    produces:
      "Hiệu quả kênh. Cặp chỉ số tỷ trọng tiếng nói đặt cạnh tỷ trọng chi tiêu.",
  },
  {
    year: "1991",
    who: "David Aaker",
    work: "Managing Brand Equity",
    claim:
      "Nhận biết có thứ bậc: nhận ra khi được nhắc → nhớ tự nhiên → nhớ đầu tiên.",
    produces: "Nhận biết. Ba mức này là thang đo của mục tiêu đó.",
    tension:
      "Cả ba chỉ đo được bằng khảo sát; dữ liệu tìm kiếm là proxy hành vi, không phải mức nhớ đầu tiên.",
  },
  {
    year: "1993",
    who: "Kevin Lane Keller",
    work: "Customer-Based Brand Equity, Journal of Marketing",
    claim:
      "Thương hiệu cần điểm TƯƠNG ĐỒNG để được xem là cùng loại, và điểm KHÁC BIỆT để được chọn.",
    produces:
      "Thuộc tính thương hiệu. Và quy tắc mục tiêu thuộc tính luôn là một cặp: tăng cái đang nhắm, giữ cái đang mạnh.",
  },
  {
    year: "1993",
    who: "Don Schultz",
    work: "Integrated Marketing Communications",
    claim: "Mọi điểm chạm với người tiêu dùng phải nói cùng một thông điệp.",
    produces:
      "Chữ “I” của IBMC — tích hợp. Không phải một mục tiêu, mà là điều kiện để ba tầng không nói lệch nhau.",
  },
  {
    year: "2003",
    who: "Silverstein & Fiske",
    work: "Trading Up",
    claim:
      "Người tiêu dùng sẵn sàng trả cao hơn cho hạng trên, ngay trong ngành đã bão hoà.",
    produces:
      "Lượng tiêu dùng, nửa giá trị: nâng người đang dùng lên hệ đắt hơn thay vì bán cho thêm người.",
  },
  {
    year: "2010",
    who: "Byron Sharp",
    work: "How Brands Grow (Ehrenberg-Bass)",
    claim:
      "Thương hiệu lớn lên chủ yếu nhờ CÓ THÊM NGƯỜI MUA, không nhờ người cũ mua nhiều hơn.",
    produces:
      "Thâm nhập — và đặt lại trọng số cho cả năm nguồn tăng trưởng của Ehrenberg.",
    tension:
      "Phản bác đòn tăng Tần suất và Trung thành ở ngành bão hoà: thâm nhập dao động mạnh giữa các nhãn, tần suất thì gần như không.",
  },
  {
    year: "2013",
    who: "Les Binet & Peter Field",
    work: "The Long and the Short of It, IPA",
    claim:
      "Mỗi 10 điểm tiếng nói vượt trên thị phần ứng với khoảng +0,5 điểm thị phần mỗi năm.",
    produces:
      "Hiệu quả kênh. Lượng hoá bằng số quan hệ mà Jones phát biểu định tính năm 1990.",
  },
  {
    year: "2020",
    who: "Les Binet",
    work: "Share of search, IPA",
    claim:
      "Tỷ trọng tìm kiếm đi cùng thị phần và báo trước thay đổi thị phần vài tháng, có khi tới một năm.",
    produces:
      "Nhận biết. Đây là căn cứ cho chỉ số thị phần tìm kiếm trên bảng điều khiển.",
    tension:
      "Bằng chứng mới từ ba ngành hàng; chính tác giả gọi đây là chỉ số nhanh và rẻ, không hoàn hảo.",
  },
];

export function TheoryFoundations() {
  return (
    <ol className="space-y-1.5">
      {FOUNDATIONS.map((f) => (
        <li
          key={`${f.year}-${f.who}`}
          className="flex gap-3 rounded-lg border border-hairline bg-surface px-3 py-2.5"
        >
          <span className="w-10 shrink-0 pt-0.5 font-mono text-[11px] text-ink-muted">
            {f.year}
          </span>

          <div className="min-w-0">
            <p className="text-xs leading-snug text-ink">
              <span className="font-semibold">{f.who}</span>
              <span className="text-ink-muted"> · {f.work}</span>
            </p>
            <p className="mt-1 text-[13px] leading-snug text-ink-secondary">
              {f.claim}
            </p>

            {/*
              Dòng này là mắt xích giữa nền tảng và khung. Để nó ở màu chữ chính chứ
              không phải màu phụ: người đọc lướt trang sẽ đọc năm, tên, rồi mục tiêu —
              ba thứ đó đủ để hiểu vì sao công trình này có mặt ở đây.
            */}
            <p className="mt-1.5 text-[11px] leading-snug text-ink">
              <span aria-hidden="true" className="mr-1 text-ink-muted">
                →
              </span>
              <span className="text-ink-muted">Mục tiêu trong IBMC: </span>
              {f.produces}
            </p>

            {f.tension ? (
              <p className="mt-1.5 border-l-[3px] border-l-status-warning pl-2 text-[11px] leading-snug text-ink-muted">
                {f.tension}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
