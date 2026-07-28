import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  applyMeasuredValues,
  BENCHMARK_BRANDS,
  buildDemoCascade,
  buildDemoShareOfSearch,
  type KpiCascadeResponse,
  type KpiMeasuredValue,
  type ShareOfSearchResponse,
} from "@ptit/shared";
import { sql } from "drizzle-orm";
import { DB, type Database } from "../../db/db.module";
import { KpiRepository } from "./kpi.repository";

/**
 * Số bản ghi tối thiểu để tỷ lệ sắc thái của một tháng được coi là đọc được.
 *
 * Phải khớp với `minSampleForTrend` mà `PostgresDashboardRepository` trả cho giao diện:
 * hai nơi đặt hai ngưỡng khác nhau thì biểu đồ làm mờ một tháng trong khi cascade vẫn
 * lấy chính tháng đó làm mốc so sánh.
 */
const MAU_TOI_THIEU_THANG = 10;

/**
 * Đọc giá trị thật của chỉ số từ các bảng `mart__*` do dbt sinh ra.
 *
 * Cấu trúc cascade vẫn lấy từ `@ptit/shared` — mục tiêu, diễn giải, mức cần đạt là
 * quyết định của con người, không phải thứ tính ra từ dữ liệu. Repository này chỉ
 * thay `value` và `baseline`, rồi `applyMeasuredValues` tính lại trạng thái.
 *
 * Không khai bảng mart thành Drizzle schema: chúng do dbt sở hữu. Khai vào đây là mở
 * đường cho drizzle-kit sinh migration đòi xoá chúng.
 */
@Injectable()
export class PostgresKpiRepository extends KpiRepository {
  private readonly logger = new Logger(PostgresKpiRepository.name);

  constructor(@Inject(DB) private readonly db: Database) {
    super();
  }

  async getCascade(): Promise<KpiCascadeResponse> {
    const goc = buildDemoCascade();

    try {
      // Ba nguồn đọc riêng, mỗi nguồn tự chịu lỗi của mình: dữ liệu công khai và
      // Wikipedia được nạp bằng job khác GA4 nên có thể chưa có, và khi đó không được
      // kéo sập luôn các chỉ số đã đọc được.
      const [tu_ga4, tu_cong_khai, tu_chu_y, tu_bao_chi, tu_sac_thai, tu_diem] =
        await Promise.all([
          this.docAnToan("GA4", () => this.docGiaTri()),
          this.docAnToan("tài liệu công khai", () => this.docGiaTriCongKhai()),
          this.docAnToan("thị phần chú ý", () => this.docGiaTriChuY()),
          this.docAnToan("thị phần thảo luận", () => this.docGiaTriThaoLuan()),
          this.docAnToan("sắc thái", () => this.docGiaTriSacThai()),
          this.docAnToan("điểm chuẩn", () => this.docGiaTriDiemChuan()),
        ]);

      const do_duoc = [
        ...tu_ga4,
        ...tu_cong_khai,
        ...tu_chu_y,
        ...tu_bao_chi,
        ...tu_sac_thai,
        ...tu_diem,
      ];
      this.logger.log(`Đã đọc ${do_duoc.length} chỉ số từ bảng mart.`);

      // Bộ số liệu giả lập gắn nhãn kỳ "12 tuần gần nhất". Giữ nguyên nhãn đó khi đã
      // đọc dữ liệu thật là nói sai với người xem: cascade gộp chỉ số hằng ngày, hằng
      // tuần và hằng năm nên không tồn tại MỘT kỳ chung cho cả bảng.
      return {
        ...applyMeasuredValues(goc, do_duoc),
        period: {
          ...goc.period,
          label: "Số liệu mới nhất của từng nguồn — mỗi chỉ số theo nhịp riêng",
        },
        updatedAt: new Date().toISOString(),
      };
    } catch (loi) {
      // Kho chưa dựng xong hoặc dbt chưa chạy — hiện cấu trúc với giá trị mặc định
      // còn hơn làm sập cả bảng điều khiển. Nhưng phải ghi log để không ai tưởng là số thật.
      this.logger.error(
        `Không đọc được bảng mart, quay về giá trị mặc định trong mã nguồn: ${
          loi instanceof Error ? loi.message : String(loi)
        }`,
      );
      return goc;
    }
  }

  /**
   * Chạy một phép đọc, nuốt lỗi và ghi log thay vì ném ra ngoài.
   *
   * Từng nguồn dữ liệu do một job khác nhau nạp về, và chúng lên kho ở những thời điểm
   * khác nhau. Một nguồn chưa có không được làm mất luôn các chỉ số đã đọc được.
   */
  private async docAnToan(
    ten_nguon: string,
    doc: () => Promise<KpiMeasuredValue[]>,
  ): Promise<KpiMeasuredValue[]> {
    try {
      return await doc();
    } catch (loi) {
      this.logger.warn(
        `Không đọc được nhóm chỉ số ${ten_nguon}: ${
          loi instanceof Error ? loi.message : String(loi)
        }`,
      );
      return [];
    }
  }

  async getShareOfSearch(): Promise<ShareOfSearchResponse> {
    try {
      return await this.docThiPhanChuY();
    } catch (loi) {
      this.logger.warn(
        `Không đọc được mart__brand_attention, quay về chuỗi giả lập: ${
          loi instanceof Error ? loi.message : String(loi)
        }`,
      );
      return buildDemoShareOfSearch();
    }
  }

  /**
   * Chuỗi thị phần chú ý theo tuần, đo bằng lượt xem trang Wikipedia.
   *
   * Nhãn thương hiệu lấy từ `BENCHMARK_BRANDS` của `@ptit/shared` chứ không lưu trong
   * kho: bảng mart chỉ giữ mã trường, còn tên hiển thị là chuyện của tầng trình bày.
   * Thương hiệu có trong kho mà không có trong danh sách thì bỏ qua kèm cảnh báo — giữ
   * lại sẽ làm tổng tỷ trọng vượt 100% và schema từ chối cả gói dữ liệu.
   */
  private async docThiPhanChuY(): Promise<ShareOfSearchResponse> {
    const dong = await this.db.execute<{
      tuan: string;
      ma_truong: string;
      thi_phan_pct: string | number | null;
    }>(sql`
      select to_char(tuan, 'YYYY-MM-DD') as tuan, ma_truong, thi_phan_pct
      from mart.mart__brand_attention
      order by tuan, ma_truong
    `);

    const ban_ghi = Array.isArray(dong) ? dong : [];
    if (ban_ghi.length === 0) {
      throw new Error("mart__brand_attention chưa có dòng nào");
    }

    const weeks = [...new Set(ban_ghi.map((r) => r.tuan))].sort();
    const theo_tuan = new Map(weeks.map((w, i) => [w, i]));

    const la_lieu = new Set(BENCHMARK_BRANDS.map((b) => b.key));
    const thua = [...new Set(ban_ghi.map((r) => r.ma_truong))].filter(
      (k) => !la_lieu.has(k),
    );
    if (thua.length > 0) {
      this.logger.warn(
        `Kho có thương hiệu không khai trong BENCHMARK_BRANDS, đã bỏ qua: ${thua.join(", ")}`,
      );
    }

    const series = BENCHMARK_BRANDS.map((brand) => {
      const values = new Array<number>(weeks.length).fill(0);
      for (const r of ban_ghi) {
        if (r.ma_truong !== brand.key) continue;
        const i = theo_tuan.get(r.tuan);
        if (i !== undefined) values[i] = Number(r.thi_phan_pct ?? 0);
      }
      return { brand, values };
    });

    const cuoi = weeks.length - 1;
    const latest = series
      .map((s) => ({
        brand: s.brand,
        sharePct: s.values[cuoi] ?? 0,
        deltaPoints: Number(((s.values[cuoi] ?? 0) - (s.values[0] ?? 0)).toFixed(2)),
      }))
      .sort((a, b) => b.sharePct - a.sharePct);

    return {
      period: {
        from: weeks[0]!,
        to: weeks[cuoi]!,
        label: `${weeks.length} tuần gần nhất`,
      },
      updatedAt: new Date().toISOString(),
      weeks,
      series,
      latest,
      provenance: {
        label:
          "Wikimedia Pageviews API — lượt xem trang của nhóm trường đối sánh trên Wikipedia tiếng Việt, agent=user",
        url: "https://wikimedia.org/api/rest_v1/",
      },
    };
  }

  /**
   * Một lần gọi lấy hết mọi chỉ số.
   *
   * Hai kiểu cửa sổ so sánh, đúng như khai trong `comparability` của từng chỉ số:
   *   - `calendar`        — 30 ngày gần nhất so với đúng 30 ngày đó của năm trước
   *   - `admission_cycle` — luỹ kế từ đầu năm tới cùng mốc ngày/tháng của năm trước
   *
   * Chốt mốc theo ngày lớn nhất có trong dữ liệu chứ không theo `now()`: job hút dữ
   * liệu chạy theo lịch nên hôm nay có thể chưa có số, lấy `now()` sẽ ra một cửa sổ
   * thiếu ngày cuối và mọi so sánh lệch theo.
   */
  private async docGiaTri(): Promise<KpiMeasuredValue[]> {
    const ket_qua = await this.db.execute<{
      kpi_key: string;
      value: string | number | null;
      baseline: string | number | null;
    }>(sql`
      with moc as (
        select max(ngay) as het from mart.mart__channel_performance
      ),
      ky as (
        select
          het,
          het - interval '29 days'                          as nay_tu,
          (het - interval '1 year')::date                   as truoc_den,
          (het - interval '1 year' - interval '29 days')::date as truoc_tu,
          date_trunc('year', het)::date                     as nam_nay_tu,
          date_trunc('year', het - interval '1 year')::date as nam_truoc_tu,
          to_char(het, 'MMDD')                              as moc_ngay_thang
        from moc
      ),

      -- ── Tầng truyền thông: nhóm kênh, cửa sổ 30 ngày ────────────────────────
      kenh as (
        select
          sum(c.so_phien)      filter (where c.ngay between k.nay_tu and k.het)   as phien_nay,
          sum(c.so_phien)      filter (where c.ngay between k.truoc_tu and k.truoc_den) as phien_truoc,
          sum(c.so_phien)      filter (where c.nhom_kenh = 'Organic Social' and c.ngay between k.nay_tu and k.het)   as xh_nay,
          sum(c.so_phien)      filter (where c.nhom_kenh = 'Organic Social' and c.ngay between k.truoc_tu and k.truoc_den) as xh_truoc,
          sum(c.so_phien_gan_ket) filter (where c.nhom_kenh = 'Organic Social' and c.ngay between k.nay_tu and k.het)   as xh_gk_nay,
          sum(c.so_phien_gan_ket) filter (where c.nhom_kenh = 'Organic Social' and c.ngay between k.truoc_tu and k.truoc_den) as xh_gk_truoc,
          sum(c.so_phien)      filter (where c.nhom_kenh = 'AI Assistant' and c.ngay between k.nay_tu and k.het)   as ai_nay,
          sum(c.so_phien)      filter (where c.nhom_kenh = 'AI Assistant' and c.ngay between k.truoc_tu and k.truoc_den) as ai_truoc,
          sum(c.so_nguoi_dung) filter (where c.ngay between k.nay_tu and k.het)   as nd_nay,
          sum(c.so_nguoi_dung) filter (where c.ngay between k.truoc_tu and k.truoc_den) as nd_truoc,
          sum(c.so_nguoi_dung_moi) filter (where c.ngay between k.nay_tu and k.het)   as ndm_nay,
          sum(c.so_nguoi_dung_moi) filter (where c.ngay between k.truoc_tu and k.truoc_den) as ndm_truoc
        from mart.mart__channel_performance c cross join ky k
      ),

      -- ── Phễu tuyển sinh ─────────────────────────────────────────────────────
      pheu as (
        select
          sum(f.so_luot_xem) filter (where f.bac = 'can_nhac' and f.ngay between k.nay_tu and k.het)   as cn_nay,
          sum(f.so_luot_xem) filter (where f.bac = 'can_nhac' and f.ngay between k.truoc_tu and k.truoc_den) as cn_truoc,
          sum(f.so_luot_xem) filter (where f.bac = 'y_dinh_dang_ky' and f.ngay >= k.nam_nay_tu)         as dk_nay,
          sum(f.so_luot_xem) filter (where f.bac = 'y_dinh_dang_ky' and f.ngay >= k.nam_truoc_tu
                                       and f.ngay < k.nam_nay_tu)                                      as dk_truoc
        from mart.mart__admission_funnel f cross join ky k
      ),

      -- ── Nhu cầu theo ngành: luỹ kế từ đầu năm tới cùng mốc ngày/tháng ───────
      nganh as (
        select
          sum(p.so_luot_xem) filter (where p.ngay >= k.nam_nay_tu)                                as tong_nay,
          sum(p.so_luot_xem) filter (where p.ngay >= k.nam_truoc_tu and p.ngay < k.nam_nay_tu)    as tong_truoc,
          sum(p.so_luot_xem) filter (where not p.thuoc_loi and p.ngay >= k.nam_nay_tu)            as ngoai_loi_nay,
          sum(p.so_luot_xem) filter (where not p.thuoc_loi and p.ngay >= k.nam_truoc_tu and p.ngay < k.nam_nay_tu) as ngoai_loi_truoc,
          sum(p.so_luot_xem) filter (where p.he_gia_tri_cao and p.ngay >= k.nam_nay_tu)           as clc_nay,
          sum(p.so_luot_xem) filter (where p.he_gia_tri_cao and p.ngay >= k.nam_truoc_tu and p.ngay < k.nam_nay_tu) as clc_truoc
        from mart.mart__program_demand p cross join ky k
        where to_char(p.ngay, 'MMDD') <= (select moc_ngay_thang from ky)
      )

      select 'social_traffic_share' as kpi_key,
             round(100.0 * xh_nay / nullif(phien_nay, 0), 1) as value,
             round(100.0 * xh_truoc / nullif(phien_truoc, 0), 1) as baseline from kenh
      union all
      select 'social_engagement_rate',
             round(100.0 * xh_gk_nay / nullif(xh_nay, 0), 1),
             round(100.0 * xh_gk_truoc / nullif(xh_truoc, 0), 1) from kenh
      union all
      select 'ai_assistant_sessions', ai_nay, ai_truoc from kenh
      union all
      select 'returning_user_share',
             round(100.0 * (nd_nay - ndm_nay) / nullif(nd_nay, 0), 1),
             round(100.0 * (nd_truoc - ndm_truoc) / nullif(nd_truoc, 0), 1) from kenh
      union all
      select 'admission_consideration_views', cn_nay, cn_truoc from pheu
      union all
      select 'application_intent_views', dk_nay, dk_truoc from pheu
      union all
      select 'program_mix_beyond_core',
             round(100.0 * ngoai_loi_nay / nullif(tong_nay, 0), 1),
             round(100.0 * ngoai_loi_truoc / nullif(tong_truoc, 0), 1) from nganh
      union all
      select 'high_value_program_interest',
             round(100.0 * clc_nay / nullif(tong_nay, 0), 1),
             round(100.0 * clc_truoc / nullif(tong_truoc, 0), 1) from nganh
    `);

    return this.thanhChiSo(ket_qua);
  }

  /**
   * Chỉ số lấy từ Biểu mẫu 18 mà mọi trường buộc phải công khai.
   *
   * Kỳ so sánh ở đây là NĂM HỌC, không phải cửa sổ ngày: tài liệu công khai mỗi năm ra
   * một lần. Lấy hai năm gần nhất CÓ SỐ — không lấy hai năm liền kề theo lịch, vì có
   * năm trường bỏ trống ô đó và khi ấy so với năm trống là so với `null`.
   *
   * Chỉ đọc dòng của Học viện. Số của nhóm đối sánh nằm cùng bảng và dùng cho biểu đồ
   * so sánh, nhưng KPI trên cascade là cam kết của riêng Học viện.
   */
  private async docGiaTriCongKhai(): Promise<KpiMeasuredValue[]> {
    const ket_qua = await this.db.execute<{
      kpi_key: string;
      value: string | number | null;
      baseline: string | number | null;
    }>(sql`
      with ptit as (
        select nam, quy_mo_dao_tao, ty_le_viec_lam_pct
        from mart.mart__disclosure_benchmark
        where ma_truong = 'ptit'
      ),
      viec_lam as (
        select
          (array_agg(ty_le_viec_lam_pct order by nam desc))[1] as nay,
          (array_agg(ty_le_viec_lam_pct order by nam desc))[2] as truoc
        from ptit where ty_le_viec_lam_pct is not null
      )
      select 'employment_rate' as kpi_key, nay as value, truoc as baseline from viec_lam
    `);

    return this.thanhChiSo(ket_qua);
  }

  /**
   * Chênh lệch điểm chuẩn của Học viện so với nhóm đối sánh, cùng năm.
   *
   * Dương nghĩa là thí sinh chấp nhận đánh đổi điểm cao hơn để vào Học viện. Đây là
   * thước đo LỰA CHỌN mạnh nhất quan sát được từ bên ngoài, vì nó là hành vi thật.
   *
   * Chỉ tính trên trường có từ 10 ngành trở lên (`du_nganh`): bình quân của một trường
   * chỉ công bố vài ngành không đại diện cho trường đó. Và vì cơ cấu ngành mỗi trường
   * một khác, con số này đọc theo XU HƯỚNG qua các năm chứ không đọc như một mức tuyệt đối.
   */
  private async docGiaTriDiemChuan(): Promise<KpiMeasuredValue[]> {
    const ket_qua = await this.db.execute<{
      kpi_key: string;
      value: string | number | null;
      baseline: string | number | null;
    }>(sql`
      with du_dieu_kien as (
        select * from mart.mart__admission_score_benchmark where du_nganh
      ),
      theo_nam as (
        select
          nam,
          max(diem_binh_quan) filter (where la_hoc_vien)          as hoc_vien,
          avg(diem_binh_quan) filter (where not la_hoc_vien)      as doi_sanh
        from du_dieu_kien
        group by nam
      ),
      chenh_lech as (
        select nam, round(hoc_vien - doi_sanh, 2) as chenh
        from theo_nam
        where hoc_vien is not null and doi_sanh is not null
      )
      select
        'score_premium' as kpi_key,
        (array_agg(chenh order by nam desc))[1] as value,
        (array_agg(chenh order by nam desc))[2] as baseline
      from chenh_lech
    `);

    return this.thanhChiSo(ket_qua);
  }

  /**
   * Sắc thái báo chí và sắc thái dư luận — HAI chỉ số riêng, không gộp.
   *
   * Đo trên dữ liệu thật, hai nguồn cho ra 56,9% và 80,0% tích cực: báo chí đưa tin
   * điểm chuẩn và thông báo nên trung tính hơn hẳn, còn dư luận thì ấm hơn. Gộp lại
   * thành một tỷ lệ là xoá mất đúng cái khác biệt cần thấy, và mẫu số của hai bên cũng
   * chênh nhau gần ba lần nên trung bình cộng sẽ nghiêng hẳn về phía báo chí.
   *
   * Lấy TOÀN KỲ chứ không lấy tháng gần nhất: mỗi tháng chỉ vài chục bản ghi, và tháng
   * đang chạy thì luôn dở dang.
   *
   * Mốc so sánh chỉ lấy từ tháng ĐẠT TỐI THIỂU {@link MAU_TOI_THIEU_THANG} bản ghi.
   * Bản đầu tiên không có ràng buộc này và cho ra baseline 100% cho mạng xã hội — lấy
   * từ một tháng năm 2018 có đúng MỘT thảo luận. Bảng khi đó hiện "giảm từ 100% xuống
   * 80%", nghe như dư luận đang xấu đi, trong khi thực chất là so với ý kiến của một
   * người. Không tháng nào đủ mẫu thì trả `null`: thà không có mốc so sánh còn hơn có
   * một mốc sai.
   */
  private async docGiaTriSacThai(): Promise<KpiMeasuredValue[]> {
    const ket_qua = await this.db.execute<{
      kpi_key: string;
      value: string | number | null;
      baseline: string | number | null;
    }>(sql`
      with bao_chi as (
        select
          round(100.0 * sum(so_tich_cuc) / nullif(sum(so_tin_bai), 0), 1) as toan_ky,
          (array_agg(ty_le_tich_cuc_pct order by thang)
            filter (where so_tin_bai >= ${MAU_TOI_THIEU_THANG}))[1]       as thang_dau
        from mart.mart__news_sentiment
      ),
      mang_xa_hoi as (
        select
          round(100.0 * sum(so_tich_cuc) / nullif(sum(so_thao_luan), 0), 1) as toan_ky,
          (array_agg(ty_le_tich_cuc_pct order by thang)
            filter (where so_thao_luan >= ${MAU_TOI_THIEU_THANG}))[1]       as thang_dau
        from mart.mart__social_sentiment
      )
      select 'positive_sentiment_share' as kpi_key,
             toan_ky as value, thang_dau as baseline
      from bao_chi
      union all
      select 'social_positive_sentiment_share' as kpi_key,
             toan_ky as value, thang_dau as baseline
      from mang_xa_hoi
    `);

    return this.thanhChiSo(ket_qua);
  }

  /**
   * Thị phần chú ý của Học viện, lấy tuần gần nhất so với tuần đầu kỳ.
   *
   * Mốc gốc là tuần ĐẦU của chuỗi chứ không phải tuần liền trước: chỉ số này dao động
   * mạnh theo tin tức tuần, so với tuần liền trước chỉ đo được nhiễu.
   */
  private async docGiaTriChuY(): Promise<KpiMeasuredValue[]> {
    const ket_qua = await this.db.execute<{
      kpi_key: string;
      value: string | number | null;
      baseline: string | number | null;
    }>(sql`
      with moc as (
        select min(tuan) as dau, max(tuan) as cuoi from mart.mart__brand_attention
      ),
      ptit as (
        select
          max(a.thi_phan_pct) filter (where a.tuan = m.cuoi) as tp_cuoi,
          max(a.thi_phan_pct) filter (where a.tuan = m.dau)  as tp_dau,
          max(a.so_luot_xem)  filter (where a.tuan = m.cuoi) as lx_cuoi,
          max(a.so_luot_xem)  filter (where a.tuan = m.dau)  as lx_dau
        from mart.mart__brand_attention a cross join moc m
        where a.ma_truong = 'ptit'
      )
      select 'attention_share' as kpi_key, tp_cuoi as value, tp_dau as baseline from ptit
      union all
      -- Lượt xem tuyệt đối, không phải tỷ trọng: đo mức quan tâm chứ không đo vị thế
      -- so với nhóm. Hai chỉ số có thể đi ngược chiều nhau khi cả nhóm cùng lên.
      select 'brand_search_index', lx_cuoi, lx_dau from ptit
    `);

    return this.thanhChiSo(ket_qua);
  }

  /**
   * Thị phần thảo luận trên báo chí, tháng gần nhất so với tháng liền trước.
   *
   * Khác với thị phần chú ý (so với tuần đầu kỳ): tin bài dồn theo mùa tuyển sinh nên
   * tháng liền trước là mốc so hợp lý hơn, và dữ liệu chỉ mới đủ vài tháng.
   */
  private async docGiaTriThaoLuan(): Promise<KpiMeasuredValue[]> {
    const ket_qua = await this.db.execute<{
      kpi_key: string;
      value: string | number | null;
      baseline: string | number | null;
    }>(sql`
      with du_mau as (
        -- Chỉ xét tháng đủ mẫu. Tháng lác đác vài bài cho ra tỷ trọng nhảy loạn, và
        -- tháng chỉ có một bài thì thị phần luôn là 100%.
        select distinct thang from mart.mart__share_of_voice where du_mau
      ),
      moc as (
        select
          max(thang)                                             as nay,
          (select max(thang) from du_mau where thang < (select max(thang) from du_mau)) as truoc
        from du_mau
      )
      select
        'share_of_voice' as kpi_key,
        max(s.thi_phan_pct) filter (where s.thang = m.nay)   as value,
        max(s.thi_phan_pct) filter (where s.thang = m.truoc) as baseline
      from mart.mart__share_of_voice s cross join moc m
      where s.ma_truong = 'ptit'
    `);

    return this.thanhChiSo(ket_qua);
  }

  private thanhChiSo(ket_qua: unknown): KpiMeasuredValue[] {
    const dong = Array.isArray(ket_qua)
      ? (ket_qua as {
          kpi_key: string;
          value: string | number | null;
          baseline: string | number | null;
        }[])
      : [];

    return dong.map((r) => ({
      kpiKey: r.kpi_key,
      value: r.value === null ? null : Number(r.value),
      baseline: r.baseline === null ? null : Number(r.baseline),
    }));
  }
}
