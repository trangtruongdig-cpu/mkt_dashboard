import { UpdateKpiTargetSchema } from "@ptit/shared";
import { NextResponse } from "next/server";
import { choPhepSua, docTatCa, ghiDe, xoaGhiDe } from "@/lib/kpi-targets-store";

/**
 * Sửa mức cần đạt của một chỉ số.
 *
 * Đặt trong Next.js chứ không đặt ở apps/api vì tầng đăng nhập và kết nối cơ sở dữ
 * liệu bên đó đang được dựng dở ở nhánh khác. Toàn bộ file trong thư mục này là file
 * mới, không sửa gì của nhánh kia.
 */
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ overrides: docTatCa(), editable: choPhepSua() });
}

export async function PATCH(request: Request) {
  if (!choPhepSua()) {
    return NextResponse.json(
      {
        message:
          "Chức năng sửa mục tiêu đang tắt. Bật bằng KPI_TARGET_EDIT=true sau khi đã có đăng nhập quản trị.",
      },
      { status: 403 },
    );
  }

  let than: unknown;
  try {
    than = await request.json();
  } catch {
    return NextResponse.json({ message: "Nội dung gửi lên không phải JSON hợp lệ" }, { status: 400 });
  }

  const { kpiKey, ...phan_con_lai } = (than ?? {}) as Record<string, unknown>;
  if (typeof kpiKey !== "string" || kpiKey.length === 0) {
    return NextResponse.json({ message: "Thiếu kpiKey" }, { status: 400 });
  }

  const ket_qua = UpdateKpiTargetSchema.safeParse(phan_con_lai);
  if (!ket_qua.success) {
    return NextResponse.json(
      {
        message: "Dữ liệu không hợp lệ",
        issues: ket_qua.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  // Chưa có đăng nhập nên chưa biết ai sửa. Ghi rõ như vậy thay vì bịa một cái tên —
  // khi tầng xác thực xong thì thay bằng tên người dùng thật.
  const overrides = ghiDe(kpiKey, ket_qua.data, "chưa xác thực (sửa cục bộ)");
  return NextResponse.json({ overrides });
}

export async function DELETE(request: Request) {
  if (!choPhepSua()) {
    return NextResponse.json({ message: "Chức năng sửa mục tiêu đang tắt." }, { status: 403 });
  }

  const kpiKey = new URL(request.url).searchParams.get("kpiKey");
  if (!kpiKey) {
    return NextResponse.json({ message: "Thiếu kpiKey" }, { status: 400 });
  }

  return NextResponse.json({ overrides: xoaGhiDe(kpiKey) });
}
