import {
  rankRows,
  type BenchmarkDimension,
  type BenchmarkScorecardResponse,
} from "../schemas/benchmark";
import type { Brand } from "../schemas/brand-share";
import type { DataProvenance } from "../schemas/kpi-cascade";
import { BENCHMARK_BRANDS } from "./cascade";
import { buildWeekStarts, formatVnDate, hashString, seeded } from "./random";

/**
 * BẢNG ĐỐI SÁNH — bản giả lập cho giai đoạn demo giao diện.
 *
 * Phần THẬT ở đây không phải các con số mà là CẤU TRÚC: chiều nào phủ đủ nhóm đối
 * sánh, chiều nào mới một phần, và trường nào thực sự chưa có số. Ba điều đó lấy từ
 * hiện trạng kho đã đo, nên khi `PostgresKpiRepository` chồng số thật lên thì hình
 * dạng bảng không đổi — chỉ các con số đổi.
 *
 * Cụ thể: điểm chuẩn cố ý để trống bốn trường, vì kho thật cũng chỉ mới có Học viện và
 * Trường ĐH Công nghệ. Vẽ đủ sáu cột ở chiều đó là nói dối về mẫu số.
 */

const SOURCE_WIKIPEDIA: DataProvenance = {
  label:
    "Wikimedia Pageviews API — lượt xem trang của 6 trường trên Wikipedia tiếng Việt",
  url: "https://wikimedia.org/api/rest_v1/",
  benchmark: {
    coverage: "full",
    note: "Cả 6 trường đều công khai qua API, cùng một cách tính.",
  },
};

const SOURCE_NEWS: DataProvenance = {
  label: "Kho tin bài do worker thu thập",
  benchmark: {
    coverage: "full",
    note: "Crawler quét tin bài nhắc cả 6 trường nên thị phần thảo luận có đủ mẫu số.",
  },
};

const SOURCE_TUITION: DataProvenance = {
  label: "Đề án tuyển sinh và trang học phí của từng trường",
  benchmark: {
    coverage: "partial",
    note: "Học phí mới có số ở 3 trên 7 dòng, và ba dòng đó khác đơn vị nhau.",
  },
};

const SOURCE_SCORES: DataProvenance = {
  label: "Trang công bố điểm chuẩn của từng trường",
  benchmark: {
    coverage: "partial",
    note: "Mới khai được trang của Học viện và Trường ĐH Công nghệ.",
  },
};

/** Mức nền để sinh chuỗi giả lập — cùng bộ với biểu đồ thị phần tìm kiếm. */
const NEN_CHU_Y: Record<string, number> = {
  hust: 31,
  ptit: 18,
  fpt: 16,
  uit: 14,
  uet: 13,
  actvn: 8,
};

const NEN_THAO_LUAN: Record<string, number> = {
  hust: 34,
  ptit: 21,
  fpt: 18,
  uet: 11,
  uit: 10,
  actvn: 6,
};

/** Điểm chuẩn bình quân — CHỈ hai trường có số, đúng như kho thật. */
const DIEM_CHUAN: Record<string, number | null> = {
  ptit: 26.1,
  uet: 26.8,
  hust: null,
  uit: null,
  fpt: null,
  actvn: null,
};

function tyTrong(
  nen: Record<string, number>,
  mam: string,
): { brand: Brand; value: number | null }[] {
  const tho = BENCHMARK_BRANDS.map((brand) => {
    const rnd = seeded(hashString(`${mam}:${brand.key}`));
    return { brand, raw: (nen[brand.key] ?? 10) * (0.94 + rnd() * 0.12) };
  });

  const tong = tho.reduce((s, r) => s + r.raw, 0);
  return tho.map((r) => ({
    brand: r.brand,
    value: Number(((r.raw / tong) * 100).toFixed(2)),
  }));
}

export function buildDemoBenchmark(
  referenceDate: Date = new Date(),
): BenchmarkScorecardResponse {
  const weeks = buildWeekStarts(referenceDate, 12);
  const tuanCuoi = weeks[weeks.length - 1]!;

  const dimensions: BenchmarkDimension[] = [
    {
      key: "attention",
      label: "Thị phần chú ý",
      objectiveKey: "com_awareness",
      unit: "percent",
      higherIsBetter: true,
      periodLabel: `Tuần ${formatVnDate(tuanCuoi)}`,
      provenance: SOURCE_WIKIPEDIA,
      coverage: "full",
      note: "Lượt xem trang Wikipedia của từng trường, chia cho tổng cả nhóm. Đo mức chú ý, không đo nhận biết — người đã tra cứu là người đã biết tên.",
      rows: rankRows(tyTrong(NEN_CHU_Y, `chuy:${tuanCuoi}`)),
    },
    {
      key: "voice",
      label: "Thị phần thảo luận trên báo chí",
      objectiveKey: "com_effectiveness",
      unit: "percent",
      higherIsBetter: true,
      periodLabel: "Tháng gần nhất đủ mẫu",
      provenance: SOURCE_NEWS,
      coverage: "full",
      note: "Chỉ tính tháng đủ mẫu: tháng lác đác vài bài cho ra tỷ trọng nhảy loạn. Báo chí dồn theo mùa tuyển sinh nên so tháng liền trước, không so cùng kỳ năm trước.",
      rows: rankRows(tyTrong(NEN_THAO_LUAN, `baochi:${tuanCuoi}`)),
    },
    {
      key: "score",
      label: "Điểm chuẩn bình quân",
      objectiveKey: "mkt_choice",
      unit: "score",
      higherIsBetter: true,
      periodLabel: "Mùa tuyển sinh gần nhất",
      provenance: SOURCE_SCORES,
      coverage: "partial",
      note: "Mới 2 trên 6 trường có số. Điểm chuẩn là giá mà thí sinh trả bằng điểm thi, nên nó đo sức mạnh của nguồn Lựa chọn — nhưng xếp hạng trên 2 trường thì chưa nói được vị thế.",
      rows: rankRows(
        BENCHMARK_BRANDS.map((brand) => ({
          brand,
          value: DIEM_CHUAN[brand.key] ?? null,
        })),
      ),
    },
  ];

  // Chiều GIÁ TRỊ — cố ý để trống toàn bộ, và đó là nội dung chính của nó.
  //
  // Bài 2.1 và 2.2 đòi đọc doanh số và thị phần ở CẢ HAI mặt sản lượng và giá trị, vì
  // dẫn đầu mặt này không kéo theo mặt kia. Mặt giá trị hiện chưa so được, và lý do
  // không phải "chưa viết mã": ba dòng có số thì một tính theo tín chỉ, hai tính theo
  // năm, và cả hai dòng theo năm đều KHÔNG phải hệ chính quy — hệ chính quy của Học
  // viện nằm trong một đề án dạng ảnh scan.
  //
  // Để chiều này hiện ra với toàn ô trống là có chủ ý: một mặt của mục tiêu kinh doanh
  // đang không đo được thì phải nhìn thấy trên bảng điều khiển, chứ không nằm trong
  // một tài liệu không ai mở.
  dimensions.push({
    key: "value",
    label: "Học phí mỗi năm",
    objectiveKey: "mkt_consumption",
    unit: "currency",
    higherIsBetter: true,
    periodLabel: "Mùa tuyển sinh gần nhất",
    provenance: SOURCE_TUITION,
    coverage: "partial",
    note: "Chưa so sánh được: ba dòng có số thì khác đơn vị nhau (một theo tín chỉ, hai theo năm), và hai dòng theo năm đều không phải hệ chính quy. Mở khoá bằng cách điền học phí mỗi năm của hệ chính quy cho từng trường — bốn trường phải nhập tay vì nguồn không cho máy đọc.",
    rows: rankRows(BENCHMARK_BRANDS.map((brand) => ({ brand, value: null }))),
  });

  return {
    period: {
      from: weeks[0]!,
      to: tuanCuoi,
      label: "Số liệu mới nhất của từng chiều — mỗi chiều theo nhịp riêng",
    },
    updatedAt: new Date(`${tuanCuoi}T02:00:00Z`).toISOString(),
    dimensions,
  };
}
