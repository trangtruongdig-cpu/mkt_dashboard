import {
  buildDemoCascade,
  CommunicationGoalSchema,
  GrowthSourceSchema,
  KpiCascadeResponseSchema,
  ObjectiveTierSchema,
  type KpiCascadeResponse,
  type Objective,
} from "@ptit/shared";
import { describe, expect, it } from "vitest";

/**
 * KHOÁ KHUNG IBMC VÀO TEST.
 *
 * Cây mục tiêu không phải một cấu trúc kỹ thuật tuỳ ý — nó là hiện thực hoá khung
 * IBMC (xem `docs/ly-thuyet/ibmc-khung-dat-muc-tieu.md`). Trước đây nội dung tầng
 * marketing bị khai ở tầng kinh doanh và không ai phát hiện trong nhiều tháng, vì
 * kiểu dữ liệu vẫn hợp lệ.
 *
 * Những test dưới đây kiểm NỘI DUNG LÝ THUYẾT, không kiểm kiểu. Mỗi test ghi số bài
 * giảng mà nó bảo vệ, để người sửa sau biết đang tranh luận với điều gì.
 */
describe("Cây mục tiêu tuân thủ khung IBMC", () => {
  const cascade: KpiCascadeResponse = buildDemoCascade();

  const theoTang = (tier: Objective["tier"]) =>
    cascade.objectives.filter((o) => o.tier === tier);

  it("qua được toàn bộ ràng buộc của schema dùng chung", () => {
    const ket_qua = KpiCascadeResponseSchema.safeParse(cascade);
    // In ra từng vi phạm thay vì chỉ "không hợp lệ": thông báo mặc định của zod cho
    // một cây 13 mục tiêu gần như không đọc được.
    const vi_pham = ket_qua.success
      ? []
      : ket_qua.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    expect(vi_pham).toEqual([]);
  });

  it("tầng kinh doanh chỉ gồm bốn con số Sale · Share · Growth · Profit (bài 2.6)", () => {
    expect(
      theoTang("business")
        .map((o) => o.key)
        .sort(),
    ).toEqual(["biz_growth", "biz_profit", "biz_sale", "biz_share"]);
  });

  it("nguồn tăng trưởng nằm ở tầng marketing, không ở tầng kinh doanh (bài 3.1)", () => {
    // Đây chính là điểm lệch số 1 của bản đối chiếu. Nguồn tăng trưởng mô tả thay đổi
    // HÀNH VI của người học; tầng kinh doanh là số liệu của Học viện.
    const co_nguon = cascade.objectives.filter((o) => o.growthSource !== null);
    expect(co_nguon.every((o) => o.tier === "marketing")).toBe(true);

    // Và đủ cả năm nguồn, mỗi nguồn đúng một mục tiêu — thiếu một nguồn nghĩa là có
    // một đường tăng trưởng không ai theo dõi.
    expect(co_nguon.map((o) => o.growthSource).sort()).toEqual(
      [...GrowthSourceSchema.options].sort(),
    );
  });

  it("bốn nhóm mục tiêu truyền thông đều có mặt và chỉ ở tầng truyền thông (bài 5.1, 5.2)", () => {
    const co_nhom = cascade.objectives.filter(
      (o) => o.communicationGoal !== null,
    );
    expect(co_nhom.every((o) => o.tier === "communication")).toBe(true);
    expect(co_nhom.map((o) => o.communicationGoal).sort()).toEqual(
      [...CommunicationGoalSchema.options].sort(),
    );
  });

  it("tăng trưởng của Học viện luôn có tăng trưởng ngành đặt cạnh (bài 2.3)", () => {
    // Quy tắc chịu lực nhất của cả khung: một con số tăng trưởng đứng một mình là con
    // số gây hiểu sai, vì tăng chậm hơn ngành nghĩa là ĐANG MẤT thị phần.
    const trong_muc_tieu_tang_truong = cascade.kpis.filter(
      (k) => k.objectiveKey === "biz_growth",
    );

    expect(
      trong_muc_tieu_tang_truong.some((k) => k.key === "enrolment_growth"),
    ).toBe(true);
    expect(
      trong_muc_tieu_tang_truong.some(
        (k) => k.key === "category_enrolment_growth",
      ),
    ).toBe(true);
    // Và phải có chỉ số chênh lệch: dấu của nó là dấu của thị phần.
    expect(
      trong_muc_tieu_tang_truong.some(
        (k) => k.key === "growth_vs_category_gap",
      ),
    ).toBe(true);
  });

  it("thuộc tính thương hiệu tách theo từng thuộc tính để đọc được quy tắc tăng–giữ (bài 5.1)", () => {
    // Một tỷ lệ gộp giữ nguyên trong khi tin bài chuyển hết từ thuộc tính này sang
    // thuộc tính khác — phải có các chuỗi riêng mới thấy được việc đánh đổi đó.
    const rieng_tung_thuoc_tinh = cascade.kpis.filter(
      (k) =>
        k.objectiveKey === "com_attributes" && k.key.startsWith("attribute_"),
    );
    expect(rieng_tung_thuoc_tinh.length).toBeGreaterThanOrEqual(3);
  });

  it("mỗi tầng có nhiều nhất một trọng tâm, và tầng nào cũng có mục tiêu", () => {
    for (const tier of ObjectiveTierSchema.options) {
      const trong_tang = theoTang(tier);
      expect(trong_tang.length).toBeGreaterThan(0);
      expect(trong_tang.filter((o) => o.isFocus).length).toBeLessThanOrEqual(1);
    }
  });

  it("không có chỉ số mồ côi: mọi chỉ số trỏ về một mục tiêu có thật, cùng tầng", () => {
    const theoKhoa = new Map(cascade.objectives.map((o) => [o.key, o]));
    for (const kpi of cascade.kpis) {
      const muc_tieu = theoKhoa.get(kpi.objectiveKey);
      expect(muc_tieu, `chỉ số ${kpi.key} trỏ sai mục tiêu`).toBeDefined();
      expect(muc_tieu?.tier, `chỉ số ${kpi.key} lệch tầng`).toBe(kpi.tier);
    }
  });

  it("chỉ số chưa có nguồn dữ liệu thì KHÔNG được có giá trị", () => {
    // Lỗi nguy hiểm nhất của một dashboard là một con số trông như thật nhưng do người
    // ta điền vào cho đỡ trống.
    const bia_so = cascade.kpis.filter(
      (k) =>
        k.value !== null &&
        k.requirement.readiness !== "connected" &&
        k.requirement.readiness !== "public_ready",
    );
    expect(bia_so.map((k) => k.key)).toEqual([]);
  });
});

describe("Schema chặn cây mục tiêu sai khung", () => {
  it("từ chối khi nguồn tăng trưởng bị gắn vào tầng kinh doanh", () => {
    const cascade = buildDemoCascade();

    // Đúng cái lỗi đã tồn tại trong mã nguồn trước đây: gắn nguồn tăng trưởng cho một
    // mục tiêu kinh doanh. Trước khi có ràng buộc này, cây vẫn parse được bình thường.
    const sai: KpiCascadeResponse = {
      ...cascade,
      objectives: cascade.objectives.map((o) =>
        o.key === "biz_sale"
          ? { ...o, growthSource: "penetration" as const }
          : o,
      ),
    };

    const ket_qua = KpiCascadeResponseSchema.safeParse(sai);
    expect(ket_qua.success).toBe(false);
    if (!ket_qua.success) {
      expect(
        ket_qua.error.issues.some((i) => i.path.includes("growthSource")),
      ).toBe(true);
    }
  });

  it("từ chối khi một mục tiêu marketing không trỏ về tầng kinh doanh", () => {
    const cascade = buildDemoCascade();

    const sai: KpiCascadeResponse = {
      ...cascade,
      objectives: cascade.objectives.map((o) =>
        o.key === "mkt_choice" ? { ...o, parentKey: "com_awareness" } : o,
      ),
    };

    const ket_qua = KpiCascadeResponseSchema.safeParse(sai);
    expect(ket_qua.success).toBe(false);
    if (!ket_qua.success) {
      expect(
        ket_qua.error.issues.some((i) => i.path.includes("parentKey")),
      ).toBe(true);
    }
  });
});
