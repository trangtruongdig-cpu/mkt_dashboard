import { Module } from "@nestjs/common";
import { DashboardController } from "./dashboard.controller";
import {
  DashboardRepository,
  DemoDashboardRepository,
} from "./dashboard.repository";
import { DashboardService } from "./dashboard.service";

@Module({
  controllers: [DashboardController],
  providers: [
    DashboardService,
    // Đổi sang PostgresDashboardRepository khi đã có dữ liệu thật từ dbt.
    { provide: DashboardRepository, useClass: DemoDashboardRepository },
  ],
})
export class DashboardModule {}
