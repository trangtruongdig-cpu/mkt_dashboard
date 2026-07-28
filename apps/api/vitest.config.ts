import { defineConfig } from "vitest/config";

/**
 * Cấu hình test cho API.
 *
 * `globals: false` — import `describe`/`it`/`expect` tường minh. Biến toàn cục ẩn khiến
 * người đọc không biết hàm ở đâu ra, và tsc cũng không kiểm được nếu thiếu khai báo type.
 *
 * NestJS dùng decorator; `experimentalDecorators` và `emitDecoratorMetadata` đã bật trong
 * tsconfig và vitest đọc theo. Không đặt khối `esbuild` ở đây: vitest 4 dùng oxc và sẽ
 * cảnh báo "esbuild options will be ignored" — một dòng cảnh báo vô nghĩa lặp lại mỗi
 * lần chạy test là cách nhanh nhất để người ta thôi đọc cảnh báo.
 */
export default defineConfig({
  test: {
    globals: false,
    environment: "node",
    include: ["src/**/*.spec.ts", "test/**/*.spec.ts"],
    // Test dựng cả ứng dụng Nest nên chậm hơn test đơn vị thuần.
    testTimeout: 20_000,
  },
});
