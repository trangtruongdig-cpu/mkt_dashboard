import {
  Body,
  Controller,
  Delete,
  Param,
  Patch,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  KpiTargetOverrideListSchema,
  UpdateKpiTargetSchema,
  type KpiTargetOverrideList,
  type Session,
  type UpdateKpiTarget,
} from "@ptit/shared";
import { ZodOkResponse } from "../../common/openapi";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { AuthGuard, CurrentSession } from "../auth/auth.guard";
import { KpiService } from "./kpi.service";

/**
 * Sửa mức cần đạt của chỉ số.
 *
 * Tách khỏi `KpiController` vì toàn bộ endpoint ở đây nằm sau `AuthGuard`, còn các
 * endpoint đọc cây mục tiêu vẫn phải mở cho người xem. Tách module cũng để phần quản
 * trị không bị nạp khi chạy bản demo không có cơ sở dữ liệu — xem `app.module.ts`.
 *
 * Trước đây phần này là một route handler của Next.js ghi ra `data/kpi-targets.json`
 * kèm `updatedBy = "chưa xác thực"`. Nay mỗi lần sửa đều gắn đúng tên người đăng nhập.
 */
@ApiTags("Quản trị — Mục tiêu và KPI")
@Controller("v1/admin/kpi-targets")
@UseGuards(AuthGuard)
export class KpiAdminController {
  constructor(private readonly kpiService: KpiService) {}

  @Patch(":kpiKey")
  @ApiOperation({
    summary: "Sửa mức cần đạt của một chỉ số",
    description:
      "Bắt buộc kèm căn cứ (`targetRationale`) — sửa mức cần đạt là sửa cam kết của Học viện, " +
      "người đọc sau phải tranh luận lại được với con số. Trạng thái đúng hướng / chệch hướng " +
      "KHÔNG nhận từ phía gửi: máy chủ tự tính lại từ giá trị hiện tại và mức mới. " +
      "Gọi lại nhiều lần cùng tham số cho ra đúng một bản ghi. Trả 404 nếu khoá chỉ số " +
      "không có trong cây mục tiêu.",
  })
  @ZodOkResponse(KpiTargetOverrideListSchema, "Toàn bộ bản ghi đè sau khi sửa")
  saveTarget(
    @Param("kpiKey") kpiKey: string,
    @Body(new ZodValidationPipe(UpdateKpiTargetSchema)) body: UpdateKpiTarget,
    @CurrentSession() session: Session,
  ): Promise<KpiTargetOverrideList> {
    return this.kpiService.saveTarget(kpiKey, body, session.user.username);
  }

  @Delete(":kpiKey")
  @ApiOperation({
    summary: "Gỡ bản ghi đè, đưa mức cần đạt về mặc định trong mã nguồn",
    description: "Trả 404 nếu chỉ số đó vốn chưa từng bị sửa.",
  })
  @ZodOkResponse(KpiTargetOverrideListSchema, "Toàn bộ bản ghi đè còn lại")
  removeTarget(
    @Param("kpiKey") kpiKey: string,
  ): Promise<KpiTargetOverrideList> {
    return this.kpiService.removeTarget(kpiKey);
  }
}
