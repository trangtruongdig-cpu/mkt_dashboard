import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../config/env";
import { DB, type Database } from "../../db/db.module";
import { LineageController } from "./lineage.controller";
import {
  LineageRepository,
  PostgresLineageRepository,
  StaticLineageRepository,
} from "./lineage.repository";
import { LineageService } from "./lineage.service";

@Module({
  controllers: [LineageController],
  providers: [
    LineageService,
    {
      provide: LineageRepository,
      inject: [ConfigService, DB],
      useFactory: (
        config: ConfigService<Env, true>,
        db: Database,
      ): LineageRepository =>
        config.get("DATA_SOURCE", { infer: true }) === "postgres"
          ? new PostgresLineageRepository(db)
          : new StaticLineageRepository(),
    },
  ],
})
export class LineageModule {}
