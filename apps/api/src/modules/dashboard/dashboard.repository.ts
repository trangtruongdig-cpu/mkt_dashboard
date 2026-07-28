import { Injectable } from "@nestjs/common";
import {
  buildDemoDataset,
  MIN_CONFIDENCE,
  type ChannelsResponse,
  type OverviewResponse,
  type ReachResponse,
  type SentimentResponse,
  type SocialMentionsQuery,
  type SocialMentionsResponse,
} from "@ptit/shared";

/**
 * Hợp đồng truy cập dữ liệu của dashboard.
 *
 * Khi đấu nối dữ liệu thật, thêm `PostgresDashboardRepository` đọc các bảng
 * `mart__*` bằng SQL thuần và đổi provider trong `DashboardModule` — tầng
 * service và controller không phải sửa gì.
 */
export abstract class DashboardRepository {
  abstract getOverview(): Promise<OverviewResponse>;
  abstract getReach(): Promise<ReachResponse>;
  abstract getChannels(): Promise<ChannelsResponse>;
  abstract getSentiment(): Promise<SentimentResponse>;
  abstract getSocialMentions(
    query: SocialMentionsQuery,
  ): Promise<SocialMentionsResponse>;
}

/** Nguồn dữ liệu GIẢ LẬP cho giai đoạn demo giao diện. */
@Injectable()
export class DemoDashboardRepository extends DashboardRepository {
  async getOverview(): Promise<OverviewResponse> {
    return buildDemoDataset().overview;
  }

  async getReach(): Promise<ReachResponse> {
    return buildDemoDataset().reach;
  }

  async getChannels(): Promise<ChannelsResponse> {
    return buildDemoDataset().channels;
  }

  async getSentiment(): Promise<SentimentResponse> {
    return buildDemoDataset().sentiment;
  }

  /**
   * Danh sách ý kiến KHÔNG có bản giả lập.
   *
   * Ba khối kia bịa được vì chúng là con số tổng hợp — người xem đọc chúng như xu hướng,
   * và bảng đã ghi rõ "Nguồn: số liệu giả lập". Nhưng bịa ra những câu như thể có người
   * thật đã viết chúng về Học viện thì khác hẳn: đó là dựng lời cho người không nói.
   * Không có kho thì trả danh sách rỗng, và giao diện nói rõ vì sao rỗng.
   */
  async getSocialMentions(
    _query: SocialMentionsQuery,
  ): Promise<SocialMentionsResponse> {
    const { period } = buildDemoDataset().sentiment;
    return {
      period,
      modelVersion: "chưa có kho dữ liệu",
      totalMatching: 0,
      counts: { positive: 0, neutral: 0, negative: 0 },
      mentions: [],
      confidenceThreshold: MIN_CONFIDENCE,
    };
  }
}
