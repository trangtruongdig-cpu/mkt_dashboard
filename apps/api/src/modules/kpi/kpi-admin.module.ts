import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { KpiAdminController } from "./kpi-admin.controller";
import { KpiModule } from "./kpi.module";

/**
 * Phần ghi của domain mục tiêu/KPI. Chỉ nạp khi có cơ sở dữ liệu và mật khẩu quản trị.
 *
 * Dùng lại `KpiService` của `KpiModule` thay vì dựng service riêng: đường đọc và đường
 * ghi phải chia nhau cùng một chỗ kiểm tra khoá chỉ số và cùng một `applyTargetOverrides`.
 */
@Module({
  imports: [AuthModule, KpiModule],
  controllers: [KpiAdminController],
})
export class KpiAdminModule {}
