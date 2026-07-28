import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  buildDemoDataset,
  type ChannelsResponse,
  type OverviewResponse,
  type ReachResponse,
  type SentimentByMonth,
  type SentimentResponse,
} from "@ptit/shared";
import { sql } from "drizzle-orm";
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
        // Dưới 10 thảo luận thì tỷ lệ của tháng đó chỉ phản ánh vài người. Ngưỡng này đi
        // theo dữ liệu để giao diện không tự đặt một ngưỡng khác.
        minSampleForTrend: 10,
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
}
