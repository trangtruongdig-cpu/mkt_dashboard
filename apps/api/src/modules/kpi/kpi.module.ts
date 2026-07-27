import { Module } from "@nestjs/common";
import { KpiController } from "./kpi.controller";
import { DemoKpiRepository, KpiRepository } from "./kpi.repository";
import { KpiService } from "./kpi.service";

@Module({
  controllers: [KpiController],
  providers: [
    KpiService,
    // Đổi sang PostgresKpiRepository khi worker đã hút đủ dữ liệu và dbt đã dựng mart.
    { provide: KpiRepository, useClass: DemoKpiRepository },
  ],
})
export class KpiModule {}
