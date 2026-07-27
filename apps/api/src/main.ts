import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { createApp } from "./bootstrap";
import { loadEnv } from "./config/env";

/** Điểm vào khi chạy như một máy chủ thường (dev cục bộ và Docker). */
async function bootstrap(): Promise<void> {
  const env = loadEnv();
  const app = await createApp();

  await app.listen({ port: env.PORT, host: "0.0.0.0" });

  const logger = new Logger("Bootstrap");
  logger.log(`Nguồn dữ liệu: ${env.DATA_SOURCE}`);
  logger.log(`API: http://localhost:${env.PORT}/api/v1/overview`);
  logger.log(`Tài liệu: http://localhost:${env.PORT}/api/docs`);
}

void bootstrap();
