import { OBJECTIVE_TIER_LABELS, ObjectiveTierSchema } from "@ptit/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { TargetEditorList } from "@/components/kpi/TargetEditorList";
import { getKpiData } from "@/lib/api";
import { choPhepSua, docTatCa } from "@/lib/kpi-targets-store";

export const metadata: Metadata = { title: "Sửa mức cần đạt — Dashboard PTIT" };
export const dynamic = "force-dynamic";

/**
 * Trang sửa mức cần đạt.
 *
 * Chỉ hiện chỉ số ĐÃ CÓ DỮ LIỆU THẬT. Chỉ số còn chờ nguồn thì mức cần đạt vẫn là
 * dự kiến, sửa lúc này chỉ tạo cảm giác đã quyết định trong khi chưa có gì để đối chiếu.
 */
export default async function TrangSuaMucTieu() {
  // getKpiData đã chồng sẵn bản ghi đè, nên bảng dưới hiện đúng con số đang có hiệu lực.
  const { cascade } = await getKpiData();
  const overrides = docTatCa();
  const editable = choPhepSua();

  const coDuLieu = cascade.kpis.filter(
    (kpi) => kpi.requirement.readiness === "connected",
  );

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-8 sm:px-8 sm:py-12">
      <header className="mb-8">
        <Link
          href="/"
          className="text-xs text-ink-muted underline decoration-hairline underline-offset-2 hover:text-ink-secondary"
        >
          ← Về bảng điều khiển
        </Link>
        <h1 className="mt-3 text-xl font-semibold text-ink sm:text-2xl">
          Sửa mức cần đạt
        </h1>
        <p className="mt-1.5 text-sm text-ink-secondary">
          {coDuLieu.length} chỉ số đang có dữ liệu thật. Mỗi lần sửa buộc phải kèm căn
          cứ — sửa mức cần đạt là sửa cam kết, không phải chỉnh tham số.
        </p>
      </header>

      {!editable ? (
        <p
          className="mb-6 rounded-lg border px-4 py-3 text-sm"
          style={{ borderColor: "var(--status-warning)", color: "var(--status-warning)" }}
          role="status"
        >
          Đang ở chế độ chỉ xem. Chức năng sửa mở khi chạy phát triển, hoặc khi đặt
          <code className="mx-1">KPI_TARGET_EDIT=true</code> — chỉ nên bật sau khi đã
          có đăng nhập quản trị.
        </p>
      ) : null}

      <div className="space-y-8">
        {ObjectiveTierSchema.options.map((tier) => {
          const cua_tang = coDuLieu.filter((kpi) => kpi.tier === tier);
          if (cua_tang.length === 0) return null;

          return (
            <section key={tier}>
              <h2 className="mb-3 text-sm font-semibold text-ink">
                {OBJECTIVE_TIER_LABELS[tier]}
              </h2>
              <TargetEditorList
                editable={editable}
                kpis={cua_tang}
                overrides={overrides}
              />
            </section>
          );
        })}
      </div>

      <footer className="mt-10 border-t border-hairline pt-5 text-xs leading-relaxed text-ink-muted">
        <p>
          Bản sửa lưu ở <code>data/kpi-targets.json</code> trên máy chạy hệ thống, đè
          lên mặc định trong mã nguồn. Bấm <em>Khôi phục mặc định</em> để gỡ.
        </p>
        <p className="mt-1">
          Trạng thái đúng hướng / chệch hướng không sửa được bằng tay — máy chủ tính lại
          từ giá trị hiện tại và mức cần đạt mới.
        </p>
      </footer>
    </main>
  );
}
