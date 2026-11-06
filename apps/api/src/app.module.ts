import { Module, type Type } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { loadEnv, validateEnv } from "./config/env";
import { DbModule } from "./db/db.module";
import { AuthModule } from "./modules/auth/auth.module";
import { CrawlerAdminModule } from "./modules/crawler-admin/crawler-admin.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { HealthModule } from "./modules/health/health.module";
import { IntegrationsModule } from "./modules/integrations/integrations.module";
import { KpiAdminModule } from "./modules/kpi/kpi-admin.module";
import { KpiModule } from "./modules/kpi/kpi.module";
import { LineageModule } from "./modules/lineage/lineage.module";

/**
 * Phần quản trị chỉ nạp khi có đủ DATABASE_URL và ADMIN_PASSWORD.
 *
 * Nạp có điều kiện chứ không nạp vô điều kiện vì bản demo chạy mà không có cơ sở dữ
 * liệu: nạp vào thì `AuthRepository` sẽ ngã lúc khởi động. Nhưng "có điều kiện" không
 * được hiểu thành "không nạp bao giờ" — trước đây hai module này không có mặt trong
 * danh sách `imports`, nên `/api/v1/auth/*` và `/api/v1/admin/*` trả 404 dù đã viết
 * xong, và trang /dang-nhap lẫn /quan-tri không thể hoạt động.
 */
function moduleQuanTri(): Type<unknown>[] {
  const env = loadEnv();
  if (!env.DATABASE_URL || !env.ADMIN_PASSWORD) return [];
  return [AuthModule, CrawlerAdminModule, KpiAdminModule];
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    // Phạm vi Global — KpiModule cần kết nối khi DATA_SOURCE=postgres.
    DbModule,
    HealthModule,
    DashboardModule,
    IntegrationsModule,
    KpiModule,
    LineageModule,
    ...moduleQuanTri(),
  ],
})
export class AppModule {}
