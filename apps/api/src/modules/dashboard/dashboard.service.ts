import { Injectable } from "@nestjs/common";
import {
  ChannelsResponseSchema,
  OverviewResponseSchema,
  ReachResponseSchema,
  SentimentResponseSchema,
  type ChannelsResponse,
  type OverviewResponse,
  type ReachResponse,
  type SentimentResponse,
} from "@ptit/shared";
import { DashboardRepository } from "./dashboard.repository";

/**
 * Mọi giá trị trả ra đều đi qua `parse` của zod schema dùng chung.
 *
 * Kiểm tra ở đầu ra chứ không chỉ ở đầu vào: nếu một model dbt đổi cột mà quên
 * cập nhật hợp đồng, API sẽ báo lỗi ngay thay vì lặng lẽ trả dữ liệu thiếu cho
 * frontend.
 */
@Injectable()
export class DashboardService {
  constructor(private readonly repository: DashboardRepository) {}

  async getOverview(): Promise<OverviewResponse> {
    return OverviewResponseSchema.parse(await this.repository.getOverview());
  }

  async getReach(): Promise<ReachResponse> {
    return ReachResponseSchema.parse(await this.repository.getReach());
  }

  async getChannels(): Promise<ChannelsResponse> {
    return ChannelsResponseSchema.parse(await this.repository.getChannels());
  }

  async getSentiment(): Promise<SentimentResponse> {
    return SentimentResponseSchema.parse(await this.repository.getSentiment());
  }
}
