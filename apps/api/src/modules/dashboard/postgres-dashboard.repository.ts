import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  buildDemoDataset,
  MIN_CONFIDENCE,
  MIN_MONTHLY_SAMPLE,
  type ChannelsResponse,
  type MentionFunnelStage,
  type OverviewResponse,
  type ReachResponse,
  type SentimentByMonth,
  type SentimentResponse,
  type SocialMention,
  type SocialMentionsQuery,
  type SocialMentionsResponse,
} from "@ptit/shared";
import { sql, type SQL } from "drizzle-orm";
import { DB, type Database } from "../../db/db.module";
import { DashboardRepository } from "./dashboard.repository";

/**
 * Đọc dữ liệu thật của dashboard từ các bảng `mart__*` do dbt sinh ra.
 *
 * Hiện mới nối được phần SẮC THÁI. Ba phần còn lại vẫn trả dữ liệu giả lập và điều đó
 * được nói thẳng ra, không che: mỗi phần nối thật là thay đúng một hàm ở đây.
 *
 * Không khai bảng mart thành Drizzle schema: chúng do dbt sở hữu. Khai vào đây là mở
 * đường cho drizzle-kit sinh migration đòi xoá chúng.
 */
@Injectable()
export class PostgresDashboardRepository extends DashboardRepository {
  private readonly logger = new Logger(PostgresDashboardRepository.name);

  constructor(@Inject(DB) private readonly db: Database) {
    super();
  }

  async getOverview(): Promise<OverviewResponse> {
    return buildDemoDataset().overview;
  }

  async getReach(): Promise<ReachResponse> {
    return buildDemoDataset().reach;
  }

  async getChannels(): Promise<ChannelsResponse> {
    return buildDemoDataset().channels;
  }

  /**
   * Sắc thái thảo luận của NGƯỜI NGOÀI, đọc từ `mart__social_sentiment`.
   *
   * Chọn nguồn mạng xã hội chứ không phải báo chí cho biểu đồ này vì câu hỏi mà khối
   * này trả lời là "người khác nói gì về Học viện". Sắc thái báo chí có chỉ số riêng
   * trên cascade (`positive_sentiment_share`) và không trộn vào đây — hai kho được chấm
   * bằng hai model khác nhau, đọc như cùng một thang đo là sai.
   *
   * Kho rỗng thì quay về dữ liệu giả lập và ghi cảnh báo. Trả về một biểu đồ trống
   * không kèm lời giải thích là cách nhanh nhất để người xem tưởng hệ thống hỏng.
   */
  async getSentiment(): Promise<SentimentResponse> {
    try {
      const dong = await this.db.execute<{
        thang: string;
        phien_ban_model: string;
        so_thao_luan: string | number;
        so_tich_cuc: string | number;
        so_trung_tinh: string | number;
        so_tieu_cuc: string | number;
      }>(sql`
        select thang, phien_ban_model, so_thao_luan, so_tich_cuc, so_trung_tinh, so_tieu_cuc
        from mart.mart__social_sentiment
        order by thang
      `);

      const rows = Array.from(dong as Iterable<(typeof dong)[number]>);
      const cuoi = rows.at(-1);
      if (!cuoi) throw new Error("mart__social_sentiment chưa có dòng nào");

      const byMonth: SentimentByMonth[] = rows.map((r) => {
        const moc = new Date(r.thang);
        const thang = String(moc.getUTCMonth() + 1).padStart(2, "0");
        return {
          monthLabel: `${thang}/${moc.getUTCFullYear()}`,
          monthStart: moc.toISOString().slice(0, 10),
          total: Number(r.so_thao_luan),
          positive: Number(r.so_tich_cuc),
          neutral: Number(r.so_trung_tinh),
          negative: Number(r.so_tieu_cuc),
        };
      });

      const cong = (lay: (m: SentimentByMonth) => number) =>
        byMonth.reduce((acc, m) => acc + lay(m), 0);

      // `rows` đã được kiểm tra không rỗng ở trên, nên hai mốc này luôn tồn tại.
      const dau = byMonth[0] as SentimentByMonth;
      const cuoiThang = byMonth.at(-1) as SentimentByMonth;

      return {
        period: {
          from: dau.monthStart,
          to: cuoiThang.monthStart,
          label: `${byMonth.length} tháng có dữ liệu`,
        },
        source: "social",
        modelVersion: cuoi.phien_ban_model,
        totalMentions: cong((m) => m.total),
        total: {
          positive: cong((m) => m.positive),
          neutral: cong((m) => m.neutral),
          negative: cong((m) => m.negative),
        },
        byMonth,
        // Ngưỡng dùng chung ở @ptit/shared — cùng một con số với KPI repository và với
        // biểu đồ. Xem MIN_MONTHLY_SAMPLE để biết vì sao là 10.
        minSampleForTrend: MIN_MONTHLY_SAMPLE,
      };
    } catch (loi) {
      this.logger.warn(
        `Không đọc được mart__social_sentiment, quay về dữ liệu giả lập: ${
          loi instanceof Error ? loi.message : String(loi)
        }`,
      );
      return buildDemoDataset().sentiment;
    }
  }

  /**
   * Danh sách ý kiến đọc được, từ `mart__social_mention`.
   *
   * Sắp theo `thu_tu_uu_tien` trước rồi mới tới lượt thích và thời gian: sắp theo thời
   * gian sẽ chôn lời phàn nàn quan trọng nhất xuống dưới mười lời khen đăng sau nó, và
   * người mở dashboard trong năm phút sẽ không bao giờ cuộn tới chỗ đó.
   *
   * `counts` đếm trên TOÀN BỘ phần khớp bộ lọc, không phải trên phần đã cắt theo `limit`.
   * Trả về số đếm của trang hiện tại là cách nhanh nhất để "3 tiêu cực" trên thẻ tóm tắt
   * mâu thuẫn với 12 dòng tiêu cực ngay bên dưới.
   *
   * KHÔNG có bản giả lập dự phòng: kho hỏng thì ném lỗi để tầng trên biết. Bịa ra những
   * câu như thể có người thật viết chúng về Học viện là dựng lời cho người không nói.
   */
  async getSocialMentions(
    query: SocialMentionsQuery,
  ): Promise<SocialMentionsResponse> {
    const dieu_kien: SQL[] = [];
    if (query.sentiment) {
      dieu_kien.push(sql`sac_thai = ${query.sentiment}`);
    }
    if (query.platform) {
      dieu_kien.push(sql`nen_tang = ${query.platform}`);
    }
    // `sql.join` tham số hoá từng mảnh, không nối chuỗi — giá trị lọc đến từ người dùng.
    const loc =
      dieu_kien.length > 0
        ? sql`where ${sql.join(dieu_kien, sql` and `)}`
        : sql``;

    const dong = await this.db.execute<{
      ma_thao_luan: string;
      nen_tang: string;
      ten_nguon: string;
      hat_du_lieu: string;
      duong_dan: string | null;
      noi_dung: string;
      thoi_diem: string;
      thoi_diem_la_uoc_luong: boolean;
      so_luot_thich: string | number;
      phien_ban_model: string;
      sac_thai: string;
      do_chac_chan: string | number;
      da_bi_cat: boolean;
      diem_tich_cuc: string | number;
      diem_trung_tinh: string | number;
      diem_tieu_cuc: string | number;
      ma_tac_gia: string | null;
      cach_phat_hien: string;
      tu_khoa_tim: string | null;
      lan_dau_thay: string;
    }>(sql`
      select ma_thao_luan, nen_tang, ten_nguon, hat_du_lieu, duong_dan, noi_dung,
             thoi_diem, thoi_diem_la_uoc_luong, so_luot_thich, phien_ban_model,
             sac_thai, do_chac_chan, da_bi_cat,
             diem_tich_cuc, diem_trung_tinh, diem_tieu_cuc,
             ma_tac_gia, cach_phat_hien, tu_khoa_tim, lan_dau_thay
      from mart.mart__social_mention
      ${loc}
      order by thu_tu_uu_tien, so_luot_thich desc, thoi_diem desc
      limit ${query.limit}
    `);

    const tong = await this.db.execute<{
      sac_thai: string;
      so: string | number;
    }>(sql`
      select sac_thai, count(*) as so
      from mart.mart__social_mention
      ${loc}
      group by sac_thai
    `);

    const rows = Array.from(dong as Iterable<(typeof dong)[number]>);
    const dem = Array.from(tong as Iterable<(typeof tong)[number]>);

    const counts = { positive: 0, neutral: 0, negative: 0 };
    for (const r of dem) {
      if (r.sac_thai in counts) {
        counts[r.sac_thai as keyof typeof counts] = Number(r.so);
      }
    }
    const totalMatching = counts.positive + counts.neutral + counts.negative;

    const mentions: SocialMention[] = rows.map((r) => ({
      key: r.ma_thao_luan,
      platform: r.nen_tang as SocialMention["platform"],
      sourceName: r.ten_nguon,
      contentType: r.hat_du_lieu as SocialMention["contentType"],
      url: r.duong_dan,
      text: r.noi_dung,
      occurredAt: new Date(r.thoi_diem).toISOString(),
      occurredAtEstimated: r.thoi_diem_la_uoc_luong,
      likeCount: Number(r.so_luot_thich),
      sentiment: r.sac_thai as SocialMention["sentiment"],
      confidence: Number(r.do_chac_chan),
      truncated: r.da_bi_cat,
      provenance: {
        mentionKey: r.ma_thao_luan,
        authorRef: r.ma_tac_gia,
        discoveredVia: r.cach_phat_hien,
        searchTerm: r.tu_khoa_tim,
        firstSeenAt: new Date(r.lan_dau_thay).toISOString(),
        scores: {
          positive: Number(r.diem_tich_cuc),
          neutral: Number(r.diem_trung_tinh),
          negative: Number(r.diem_tieu_cuc),
        },
      },
    }));

    const moc = rows.map((r) => new Date(r.thoi_diem).getTime());
    const funnel = await this.docPhezLoc();

    return {
      period: {
        from: moc.length
          ? new Date(Math.min(...moc)).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10),
        to: moc.length
          ? new Date(Math.max(...moc)).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10),
        label: `${totalMatching} ý kiến khớp bộ lọc`,
      },
      modelVersion: rows[0]?.phien_ban_model ?? "chưa có bản ghi nào",
      totalMatching,
      counts,
      mentions,
      confidenceThreshold: MIN_CONFIDENCE,
      funnel,
    };
  }

  /**
   * Phễu từ dữ liệu thô tới danh sách đang hiển thị, đếm SỐNG trên kho.
   *
   * Không hằng hoá bốn con số trong mã: chúng đổi mỗi lần worker chạy, và một phễu ghi
   * số cũ còn tệ hơn không có phễu — người xem tin vào nó rồi kết luận sai về độ phủ.
   *
   * Đếm không phụ thuộc bộ lọc người dùng đang chọn: đây là phễu của CẢ KHO, trả lời câu
   * "hệ thống thu được bao nhiêu và loại đi những gì".
   */
  private async docPhezLoc(): Promise<MentionFunnelStage[]> {
    const kq = await this.db.execute<{
      thu_ve: string | number;
      mang_y_kien: string | number;
      da_cham: string | number;
      con_lai: string | number;
    }>(sql`
      select
        (select count(*) from raw.raw_social_mention)                        as thu_ve,
        (select count(*) from raw.raw_social_mention
          where content_type in ('comment', 'post', 'thread'))               as mang_y_kien,
        (select count(*) from raw.social_sentiment)                          as da_cham,
        (select count(*) from mart.mart__social_mention)                     as con_lai
    `);

    const r = Array.from(kq as Iterable<(typeof kq)[number]>)[0];
    if (!r) throw new Error("không đếm được phễu xử lý");

    return [
      {
        key: "thu_ve",
        label: "Thu về từ nền tảng",
        count: Number(r.thu_ve),
        note: null,
      },
      {
        key: "mang_y_kien",
        label: "Hạt mang ý kiến",
        count: Number(r.mang_y_kien),
        note: "Bỏ video: tiêu đề và mô tả là lời giới thiệu của người làm nội dung, không phải nhận xét về Học viện.",
      },
      {
        key: "da_cham",
        label: "Đã chấm sắc thái",
        count: Number(r.da_cham),
        note: "Bỏ bản ghi quá ngắn — một emoji hay chữ “ok” không đủ ngữ liệu để chấm.",
      },
      {
        key: "con_lai",
        label: "Vào báo cáo dư luận",
        count: Number(r.con_lai),
        note: "Bỏ nội dung do chính kênh đăng: bình luận của chủ kênh dưới video của mình là lời người làm video, không phải khán giả.",
      },
    ];
  }
}
