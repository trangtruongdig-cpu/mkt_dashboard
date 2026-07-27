import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthRepository } from "./auth.repository";
import { AuthService } from "./auth.service";

/**
 * Đăng nhập quản trị viên.
 *
 * Chỉ được nạp khi có đủ DATABASE_URL và ADMIN_PASSWORD — xem `app.module.ts`.
 * Bản demo không có cơ sở dữ liệu vẫn chạy được, chỉ là không có phần quản trị.
 */
@Module({
  controllers: [AuthController],
  providers: [AuthService, AuthRepository, AuthGuard],
  exports: [AuthService, AuthGuard],
})
export class AuthModule {}
