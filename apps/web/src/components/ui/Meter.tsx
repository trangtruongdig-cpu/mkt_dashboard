interface MeterProps {
  /** Tỷ lệ hoàn thành, 0–1. Giá trị lớn hơn 1 bị cắt về 1 nhưng vẫn tính là đạt. */
  ratio: number;
  /** Màu phần đã đạt — luôn truyền qua biến CSS, không hardcode mã màu. */
  color: string;
  ariaLabel: string;
  /** Dày của thanh. `sm` cho hàng chỉ số, `md` cho ô chỉ số lớn. */
  size?: "sm" | "md";
}

/**
 * Thanh đo một tỷ lệ so với mục tiêu.
 *
 * Rãnh nền là một bậc sáng hơn của cùng thang, không phải màu khác — nhờ vậy trạng
 * thái đọc được trên toàn bộ chiều dài thanh chứ không chỉ ở phần đã tô.
 */
export function Meter({ ratio, color, ariaLabel, size = "sm" }: MeterProps) {
  const width = Math.min(Math.max(ratio, 0), 1) * 100;

  return (
    <div
      aria-label={ariaLabel}
      className={`w-full overflow-hidden rounded-full bg-grid ${
        size === "sm" ? "h-1" : "h-1.5"
      }`}
      role="img"
    >
      <div
        className="h-full rounded-full"
        style={{ width: `${width}%`, backgroundColor: color }}
      />
    </div>
  );
}
