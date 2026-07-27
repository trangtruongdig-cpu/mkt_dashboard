import fastifyCookie from "@fastify/cookie";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { loadEnv } from "./config/env";
import { runMigrations } from "./db/migrate";

/**
 * Dựng ứng dụng Nest dùng chung cho cả hai cách chạy: máy chủ thường (`main.ts`)
 * và hàm serverless trên Vercel (`vercel.ts`). Chỉ có một nơi cấu hình.
 */
export async function createApp(): Promise<NestFastifyApplication> {
  // Migration chạy TRƯỚC khi Nest dựng module. Không có nó thì bảng cấu hình crawler
  // không tồn tại và worker chờ vô hạn — đúng như đã xảy ra lần dựng Docker đầu tiên.
  const env = loadEnv();
  if (env.DATABASE_URL) {
    await runMigrations(env.DATABASE_URL);
  }

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
  );

  app.setGlobalPrefix("api");

  // Cần cho cookie phiên đăng nhập. Đăng ký ở đây cũng là thứ kích hoạt phần khai báo
  // kiểu của @fastify/cookie — thiếu nó thì `reply.setCookie` không tồn tại với TypeScript.
  await app.register(fastifyCookie);

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
