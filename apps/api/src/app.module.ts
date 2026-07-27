import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validateEnv } from "./config/env";
import { DbModule } from "./db/db.module";
import { DashboardModule } from "./modules/dashboard/dashboard.module";
import { HealthModule } from "./modules/health/health.module";
import { IntegrationsModule } from "./modules/integrations/integrations.module";
import { KpiModule } from "./modules/kpi/kpi.module";

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
  ],
})
export class AppModule {}
