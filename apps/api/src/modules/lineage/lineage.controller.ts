import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { DataLineageResponseSchema, type DataLineageResponse } from "@ptit/shared";
import { ZodOkResponse } from "../../common/openapi";
import { LineageService } from "./lineage.service";

@ApiTags("Đường ống dữ liệu")
@Controller("v1")
export class LineageController {
  constructor(private readonly lineageService: LineageService) {}

  @Get("data-lineage")
  @ApiOperation({
    summary: "Bản đồ đường ống dữ liệu",
    description:
      "Toàn bộ chặng đường từ bảng thô tới con số trên màn hình: bảng nào có bao nhiêu dòng, " +
      "chảy vào bảng nào, và chỉ số nào đọc bảng nào. Kèm vài dòng dữ liệu thật của các bảng " +
      "nguồn CÔNG KHAI — bảng chứa dữ liệu vận hành của Học viện không bao giờ được lấy mẫu.",
  })
  @ZodOkResponse(
    DataLineageResponseSchema,
    "Bản đồ đường ống kèm số dòng và dữ liệu mẫu",
  )
  getLineage(): Promise<DataLineageResponse> {
    return this.lineageService.getLineage();
  }
}
