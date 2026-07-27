import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const thuMucNay = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  /** Ảnh Docker chạy `node server.js`, cần Next gom sẵn phụ thuộc vào .next/standalone. */
  output: "standalone",

  /**
   * Trong monorepo, Next đoán gốc dự án bằng lockfile gần nhất và dừng ở apps/web,
   * bỏ sót packages/shared — ảnh chạy sẽ chết vì thiếu module. Chỉ đích danh gốc repo.
   */
  outputFileTracingRoot: join(thuMucNay, "../.."),
};

export default nextConfig;
