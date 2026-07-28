import { Controller, Get, Query } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import {
  ChannelsResponseSchema,
  OverviewResponseSchema,
  ReachResponseSchema,
  SentimentResponseSchema,
  SocialMentionsQuerySchema,
  SocialMentionsResponseSchema,
  type ChannelsResponse,
  type OverviewResponse,
  type ReachResponse,
  type SentimentResponse,
  type SocialMentionsQuery,
  type SocialMentionsResponse,
} from "@ptit/shared";
import { ZodOkResponse } from "../../common/openapi";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
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

  @Get("social-mentions")
  @ApiOperation({
    summary: "Từng ý kiến của người ngoài về Học viện",
    description:
      "Danh sách bình luận, bài đăng và chủ đề diễn đàn nhắc tới Học viện, kèm sắc thái đã chấm và link về nguồn gốc. " +
      "Sắp theo mức ưu tiên đọc: ý kiến tiêu cực trước, rồi tới ý kiến được nhiều người thích. " +
      "Tài khoản người viết đã được ẩn danh bằng mã băm ngay từ lúc thu thập.",
  })
  @ApiQuery({
    name: "sentiment",
    required: false,
    enum: ["positive", "neutral", "negative"],
    description: "Chỉ lấy ý kiến thuộc một sắc thái.",
  })
  @ApiQuery({
    name: "platform",
    required: false,
    enum: ["youtube", "reddit", "forum"],
    description: "Chỉ lấy ý kiến từ một nền tảng.",
  })
  @ApiQuery({
    name: "limit",
    required: false,
    schema: { type: "integer", minimum: 1, maximum: 200, default: 50 },
    description:
      "Số dòng tối đa. Trần 200 vì đây là danh sách để đọc, không phải để xuất dữ liệu.",
  })
  @ZodOkResponse(
    SocialMentionsResponseSchema,
    "Danh sách ý kiến kèm sắc thái và mẫu số của bộ lọc",
  )
  getSocialMentions(
    // Kiểm ở biên bằng ĐÚNG pipe của dự án, không gọi `.parse()` trần: `.parse()` ném
    // `ZodError`, và Nest không biết lỗi đó là lỗi của người gửi nên trả 500. Một tham
    // số gõ sai phải là 400 kèm chỉ rõ trường nào sai, không phải "lỗi máy chủ".
    @Query(new ZodValidationPipe(SocialMentionsQuerySchema))
    query: SocialMentionsQuery,
  ): Promise<SocialMentionsResponse> {
    return this.dashboardService.getSocialMentions(query);
  }
}
