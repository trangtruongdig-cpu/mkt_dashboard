import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CrawlerAdminController } from "./crawler-admin.controller";
import { CrawlerAdminRepository } from "./crawler-admin.repository";
import { CrawlerAdminService } from "./crawler-admin.service";

@Module({
  imports: [AuthModule],
  controllers: [CrawlerAdminController],
  providers: [CrawlerAdminService, CrawlerAdminRepository],
})
export class CrawlerAdminModule {}
