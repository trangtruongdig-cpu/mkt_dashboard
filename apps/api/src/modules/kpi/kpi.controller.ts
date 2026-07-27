import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  KpiCascadeResponseSchema,
  ShareOfSearchResponseSchema,
  type KpiCascadeResponse,
  type ShareOfSearchResponse,
} from "@ptit/shared";
import { ZodOkResponse } from "../../common/openapi";
import { KpiService } from "./kpi.service";

@ApiTags("Mục tiêu và KPI")
@Controller("v1")
export class KpiController {
  constructor(private readonly kpiService: KpiService) {}

  @Get("kpi-cascade")
  @ApiOperation({
    summary: "Cây mục tiêu và chỉ số",
    description:
      "Trả về toàn bộ chuỗi suy diễn mục tiêu kinh doanh → marketing → truyền thông, " +
      "kèm các chỉ số gắn với từng mục tiêu. Mỗi chỉ số bắt buộc có xuất xứ dữ liệu " +
      "để truy vết được về nguồn công khai đã sinh ra nó.",
  })
  @ZodOkResponse(
    KpiCascadeResponseSchema,
    "Cây mục tiêu ba tầng kèm chỉ số đo của từng mục tiêu",
  )
  getCascade(): Promise<KpiCascadeResponse> {
    return this.kpiService.getCascade();
  }

  @Get("share-of-search")
  @ApiOperation({
    summary: "Thị phần tìm kiếm theo tuần",
    description:
      "Tỷ trọng mức độ quan tâm tìm kiếm của Học viện so với nhóm trường đối sánh, " +
      "lấy từ Google Trends. Đây là tín hiệu sớm của kết quả tuyển sinh: nó biến động " +
      "theo tuần trong khi số liệu nhập học mỗi năm mới công bố một lần.",
  })
  @ZodOkResponse(
    ShareOfSearchResponseSchema,
    "Chuỗi thị phần tìm kiếm theo tuần và xếp hạng kỳ gần nhất",
  )
  getShareOfSearch(): Promise<ShareOfSearchResponse> {
    return this.kpiService.getShareOfSearch();
  }
}
