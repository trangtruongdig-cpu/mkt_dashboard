/** Tầng mà công trình này nuôi — để người đọc thấy nền tảng chảy vào đâu. */
type Feeds = "B" | "M" | "C" | "—";

interface Foundation {
  year: string;
  who: string;
  work: string;
  /** Họ nói gì — MỘT câu, càng gần phát biểu gốc càng tốt. */
  claim: string;
  /** Chỗ công trình này phản bác bài giảng, hoặc giới hạn phải biết. */
  tension?: string;
  feeds: Feeds;
}

/**
 * NỀN TẢNG — AI NÓI GÌ, NÓI NHƯ THẾ NÀO.
 *
 * Xếp theo thời gian chứ không theo tầng, vì thứ cần thấy trước tiên là một dòng chảy:
 * từ 1931 tới 2020, mỗi công trình trả lời một mảnh, và IBMC năm 2025 ghép chúng lại.
 * Đọc theo tầng thì mất đúng cái đó.
 *
 * Mỗi mục đúng MỘT câu. Danh sách này là nền, không phải bài giảng — ai muốn sâu hơn
 * thì có `docs/ly-thuyet/ibmc-xuat-xu-ly-thuyet.md`.
 */
const FOUNDATIONS: readonly Foundation[] = [
  {
    year: "1931",
    who: "Neil McElroy, Procter & Gamble",
    work: "Bản ghi nhớ “Brand Men”",
    claim:
      "Mỗi nhãn hàng phải có một đội riêng, vận hành như một doanh nghiệp riêng, chịu trách nhiệm tới cả kết quả bán hàng.",
    feeds: "B",
  },
  {
    year: "1954",
    who: "Peter Drucker",
    work: "The Practice of Management",
    claim:
      "Doanh nghiệp phải đặt mục tiêu ở nhiều lĩnh vực then chốt — trong đó có vị thế thị trường — chứ không chỉ ở lợi nhuận.",
    feeds: "B",
  },
  {
    year: "1957",
    who: "Igor Ansoff",
    work: "Strategies for Diversification, HBR",
    claim:
      "Tăng trưởng chỉ có bốn hướng: thâm nhập thị trường, phát triển thị trường, phát triển sản phẩm, đa dạng hoá.",
    feeds: "B",
  },
  {
    year: "1961",
    who: "Robert Lavidge & Gary Steiner",
    work: "Journal of Marketing",
    claim:
      "Doanh số tức thời là thước đo KHÔNG đầy đủ của quảng cáo; phải đo mức dịch chuyển của người tiêu dùng qua các bậc nhận thức.",
    feeds: "C",
  },
  {
    year: "1961",
    who: "Russell Colley",
    work: "DAGMAR, Association of National Advertisers",
    claim:
      "Mục tiêu quảng cáo phải là mục tiêu TRUYỀN THÔNG, phát biểu đo được, có mốc gốc và công chúng cụ thể.",
    tension:
      "Hệ quả: không gán chỉ tiêu doanh số cho một chiến dịch truyền thông — quảng cáo chỉ là một phần của marketing mix.",
    feeds: "C",
  },
  {
    year: "1962",
    who: "Everett Rogers",
    work: "Diffusion of Innovations",
    claim:
      "Cái mới lan ra theo đường cong S — ngành mới thì mức thâm nhập thấp là quy luật, không phải nhận xét.",
    feeds: "M",
  },
  {
    year: "1967",
    who: "Philip Kotler",
    work: "Marketing Management (nhiều lần tái bản)",
    claim:
      "Nhãn dẫn đầu mở rộng tổng cầu bằng người dùng mới, công dụng mới và dùng nhiều hơn — đồng thời phải phòng thủ phần của mình.",
    feeds: "M",
  },
  {
    year: "1972",
    who: "Andrew Ehrenberg",
    work: "Repeat-Buying: Theory and Applications",
    claim:
      "Doanh số của một thương hiệu phân rã thành: bao nhiêu người mua × mua mấy lần × mỗi lần bao nhiêu.",
    tension:
      "Đây chính là bốn nguồn tăng trưởng của tầng marketing, và “trung thành” trong khung là thị phần trong giỏ hàng, khác thị phần bán lẻ.",
    feeds: "M",
  },
  {
    year: "1975",
    who: "Buzzell, Gale & Sultan",
    work: "Market Share — A Key to Profitability, HBR (dự án PIMS)",
    claim: "Thị phần cao đi cùng lợi nhuận cao.",
    tension:
      "Bị Wernerfelt và Rumelt & Wensley thách thức — không được đọc như quan hệ nhân quả đã chứng minh.",
    feeds: "B",
  },
  {
    year: "1980",
    who: "Michael Porter",
    work: "Competitive Strategy; Competitive Advantage (1985)",
    claim:
      "Cấu trúc ngành quyết định mức lợi nhuận khả dĩ; chiến lược là chọn một vị thế độc nhất, và bản chất của nó là chọn những gì KHÔNG làm.",
    tension:
      "Porter trả lời “sân này có đáng chơi không”, không trả lời “đặt chỉ tiêu bao nhiêu” — nên chuỗi mục tiêu không bắt đầu từ ông mà từ Drucker.",
    feeds: "B",
  },
  {
    year: "1986",
    who: "Al Ries & Jack Trout",
    work: "Marketing Warfare",
    claim:
      "Thế đánh phải khớp vị thế: chỉ thương hiệu dẫn đầu mới nên phòng thủ, kẻ đi sau phải đánh sườn hoặc đánh du kích.",
    feeds: "M",
  },
  {
    year: "1990",
    who: "John Philip Jones",
    work: "Ad Spending: Maintaining Market Share, HBR",
    claim:
      "Thương hiệu có tỷ trọng tiếng nói cao hơn thị phần của mình thì tăng trưởng.",
    feeds: "C",
  },
  {
    year: "1991",
    who: "David Aaker",
    work: "Managing Brand Equity",
    claim:
      "Nhận biết có thứ bậc: nhận ra khi được nhắc → nhớ tự nhiên → nhớ đầu tiên.",
    tension:
      "Cả ba mức chỉ đo được bằng khảo sát; dữ liệu tìm kiếm là proxy hành vi, không phải mức nhớ đầu tiên.",
    feeds: "C",
  },
  {
    year: "1993",
    who: "Kevin Lane Keller",
    work: "Customer-Based Brand Equity, Journal of Marketing",
    claim:
      "Thương hiệu cần điểm TƯƠNG ĐỒNG để được xem là cùng loại, và điểm KHÁC BIỆT để được chọn.",
    tension:
      "Hệ quả: mục tiêu thuộc tính luôn là một cặp — tăng cái đang nhắm trong khi giữ cái đang mạnh.",
    feeds: "C",
  },
  {
    year: "1993",
    who: "Don Schultz",
    work: "Integrated Marketing Communications",
    claim: "Mọi điểm chạm với người tiêu dùng phải nói cùng một thông điệp.",
    tension: "Đây là chữ “I” mà IBMC mở rộng ra cả kinh doanh và marketing.",
    feeds: "C",
  },
  {
    year: "2010",
    who: "Byron Sharp",
    work: "How Brands Grow (Ehrenberg-Bass)",
    claim:
      "Thương hiệu lớn lên chủ yếu nhờ CÓ THÊM NGƯỜI MUA, không nhờ người cũ mua nhiều hơn.",
    tension:
      "Phản bác đòn tăng tần suất và trung thành ở ngành bão hoà: thâm nhập dao động mạnh giữa các nhãn, tần suất thì gần như không.",
    feeds: "M",
  },
  {
    year: "2013",
    who: "Les Binet & Peter Field",
    work: "The Long and the Short of It, IPA",
    claim:
      "Mỗi 10 điểm tiếng nói vượt trên thị phần ứng với khoảng +0,5 điểm thị phần mỗi năm.",
    feeds: "C",
  },
  {
    year: "2020",
    who: "Les Binet",
    work: "Share of search, IPA",
    claim:
      "Tỷ trọng tìm kiếm đi cùng thị phần và báo trước thay đổi thị phần vài tháng, có khi tới một năm.",
    tension:
      "Bằng chứng mới từ ba ngành hàng; chính tác giả gọi đây là chỉ số nhanh và rẻ, không hoàn hảo.",
    feeds: "C",
  },
];

const FEEDS_LABEL: Record<Feeds, string> = {
  B: "kinh doanh",
  M: "marketing",
  C: "truyền thông",
  "—": "—",
};

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
            {f.tension ? (
              <p className="mt-1.5 border-l-[3px] border-l-status-warning pl-2 text-[11px] leading-snug text-ink-muted">
                {f.tension}
              </p>
            ) : null}
          </div>

          <span className="ml-auto shrink-0 self-start pt-0.5 text-[10px] whitespace-nowrap text-ink-muted">
            {FEEDS_LABEL[f.feeds]}
          </span>
        </li>
      ))}
    </ol>
  );
}
