// Chỉ chạy phía máy chủ — module này đọc ghi hệ thống tệp. Không import từ component
// có "use client"; các thao tác sửa đi qua route handler ở app/api/muc-tieu/targets.
import {
  KpiTargetOverrideListSchema,
  type KpiTargetOverride,
  type UpdateKpiTarget,
} from "@ptit/shared";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * Nơi cất các mức cần đạt đã được sửa từ giao diện.
 *
 * Chọn lưu ra file thay vì cơ sở dữ liệu ở giai đoạn này vì tầng đăng nhập và kết
 * nối PostgreSQL đang được dựng ở nhánh khác — làm ở đây sẽ giẫm lên nhau. Khi tầng
 * đó xong, đổi hai hàm `docTatCa` / `ghiDe` sang truy vấn là hết, phần còn lại của
 * luồng không phải sửa.
 *
 * File nằm trong `data/` nên đã được .gitignore loại.
 */
function timGocRepo(): string {
  let hien_tai = resolve(process.cwd());
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(join(hien_tai, "pnpm-workspace.yaml"))) return hien_tai;
    const cha = dirname(hien_tai);
    if (cha === hien_tai) break;
    hien_tai = cha;
  }
  return process.cwd();
}

const DUONG_DAN =
  process.env.KPI_TARGETS_PATH ?? join(timGocRepo(), "data", "kpi-targets.json");

/**
 * Cho phép sửa hay không.
 *
 * Mặc định CHỈ mở khi chạy phát triển. Đây là endpoint ghi mà chưa có đăng nhập —
 * tầng xác thực đang được dựng ở nhánh khác — nên không được tự mở ở môi trường thật.
 * Muốn bật có chủ đích thì đặt KPI_TARGET_EDIT=true.
 */
export function choPhepSua(): boolean {
  if (process.env.KPI_TARGET_EDIT === "true") return true;
  return process.env.NODE_ENV !== "production";
}

export function docTatCa(): KpiTargetOverride[] {
  if (!existsSync(DUONG_DAN)) return [];
  try {
    const raw: unknown = JSON.parse(readFileSync(DUONG_DAN, "utf8"));
    return KpiTargetOverrideListSchema.parse(raw).overrides;
  } catch {
    // File hỏng thì coi như chưa sửa gì, còn hơn làm sập cả trang điều khiển.
    console.warn(`[kpi-targets] Không đọc được ${DUONG_DAN}, bỏ qua bản ghi đè.`);
    return [];
  }
}

export function ghiDe(
  kpiKey: string,
  thay_doi: UpdateKpiTarget,
  nguoi_sua: string,
): KpiTargetOverride[] {
  const con_lai = docTatCa().filter((o) => o.kpiKey !== kpiKey);
  const moi: KpiTargetOverride = {
    kpiKey,
    target: thay_doi.target,
    targetRationale: thay_doi.targetRationale,
    updatedBy: nguoi_sua,
    updatedAt: new Date().toISOString(),
  };

  const tat_ca = [...con_lai, moi].sort((a, b) => a.kpiKey.localeCompare(b.kpiKey));

  mkdirSync(dirname(DUONG_DAN), { recursive: true });
  writeFileSync(DUONG_DAN, `${JSON.stringify({ overrides: tat_ca }, null, 2)}\n`, "utf8");

  return tat_ca;
}

export function xoaGhiDe(kpiKey: string): KpiTargetOverride[] {
  const con_lai = docTatCa().filter((o) => o.kpiKey !== kpiKey);
  mkdirSync(dirname(DUONG_DAN), { recursive: true });
  writeFileSync(DUONG_DAN, `${JSON.stringify({ overrides: con_lai }, null, 2)}\n`, "utf8");
  return con_lai;
}
