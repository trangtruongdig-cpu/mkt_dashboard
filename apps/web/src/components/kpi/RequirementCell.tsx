import type { KpiRequirement } from "@ptit/shared";
import { ReadinessBadge } from "./ReadinessBadge";

interface RequirementCellProps {
  requirement: KpiRequirement;
  /** Nhãn chỉ số tương ứng — dùng cho trình đọc màn hình khi ô còn trống. */
  kpiLabel: string;
}

/**
 * Cột 3 của bảng điều khiển: nền tảng và việc kỹ thuật.
 *
 * Ô chưa có nền tảng vẫn được vẽ ra chứ không bị bỏ qua — nó là chỗ trống có chủ ý,
 * đánh dấu phần còn phải đấu nối. Khi nào kết nối được thì điền tiếp vào đúng ô này,
 * và chỉ số ở cột giữa tự có số liệu.
 */
export function RequirementCell({
  requirement,
  kpiLabel,
}: RequirementCellProps) {
  if (requirement.platform === null) {
    return (
      <div className="rounded-lg border border-dashed border-hairline bg-plane/40 p-3.5">
        <p className="text-xs text-ink-muted">
          Chưa xác định nền tảng cho “{kpiLabel}”. Ô này để trống có chủ ý — khi tìm
          được nguồn thì điền vào đây.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-hairline bg-plane/40 p-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-medium text-ink">{requirement.platform}</p>
        <ReadinessBadge readiness={requirement.readiness} />
      </div>

      {requirement.fields.length > 0 ? (
        <>
          <p className="mt-2.5 text-[11px] font-medium text-ink-secondary">
            Trường dữ liệu cần lấy
          </p>
          <ul className="mt-1 flex flex-wrap gap-1">
            {requirement.fields.map((field) => (
              <li
                key={field}
                className="rounded border border-hairline px-1.5 py-0.5 font-mono text-[10px] text-ink-secondary"
              >
                {field}
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {requirement.todo ? (
        <p className="mt-2.5 border-t border-hairline pt-2 text-[11px] leading-snug text-ink-secondary">
          <span className="font-medium text-ink">Việc cần làm: </span>
          {requirement.todo}
        </p>
      ) : (
        <p className="mt-2.5 border-t border-hairline pt-2 text-[11px] text-ink-muted">
          Không còn việc kỹ thuật nào tồn đọng.
        </p>
      )}
    </div>
  );
}
