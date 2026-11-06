import { describe, expect, it } from "vitest";
import {
  formatCompact,
  formatCurrencyCompact,
  formatDayMonth,
  formatFullDate,
  formatMetric,
  formatNumber,
  formatPercent,
  formatScore,
} from "./format";

/**
 * Kiểm định dạng số theo locale vi-VN.
 *
 * Phần này đáng kiểm nhất của tầng web: nó xuất hiện trên MỌI màn hình, và sai ở đây
 * thì sai đồng loạt mà không có gì nổ ra. Mục 5 CLAUDE.md buộc định dạng theo
 * `vi-VN` — nghĩa là dấu CHẤM ngăn hàng nghìn và dấu PHẨY ngăn thập phân, ngược hẳn
 * tiếng Anh. Một lần đổi nhầm locale sẽ biến 1.284 thành 1,284 và không ai nhận ra
 * cho tới khi hội đồng đọc báo cáo.
 */
describe("Định dạng số theo vi-VN", () => {
  it("dùng dấu chấm ngăn hàng nghìn, không dùng dấu phẩy", () => {
    expect(formatNumber(1284)).toBe("1.284");
    expect(formatNumber(1_284_000)).toBe("1.284.000");
  });

  it("dùng dấu phẩy ngăn thập phân", () => {
    expect(formatPercent(12.5)).toBe("12,5%");
    expect(formatScore(25.1)).toBe("25,10");
  });

  it("điểm xét tuyển giữ đủ hai chữ số thập phân", () => {
    // Chênh 0,05 điểm là chuyện sống còn với thí sinh — không được rút gọn.
    expect(formatScore(26)).toBe("26,00");
    expect(formatScore(24.85)).toBe("24,85");
  });
});

describe("Rút gọn số lớn", () => {
  it("dưới 10 nghìn thì giữ nguyên, không rút gọn", () => {
    expect(formatCompact(1284)).toBe("1.284");
    expect(formatCompact(9999)).toBe("9.999");
  });

  it("từ 10 nghìn dùng N, từ 1 triệu dùng Tr", () => {
    expect(formatCompact(12_900)).toBe("12,9 N");
    expect(formatCompact(1_150_000)).toBe("1,15 Tr");
  });

  it("số âm rút gọn theo trị tuyệt đối", () => {
    expect(formatCompact(-12_900)).toBe("-12,9 N");
  });
});

describe("Rút gọn tiền ở quy mô ngân sách", () => {
  it("nói theo cách người Việt nói, không in đủ mười hai chữ số", () => {
    expect(formatCurrencyCompact(857_000_000_000)).toBe("857 tỷ ₫");
    expect(formatCurrencyCompact(1_150_000_000_000)).toBe("1,15 nghìn tỷ ₫");
    expect(formatCurrencyCompact(56_000_000_000)).toBe("56 tỷ ₫");
  });

  it("dưới một triệu thì in đủ kèm ký hiệu tiền tệ", () => {
    expect(formatCurrencyCompact(525_000)).toContain("₫");
    expect(formatCurrencyCompact(525_000)).toContain("525.000");
  });
});

describe("Định dạng ngày", () => {
  it("đảo về thứ tự ngày/tháng/năm của Việt Nam", () => {
    expect(formatDayMonth("2026-07-27")).toBe("27/07");
    expect(formatFullDate("2026-07-27")).toBe("27/07/2026");
  });

  it("giữ số 0 đứng đầu — 07 chứ không phải 7", () => {
    expect(formatFullDate("2026-01-05")).toBe("05/01/2026");
  });
});

describe("formatMetric chọn đúng cách trình bày theo đơn vị", () => {
  it("mỗi đơn vị một cách, không nhầm sang nhau", () => {
    expect(formatMetric(12.5, "percent")).toBe("12,5%");
    expect(formatMetric(25.1, "score")).toBe("25,10");
    expect(formatMetric(1_150_000, "count")).toBe("1,15 Tr");
    expect(formatMetric(56_000_000_000, "currency")).toBe("56 tỷ ₫");
  });
});
