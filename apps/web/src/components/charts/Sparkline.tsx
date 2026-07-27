interface SparklineProps {
  /** Chuỗi giá trị theo thứ tự thời gian. Dưới 2 điểm thì không vẽ gì. */
  values: number[];
  /** Màu đường — truyền qua biến CSS. */
  color?: string;
  ariaLabel: string;
  className?: string;
}

const VIEW_W = 100;
const VIEW_H = 28;
/** Chừa mép trên dưới để đỉnh và đáy không dính vào cạnh khung. */
const PAD = 3;

/**
 * Đường xu hướng thu nhỏ đặt trong ô chỉ số.
 *
 * Vẽ thẳng bằng SVG chứ không gọi ECharts: ô chỉ số cần hình dáng của chuỗi, không
 * cần trục, chú giải hay tương tác — và một sparkline dựng sẵn ở máy chủ thì không
 * tốn thêm JavaScript nào ở trình duyệt.
 *
 * `preserveAspectRatio="none"` cho đường kéo giãn đầy chiều ngang ô; nét vẫn giữ đúng
 * 2px nhờ `vector-effect="non-scaling-stroke"`.
 */
export function Sparkline({
  values,
  color = "var(--series-1)",
  ariaLabel,
  className = "h-8 w-full",
}: SparklineProps) {
  if (values.length < 2) {
    return null;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  // Chuỗi phẳng hoàn toàn: vẽ ở giữa khung thay vì chia cho 0.
  const range = max - min || 1;

  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * VIEW_W;
    const y =
      max === min
        ? VIEW_H / 2
        : PAD + (1 - (value - min) / range) * (VIEW_H - PAD * 2);
    return { x, y };
  });

  const line = points
    .map((p, index) => `${index === 0 ? "M" : "L"}${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
    .join(" ");
  const area = `${line} L${VIEW_W} ${VIEW_H} L0 ${VIEW_H} Z`;

  return (
    <svg
      aria-label={ariaLabel}
      className={className}
      preserveAspectRatio="none"
      role="img"
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
    >
      <path d={area} fill={color} opacity={0.1} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
