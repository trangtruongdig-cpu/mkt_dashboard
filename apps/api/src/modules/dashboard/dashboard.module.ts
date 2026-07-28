import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../config/env";
import { DB, type Database } from "../../db/db.module";
import { DashboardController } from "./dashboard.controller";
import {
  DashboardRepository,
  DemoDashboardRepository,
} from "./dashboard.repository";
import { DashboardService } from "./dashboard.service";
import { PostgresDashboardRepository } from "./postgres-dashboard.repository";

@Module({
  controllers: [DashboardController],
  providers: [
    DashboardService,
    /**
     * Cùng cần gạt chọn nguồn với `KpiModule` — biến môi trường `DATA_SOURCE`.
     * Dùng chung một cần gạt để không bao giờ xảy ra cảnh cascade đọc số thật mà biểu
     * đồ ngay bên cạnh vẫn vẽ số giả lập.
     */
    {
      provide: DashboardRepository,
      inject: [ConfigService, DB],
      useFactory: (
        config: ConfigService<Env, true>,
        db: Database,
      ): DashboardRepository =>
        config.get("DATA_SOURCE", { infer: true }) === "postgres"
          ? new PostgresDashboardRepository(db)
          : new DemoDashboardRepository(),
    },
  ],
})
export class DashboardModule {}
