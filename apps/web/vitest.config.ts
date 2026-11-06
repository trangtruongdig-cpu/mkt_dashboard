import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Cấu hình test cho giao diện.
 *
 * Cùng quy ước với `apps/api/vitest.config.ts`: `globals: false`, import
 * `describe`/`it`/`expect` tường minh.
 *
 * Phạm vi hiện tại là LOGIC THUẦN trong `src/lib` — định dạng số, tiền, ngày theo
 * locale vi-VN. Đây là phần đáng kiểm nhất của tầng web: nó xuất hiện trên mọi màn
 * hình, nó không phụ thuộc React hay trình duyệt, và sai một chỗ ở đây thì sai đồng
 * loạt khắp bảng điều khiển mà không có gì nổ ra.
 *
 * Chưa dựng môi trường DOM: thêm jsdom và thư viện render chỉ để kiểm vài component
 * hiện chưa đáng, và component biểu đồ thì phải nhìn mới biết đúng — phần đó kiểm
 * bằng mắt trên dev server.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    globals: false,
    environment: "node",
    include: ["src/**/*.spec.ts", "src/**/*.spec.tsx"],
  },
});
