import { Injectable } from "@nestjs/common";
import {
  buildDemoDataset,
  type ChannelsResponse,
  type OverviewResponse,
  type ReachResponse,
  type SentimentResponse,
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
}
