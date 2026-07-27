import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

/**
 * Dựng ứng dụng Nest dùng chung cho cả hai cách chạy: máy chủ thường (`main.ts`)
 * và hàm serverless trên Vercel (`vercel.ts`). Chỉ có một nơi cấu hình.
 */
export async function createApp(): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
  );

  app.setGlobalPrefix("api");

  const corsOrigins = process.env.CORS_ORIGINS ?? "*";
  app.enableCors({
    origin:
      corsOrigins === "*"
        ? true
        : corsOrigins.split(",").map((o) => o.trim()).filter(Boolean),
    methods: ["GET", "OPTIONS"],
  });

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle("API Dashboard Marketing số & Thương hiệu — PTIT")
      .setDescription(
        [
          "Nguồn dữ liệu cho dashboard theo dõi hoạt động marketing số và sức khoẻ",
          "thương hiệu của Học viện Công nghệ Bưu chính Viễn thông.",
          "",
          "Lược đồ response sinh trực tiếp từ zod schema trong `@ptit/shared` —",
          "cùng bộ schema mà frontend dùng để kiểm tra dữ liệu.",
        ].join("\n"),
      )
      .setVersion("0.1.0")
      .build(),
  );
  SwaggerModule.setup("api/docs", app, document, {
    customSiteTitle: "API Dashboard PTIT",
  });

  return app;
}
