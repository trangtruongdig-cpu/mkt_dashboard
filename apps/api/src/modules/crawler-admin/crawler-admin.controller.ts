import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  CrawlerOverviewSchema,
  CrawlerRunListSchema,
  CrawlerRunSchema,
  CrawlerSourceListSchema,
  CrawlerSourceSchema,
  UpdateCrawlerSourceSchema,
  type CrawlerOverview,
  type CrawlerRun,
  type CrawlerRunList,
  type CrawlerSource,
  type CrawlerSourceList,
  type Session,
  type UpdateCrawlerSource,
} from "@ptit/shared";
import { ZodOkResponse } from "../../common/openapi";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { AuthGuard, CurrentSession } from "../auth/auth.guard";
import { CrawlerAdminService } from "./crawler-admin.service";

/**
 * Điều khiển việc thu thập tin bài.
 *
 * Toàn bộ endpoint đều sau `AuthGuard` — không có phiên quản trị viên thì 401.
 */
@ApiTags("Quản trị — Thu thập tin bài")
@Controller("v1/admin/crawler")
@UseGuards(AuthGuard)
export class CrawlerAdminController {
  constructor(private readonly service: CrawlerAdminService) {}

  @Get("overview")
  @ApiOperation({ summary: "Tổng quan tình trạng thu thập tin bài" })
  @ZodOkResponse(CrawlerOverviewSchema, "Số nguồn đang bật, tổng số bài, lượt chạy gần nhất")
  getOverview(): Promise<CrawlerOverview> {
    return this.service.getOverview();
  }

  @Get("sources")
  @ApiOperation({ summary: "Danh sách nguồn thu thập và trạng thái bật/tắt của từng nguồn" })
  @ZodOkResponse(CrawlerSourceListSchema, "Toàn bộ nguồn đã khai báo")
  async listSources(): Promise<CrawlerSourceList> {
    return { sources: await this.service.listSources() };
  }

  @Patch("sources/:id")
  @ApiOperation({
    summary: "Bật/tắt một nguồn hoặc đổi lịch chạy của nó",
    description:
      "Thay đổi ghi thẳng vào PostgreSQL. Worker đọc lại cấu hình trước mỗi lượt chạy " +
      "nên không cần khởi động lại worker.",
  })
  @ZodOkResponse(CrawlerSourceSchema, "Nguồn sau khi sửa")
  updateSource(
    @Param("id", ParseIntPipe) id: number,
    @Body(new ZodValidationPipe(UpdateCrawlerSourceSchema)) body: UpdateCrawlerSource,
    @CurrentSession() session: Session,
  ): Promise<CrawlerSource> {
    return this.service.updateSource(id, body, session.user.username);
  }

  @Get("runs")
  @ApiOperation({ summary: "Nhật ký các lượt thu thập gần đây" })
  @ZodOkResponse(CrawlerRunListSchema, "30 lượt chạy gần nhất")
  async listRuns(): Promise<CrawlerRunList> {
    return { runs: await this.service.listRuns() };
  }

  @Post("runs")
  @ApiOperation({
    summary: "Chạy thu thập ngay, không đợi lịch",
    description:
      "Xếp một lượt chạy vào hàng đợi trong PostgreSQL; worker nhặt lên ở lần quét kế tiếp. " +
      "Trả 409 nếu đang có lượt khác chờ hoặc đang chạy.",
  })
  @ZodOkResponse(CrawlerRunSchema, "Lượt chạy vừa được xếp hàng")
  requestRunAll(@CurrentSession() session: Session): Promise<CrawlerRun> {
    return this.service.requestRun(null, session.user.username);
  }

  @Post("sources/:id/runs")
  @ApiOperation({ summary: "Chạy thu thập ngay cho riêng một nguồn" })
  @ZodOkResponse(CrawlerRunSchema, "Lượt chạy vừa được xếp hàng")
  requestRunOne(
    @Param("id", ParseIntPipe) id: number,
    @CurrentSession() session: Session,
  ): Promise<CrawlerRun> {
    return this.service.requestRun(id, session.user.username);
  }
}
