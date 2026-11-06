import {
  BenchmarkScorecardResponseSchema,
  buildDemoBenchmark,
  buildDemoCascade,
  CommunicationGoalSchema,
  GrowthSourceSchema,
  KpiCascadeResponseSchema,
  ObjectiveTierSchema,
  rankedCount,
  rankRows,
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

  it("mọi chỉ số đều khai mức phủ đối thủ của nguồn (bài 2.2)", () => {
    // Thị phần cần mẫu số: một con số tính trên 2 trong 6 trường trông y hệt một con số
    // tính trên cả 6. Không khai mức phủ thì bảng đầu vào có ô trống im lặng, và người
    // đọc mặc định là đã so được với đối thủ.
    const thieu = cascade.kpis
      .filter((k) => k.provenance.benchmark === undefined)
      .map((k) => `${k.key} (${k.provenance.label})`);
    expect(thieu).toEqual([]);
  });

  it("mọi chỉ số ƯỚC LƯỢNG đều nêu căn cứ, và không chỉ số đo thật nào mang nhãn ước lượng", () => {
    for (const kpi of cascade.kpis) {
      const laUocLuong = kpi.requirement.readiness === "estimated";
      if (laUocLuong) {
        expect(
          kpi.estimateBasis,
          `${kpi.key} là ước lượng mà không nêu căn cứ`,
        ).not.toBeNull();
      } else {
        expect(
          kpi.estimateBasis,
          `${kpi.key} không phải ước lượng mà lại nêu căn cứ`,
        ).toBeNull();
      }
    }
  });

  it("danh sách chỉ số ước lượng là danh sách ĐÓNG — thêm một cái phải sửa test này", () => {
    // Cổng cố ý: một con số ước lượng lọt vào bảng điều khiển mà không ai để ý là cách
    // nhanh nhất để người đọc tưởng nó là số đo. Thêm ước lượng mới thì phải sửa ở đây,
    // tức là phải có người nhìn thấy nó.
    const uoc_luong = cascade.kpis
      .filter((k) => k.requirement.readiness === "estimated")
      .map((k) => k.key)
      .sort();

    expect(uoc_luong).toEqual([
      "aided_awareness",
      "cost_per_consideration",
      "cost_per_enrolment",
      "spontaneous_awareness",
      "top_of_mind",
    ]);
  });

  it("chỉ số có giá trị thì giá trị đó phải đến từ nguồn ĐÃ KHAI", () => {
    // Lỗi nguy hiểm nhất của một dashboard là một con số trông như thật nhưng do người
    // ta điền vào cho đỡ trống. Ba mức được phép mang giá trị: đã kết nối, nguồn công
    // khai đã viết mã, và ước lượng — mức cuối phải kèm công thức, kiểm ở test trên.
    const bia_so = cascade.kpis.filter(
      (k) =>
        k.value !== null &&
        k.requirement.readiness !== "connected" &&
        k.requirement.readiness !== "public_ready" &&
        k.requirement.readiness !== "estimated",
    );
    expect(bia_so.map((k) => k.key)).toEqual([]);
  });
});

describe("Bảng đối sánh với nhóm trường cạnh tranh", () => {
  const benchmark = buildDemoBenchmark();

  it("qua được schema, và mỗi chiều trỏ về một mục tiêu có thật trong cây", () => {
    const ket_qua = BenchmarkScorecardResponseSchema.safeParse(benchmark);
    const vi_pham = ket_qua.success
      ? []
      : ket_qua.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`);
    expect(vi_pham).toEqual([]);

    // Bảng đối sánh phải nối được về cây mục tiêu, nếu không nó chỉ là một bảng số rời.
    const khoaMucTieu = new Set(
      buildDemoCascade().objectives.map((o) => o.key),
    );
    const mo_coi = benchmark.dimensions
      .filter((d) => !khoaMucTieu.has(d.objectiveKey))
      .map((d) => `${d.key} → ${d.objectiveKey}`);
    expect(mo_coi).toEqual([]);
  });

  it("trường chưa có số bị loại khỏi xếp hạng chứ KHÔNG bị coi là bằng 0 (bài 2.2)", () => {
    // Đây là cái bẫy chính của mọi phép so sánh thiếu mẫu số: gán 0 cho trường chưa đo
    // được sẽ đẩy Học viện lên hạng cao hơn thực tế.
    for (const chieu of benchmark.dimensions) {
      for (const row of chieu.rows) {
        if (row.value === null) expect(row.rank).toBeNull();
        else expect(row.rank).not.toBeNull();
      }

      const coSo = chieu.rows.filter((r) => r.value !== null);
      expect(new Set(coSo.map((r) => r.rank)).size).toBe(coSo.length);
      expect(rankedCount(chieu)).toBe(coSo.length);
    }
  });

  it("rankRows xếp giảm dần và đẩy trường chưa có số xuống cuối", () => {
    const brand = (key: string, isUs = false) => ({
      key,
      label: key,
      shortLabel: key,
      isUs,
    });
    const rows = rankRows([
      { brand: brand("a"), value: 10 },
      { brand: brand("b", true), value: 30 },
      { brand: brand("c"), value: null },
      { brand: brand("d"), value: 20 },
    ]);

    expect(rows.map((r) => r.brand.key)).toEqual(["b", "d", "a", "c"]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, null]);
  });

  it("schema TỪ CHỐI chiều khai phủ đủ nhóm mà vẫn còn trường trống", () => {
    // Lỗi nguy hiểm nhất của bảng này: một con số tính trên 2 trong 6 trường trông y
    // hệt một con số tính trên cả 6.
    const sai = {
      ...benchmark,
      dimensions: benchmark.dimensions.map((d, i) =>
        i === 0
          ? {
              ...d,
              coverage: "full" as const,
              rows: d.rows.map((r, j) =>
                j === 1 ? { ...r, value: null, rank: null } : r,
              ),
            }
          : d,
      ),
    };

    const ket_qua = BenchmarkScorecardResponseSchema.safeParse(sai);
    expect(ket_qua.success).toBe(false);
    if (!ket_qua.success) {
      expect(
        ket_qua.error.issues.some((i) => i.path.includes("coverage")),
      ).toBe(true);
    }
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
