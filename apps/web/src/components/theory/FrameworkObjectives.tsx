interface FrameworkObjective {
  /** Tên mục tiêu trong khung, tiếng Việt. */
  name: string;
  /** Tên chuẩn trong văn liệu — giữ tiếng Anh vì đó là tên tra cứu được. */
  en: string;
  /** Bài trong khoá IBMC. */
  lesson: string;
  /** Cơ sở lý thuyết: ai, năm. Không được rỗng — xem chú thích của component. */
  basis: string;
}

interface TierGroup {
  tier: string;
  subject: string;
  objectives: readonly FrameworkObjective[];
}

/**
 * MƯỜI HAI MỤC TIÊU CON, MƯỜI HAI CƠ SỞ.
 *
 * Danh sách nền tảng ở trên chạy MỘT CHIỀU: từ tác giả sang mục tiêu. Chiều đó không
 * chứng minh được điều quan trọng nhất — rằng không mục tiêu nào trong khung đang đứng
 * mà không có nền. Bảng này chạy chiều ngược lại, và nó là chỗ phát hiện thiếu sót:
 * dựng bảng này mới lộ ra Tăng trưởng, Chất lượng sáng tạo và nửa giá trị của Lượng
 * tiêu dùng chưa có công trình nào đỡ, nên phải bổ sung BCG 1968, Gordon Brown 1987 và
 * Silverstein & Fiske 2003 vào danh sách trên.
 *
 * Quy tắc giữ bảng này đúng: thêm một mục tiêu vào khung thì phải thêm một dòng ở đây
 * kèm cơ sở. Không nêu được cơ sở nghĩa là mục tiêu đó đang được đặt ra vì có dữ liệu,
 * không phải vì có lý do.
 */
const FRAMEWORK: readonly TierGroup[] = [
  {
    tier: "Kinh doanh",
    subject: "số liệu của Học viện",
    objectives: [
      {
        name: "Doanh số",
        en: "Sale",
        lesson: "2.1",
        basis: "McElroy 1931 · Drucker 1954",
      },
      {
        name: "Thị phần",
        en: "Share",
        lesson: "2.2",
        basis: "Drucker 1954 · Buzzell, Gale & Sultan 1975",
      },
      {
        name: "Tăng trưởng",
        en: "Growth",
        lesson: "2.3 – 2.4",
        basis: "Ansoff 1957 · Henderson (BCG) 1968",
      },
      {
        name: "Lợi nhuận",
        en: "Profit",
        lesson: "2.5",
        basis: "McElroy 1931",
      },
    ],
  },
  {
    tier: "Marketing",
    subject: "hành vi của người học",
    objectives: [
      {
        name: "Thâm nhập",
        en: "Penetration",
        lesson: "3.2",
        basis: "Ansoff 1957 · Rogers 1962 · Ehrenberg 1972 · Sharp 2010",
      },
      {
        name: "Tần suất",
        en: "Frequency",
        lesson: "3.3",
        basis: "Kotler 1967 · Ehrenberg 1972",
      },
      {
        name: "Lượng tiêu dùng",
        en: "Consumption",
        lesson: "3.3",
        basis: "Ehrenberg 1972 · Silverstein & Fiske 2003",
      },
      {
        name: "Lựa chọn – Trung thành",
        en: "Choice / Loyalty",
        lesson: "3.3",
        basis: "Ehrenberg 1972 · Ries & Trout 1986",
      },
    ],
  },
  {
    tier: "Truyền thông",
    subject: "nhận thức của người học",
    objectives: [
      {
        name: "Nhận biết",
        en: "Awareness",
        lesson: "5.1",
        basis: "Lavidge & Steiner 1961 · Aaker 1991 · Binet 2020",
      },
      {
        name: "Thuộc tính thương hiệu",
        en: "Key attributes",
        lesson: "5.1",
        basis: "Keller 1993",
      },
      {
        name: "Chất lượng sáng tạo",
        en: "Creative quality",
        lesson: "5.2",
        basis: "Colley 1961 · Gordon Brown 1987",
      },
      {
        name: "Hiệu quả kênh",
        en: "Media effectiveness",
        lesson: "5.2",
        basis: "Jones 1990 · Binet & Field 2013",
      },
    ],
  },
];

export function FrameworkObjectives() {
  return (
    <div className="overflow-x-auto rounded-xl border border-hairline bg-surface">
      <table className="w-full min-w-[34rem] border-collapse text-left">
        <caption className="sr-only">
          Mười hai mục tiêu con của khung IBMC và cơ sở lý thuyết của từng mục
          tiêu
        </caption>
        <thead>
          <tr className="border-b border-hairline">
            <th
              className="px-3 py-2 text-[11px] font-medium text-ink-muted"
              scope="col"
            >
              Mục tiêu
            </th>
            <th
              className="w-20 px-3 py-2 text-[11px] font-medium text-ink-muted"
              scope="col"
            >
              Bài
            </th>
            <th
              className="px-3 py-2 text-[11px] font-medium text-ink-muted"
              scope="col"
            >
              Cơ sở lý thuyết
            </th>
          </tr>
        </thead>

        {FRAMEWORK.map((group) => (
          <tbody key={group.tier}>
            <tr className="border-b border-hairline bg-surface-inset">
              <th
                className="px-3 py-1.5 text-[11px] font-semibold text-ink"
                colSpan={3}
                scope="colgroup"
              >
                {group.tier}
                <span className="ml-2 font-normal text-ink-muted">
                  — đo {group.subject}
                </span>
              </th>
            </tr>
            {group.objectives.map((o) => (
              <tr
                key={o.en}
                className="border-b border-hairline last:border-b-0"
              >
                <th
                  className="px-3 py-2 align-top text-xs font-medium text-ink"
                  scope="row"
                >
                  {o.name}
                  <span className="block font-normal text-[11px] text-ink-muted">
                    {o.en}
                  </span>
                </th>
                <td className="px-3 py-2 align-top text-[11px] whitespace-nowrap text-ink-muted">
                  {o.lesson}
                </td>
                <td className="px-3 py-2 align-top text-[11px] leading-snug text-ink-secondary">
                  {o.basis}
                </td>
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </div>
  );
}
