import { Inject, Injectable, Logger } from "@nestjs/common";
import type { KpiTargetOverride, UpdateKpiTarget } from "@ptit/shared";
import { TargetBasisSchema } from "@ptit/shared";
import { eq } from "drizzle-orm";
import { DB, type Database } from "../../db/db.module";
import { kpiTargetOverride } from "../../db/schema";

type Dong = typeof kpiTargetOverride.$inferSelect;

/**
 * Mức cần đạt đã sửa từ giao diện.
 *
 * Đây là BẢNG NGHIỆP VỤ của ứng dụng, không phải bảng mart — nên truy cập bằng Drizzle
 * chứ không bằng SQL thô, và không phụ thuộc cần gạt `DATA_SOURCE`: mục tiêu là cam kết
 * do người dùng nhập, không phải số liệu do dbt dựng.
 */
@Injectable()
export class KpiTargetRepository {
  private readonly logger = new Logger(KpiTargetRepository.name);

  constructor(@Inject(DB) private readonly db: Database) {}

  /**
   * Đọc toàn bộ bản ghi đè.
   *
   * Hỏng thì trả danh sách rỗng và ghi cảnh báo, không ném ra: chưa chạy migration là
   * tình huống có thật khi dựng lần đầu, và khi ấy cả bảng điều khiển sập vì một bảng
   * phụ chưa tồn tại thì khó chẩn đoán hơn nhiều so với việc hiện mục tiêu mặc định.
   */
  async list(): Promise<KpiTargetOverride[]> {
    try {
      const dong = await this.db
        .select()
        .from(kpiTargetOverride)
        .orderBy(kpiTargetOverride.kpiKey);
      return dong.map(thanhBanGhi);
    } catch (error) {
      this.logger.warn(
        `Không đọc được bảng kpi_target_override (đã chạy drizzle-kit migrate chưa?): ${String(error)}`,
      );
      return [];
    }
  }

  /**
   * Ghi mức cần đạt mới. Một chỉ số chỉ có một bản ghi đè nên dùng `ON CONFLICT` —
   * gọi lại hai lần cùng tham số cho ra đúng một dòng, không nhân đôi.
   */
  async save(
    kpiKey: string,
    thay_doi: UpdateKpiTarget,
    nguoi_sua: string,
  ): Promise<KpiTargetOverride> {
    const gia_tri = {
      kpiKey,
      target: thay_doi.target,
      rationaleBasis: thay_doi.targetRationale.basis,
      rationaleNote: thay_doi.targetRationale.note,
      updatedBy: nguoi_sua,
      updatedAt: new Date(),
    };

    const [dong] = await this.db
      .insert(kpiTargetOverride)
      .values(gia_tri)
      .onConflictDoUpdate({
        target: kpiTargetOverride.kpiKey,
        set: {
          target: gia_tri.target,
          rationaleBasis: gia_tri.rationaleBasis,
          rationaleNote: gia_tri.rationaleNote,
          updatedBy: gia_tri.updatedBy,
          updatedAt: gia_tri.updatedAt,
        },
      })
      .returning();

    // `returning()` của một lệnh insert ... on conflict do update luôn trả đúng một dòng.
    // Rỗng nghĩa là lệnh không chạy như hiểu — nói ra thay vì trả về một bản ghi rỗng.
    if (!dong)
      throw new Error(`Ghi mức cần đạt của "${kpiKey}" không trả về dòng nào`);

    return thanhBanGhi(dong);
  }

  /** `false` nghĩa là chỉ số đó vốn chưa bị sửa — người gọi quyết định có coi là lỗi hay không. */
  async remove(kpiKey: string): Promise<boolean> {
    const dong = await this.db
      .delete(kpiTargetOverride)
      .where(eq(kpiTargetOverride.kpiKey, kpiKey))
      .returning();
    return dong.length > 0;
  }
}

/**
 * Đổi dòng trong bảng thành bản ghi theo hợp đồng dùng chung.
 *
 * `rationale_basis` là cột text tự do ở tầng PostgreSQL. Nếu có ai sửa trực tiếp trong
 * cơ sở dữ liệu thành một giá trị ngoài danh mục, chặn ngay tại đây thay vì để nó trôi
 * ra giao diện thành một nhãn trống.
 */
function thanhBanGhi(dong: Dong): KpiTargetOverride {
  return {
    kpiKey: dong.kpiKey,
    target: dong.target,
    targetRationale: {
      basis: TargetBasisSchema.parse(dong.rationaleBasis),
      note: dong.rationaleNote,
    },
    updatedBy: dong.updatedBy,
    updatedAt: dong.updatedAt.toISOString(),
  };
}
