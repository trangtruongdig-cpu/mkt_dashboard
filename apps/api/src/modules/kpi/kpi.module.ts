import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../config/env";
import { DB, type Database } from "../../db/db.module";
import { KpiController } from "./kpi.controller";
import { DemoKpiRepository, KpiRepository } from "./kpi.repository";
import { KpiService } from "./kpi.service";
import { PostgresKpiRepository } from "./postgres-kpi.repository";

@Module({
  controllers: [KpiController],
  providers: [
    KpiService,
    /**
     * Nguồn dữ liệu chọn theo biến môi trường `DATA_SOURCE`:
     *
     *   demo     — số liệu giả lập trong @ptit/shared, chạy được ngay khi chưa có kho
     *   postgres — đọc các bảng `mart__*` do dbt sinh ra
     *
     * Chọn ở tầng module chứ không kiểm tra rải rác trong service: service không cần
     * biết dữ liệu đến từ đâu, và đổi nguồn không phải sửa một dòng logic nào.
     */
    {
      provide: KpiRepository,
      inject: [ConfigService, DB],
      useFactory: (
        config: ConfigService<Env, true>,
        db: Database,
      ): KpiRepository =>
        config.get("DATA_SOURCE", { infer: true }) === "postgres"
          ? new PostgresKpiRepository(db)
          : new DemoKpiRepository(),
    },
  ],
})
export class KpiModule {}
