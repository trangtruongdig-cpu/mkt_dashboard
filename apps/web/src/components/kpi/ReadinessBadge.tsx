import type { DataReadiness } from "@ptit/shared";
import { GlyphPill, READINESS_GLYPH } from "./glyphs";

/**
 * Mức sẵn sàng của nguồn dữ liệu.
 *
 * Như `StatusBadge`: lấy hình từ `READINESS_GLYPH` thay vì tự giữ bảng ký hiệu riêng.
 * Bảng cũ ở file này dùng một EMOJI (🔒) cho mức `needs_access` — emoji vẽ khác nhau
 * theo hệ điều hành, luôn ra màu kể cả khi in đen trắng, và không nhận màu trạng thái
 * của hệ thống. Hồ sơ nghiệm thu in ra giấy nên chỗ đó phải là hình SVG.
 */
export function ReadinessBadge({ readiness }: { readiness: DataReadiness }) {
  return <GlyphPill glyph={READINESS_GLYPH[readiness]} />;
}
