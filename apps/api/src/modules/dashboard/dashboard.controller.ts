import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
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
import { ZodOkResponse } from "../../common/openapi";
import { DashboardService } from "./dashboard.service";

@ApiTags("Dashboard")
@Controller("v1")
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get("overview")
  @ApiOperation({
    summary: "Chỉ số tổng quan",
    description:
      "Trả về chỉ số dẫn dắt và các ô chỉ số của kỳ báo cáo hiện hành.",
  })
  @ZodOkResponse(OverviewResponseSchema, "Chỉ số tổng quan của kỳ báo cáo")
  getOverview(): Promise<OverviewResponse> {
    return this.dashboardService.getOverview();
  }

  @Get("reach")
  @ApiOperation({
    summary: "Lượt tiếp cận theo ngày",
    description:
      "Chuỗi thời gian lượt tiếp cận, tối đa 3 kênh để bảo đảm phân biệt được màu cho người mù màu.",
  })
  @ZodOkResponse(ReachResponseSchema, "Chuỗi thời gian lượt tiếp cận theo kênh")
  getReach(): Promise<ReachResponse> {
    return this.dashboardService.getReach();
  }

  @Get("channels")
  @ApiOperation({
    summary: "Hiệu quả theo kênh",
    description:
      "Tiếp cận, tương tác và số hồ sơ đăng ký xét tuyển quy về từng kênh.",
  })
  @ZodOkResponse(ChannelsResponseSchema, "Bảng hiệu quả từng kênh")
  getChannels(): Promise<ChannelsResponse> {
    return this.dashboardService.getChannels();
  }

  @Get("sentiment")
  @ApiOperation({
    summary: "Sắc thái thảo luận",
    description:
      "Phân bố tích cực / trung tính / tiêu cực, kèm phiên bản mô hình đã chấm.",
  })
  @ZodOkResponse(SentimentResponseSchema, "Phân bố sắc thái thảo luận")
  getSentiment(): Promise<SentimentResponse> {
    return this.dashboardService.getSentiment();
  }
}
