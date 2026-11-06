import { describe, expect, it } from "vitest";
import { validateEnv } from "./env";

/**
 * Kiểm biên của cấu hình môi trường.
 *
 * Đây là chỗ hỏng thì KHÔNG CÓ GÌ chạy: `validateEnv` chạy trước khi Nest dựng module
 * nào, nên một ràng buộc đặt sai ở đây làm cả tiến trình không khởi động được, và
 * thông điệp lỗi là thứ duy nhất người vận hành nhìn thấy.
 */
describe("Cấu hình môi trường", () => {
  it("chạy được với cấu hình rỗng — mọi biến đều có mặc định hợp lý", () => {
    const env = validateEnv({});

    expect(env.DATA_SOURCE).toBe("demo");
    expect(env.ADMIN_PASSWORD).toBeUndefined();
  });

  it("ADMIN_PASSWORD rỗng nghĩa là TẮT quản trị, không phải cấu hình sai", () => {
    // Biến môi trường không có khái niệm "vắng mặt" khi đi qua docker-compose hay
    // một tệp .env: nơi nào không điền thì giá trị là chuỗi rỗng. Trước khi sửa, dòng
    // này làm api ngã ngay lúc khởi động với "Mật khẩu quản trị phải từ 12 ký tự".
    expect(validateEnv({ ADMIN_PASSWORD: "" }).ADMIN_PASSWORD).toBeUndefined();
    expect(validateEnv({ ADMIN_PASSWORD: "   " }).ADMIN_PASSWORD).toBeUndefined();
  });

  it("ADMIN_PASSWORD có điền thì vẫn phải đủ dài", () => {
    expect(() => validateEnv({ ADMIN_PASSWORD: "ngan" })).toThrow(
      /Mật khẩu quản trị phải từ 12 ký tự/,
    );
    expect(validateEnv({ ADMIN_PASSWORD: "mat_khau_du_dai_123" }).ADMIN_PASSWORD).toBe(
      "mat_khau_du_dai_123",
    );
  });

  it("DATA_SOURCE ngoài hai giá trị cho phép thì dừng ngay, không đoán", () => {
    expect(() => validateEnv({ DATA_SOURCE: "mysql" })).toThrow(/DATA_SOURCE/);
  });

  it("thông điệp lỗi nêu đích danh biến sai", () => {
    expect(() => validateEnv({ SESSION_TTL_HOURS: "9999" })).toThrow(
      /SESSION_TTL_HOURS/,
    );
  });
});
