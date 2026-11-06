import type { KpiStatus } from "@ptit/shared";
import { GlyphPill, STATUS_GLYPH } from "./glyphs";

/**
 * Nhãn trạng thái KPI.
 *
 * Dựng lại trên `STATUS_GLYPH` của `glyphs.tsx` thay vì tự giữ một bảng ký hiệu
 * riêng. Trước đây file này có bảng `STATUS_STYLE` dùng ký tự chữ (● ◐ ○ –) trong khi
 * `glyphs.tsx` đã có bộ hình SVG cho đúng enum đó — nên cùng một trạng thái hiện ra
 * hai kiểu khác nhau tuỳ trang: trang chủ vẽ hình, trang Mục tiêu vẽ ký tự.
 *
 * Màu nằm ở HÌNH, chữ giữ màu chữ. Tô màu cả dòng chữ theo trạng thái làm nhãn tranh
 * tương phản với con số bên cạnh, và khi có bốn trạng thái trên cùng một bảng thì mắt
 * đọc ra một bảng bốn màu chữ chứ không đọc ra bốn trạng thái.
 */
export function StatusBadge({ status }: { status: KpiStatus }) {
  return <GlyphPill glyph={STATUS_GLYPH[status]} />;
}
