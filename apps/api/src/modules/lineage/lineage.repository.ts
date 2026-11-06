import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  LINEAGE_DATASETS,
  LINEAGE_EDGES,
  LINEAGE_KPI_LINKS,
  type DataLineageResponse,
  type Dataset,
  type DatasetSample,
} from "@ptit/shared";
import { sql } from "drizzle-orm";
import { DB, type Database } from "../../db/db.module";

/** Số dòng mẫu hiện cho mỗi bảng. Đây là ô cửa sổ nhìn vào kho, không phải cổng xuất dữ liệu. */
const SO_DONG_MAU = 5;

/** Lược đồ tương ứng mỗi tầng trong kho PostgreSQL. */
const LUOC_DO: Record<Dataset["stage"], string> = {
  raw: "raw",
  staging: "stg",
  intermediate: "int",
  mart: "mart",
};

export abstract class LineageRepository {
  abstract getLineage(): Promise<DataLineageResponse>;
}

/**
 * Đọc trạng thái thật của đường ống: bảng nào có bao nhiêu dòng, và vài dòng đầu của
 * các bảng nguồn công khai.
 *
 * Danh mục (mô tả, quan hệ, mức nhạy cảm) lấy từ `@ptit/shared` — đó là quyết định của
 * con người. Repository chỉ điền phần đo được.
 */
@Injectable()
export class PostgresLineageRepository extends LineageRepository {
  private readonly logger = new Logger(PostgresLineageRepository.name);

  constructor(@Inject(DB) private readonly db: Database) {
    super();
  }

  async getLineage(): Promise<DataLineageResponse> {
    const so_dong = await this.demSoDong();
    const datasets = LINEAGE_DATASETS.map((d) => ({
      ...d,
      rowCount: so_dong.get(`${LUOC_DO[d.stage]}.${d.name}`) ?? null,
    }));

    return {
      updatedAt: new Date().toISOString(),
      datasets,
      edges: [...LINEAGE_EDGES],
      kpiLinks: [...LINEAGE_KPI_LINKS],
      samples: await this.layMau(datasets),
    };
  }

  /**
   * Đếm CHÍNH XÁC số dòng của từng bảng trong danh mục.
   *
   * Đã thử `pg_class.reltuples` cho nhanh và phải bỏ: nó trả 0 cho mọi view (staging
   * toàn là view), và trả 0 cho bảng chưa từng chạy ANALYZE — `raw_disclosure_figure`
   * có 22 dòng nhưng hiện ra 0. Trên đúng cái trang nói về tính trung thực của số
   * liệu, một con số sai còn tệ hơn không có số.
   *
   * `count(*)` trên bảng lớn nhất ở đây (391 nghìn dòng) mất vài chục mili giây, và cả
   * danh mục gộp trong một truy vấn — cái giá đó rẻ hơn nhiều so với việc mất tin cậy.
   */
  private async demSoDong(): Promise<Map<string, number>> {
    const nhanh = LINEAGE_DATASETS.map(
      (d) =>
        `select '${LUOC_DO[d.stage]}.${d.name}' as ten, count(*)::bigint as so_dong ` +
        `from ${LUOC_DO[d.stage]}."${d.name}"`,
    );

    // Bảng nào chưa dựng thì cả truy vấn hỏng; chạy lại từng bảng để giữ được phần đếm
    // được, và bảng thiếu hiện dấu gạch thay vì số 0.
    try {
      const ket_qua = await this.db.execute<{ ten: string; so_dong: string | number }>(
        sql.raw(nhanh.join(" union all ")),
      );
      const dong = Array.isArray(ket_qua) ? ket_qua : [];
      return new Map(dong.map((r) => [r.ten, Number(r.so_dong)]));
    } catch {
      this.logger.warn("Có bảng chưa dựng — chuyển sang đếm từng bảng một.");
      return this.demTungBang();
    }
  }

  private async demTungBang(): Promise<Map<string, number>> {
    const ket_qua = new Map<string, number>();

    for (const d of LINEAGE_DATASETS) {
      const khoa = `${LUOC_DO[d.stage]}.${d.name}`;
      try {
        const dong = await this.db.execute<{ so_dong: string | number }>(
          sql.raw(`select count(*)::bigint as so_dong from ${LUOC_DO[d.stage]}."${d.name}"`),
        );
        const hang = Array.isArray(dong) ? dong : [];
        if (hang.length > 0) ket_qua.set(khoa, Number(hang[0]!.so_dong));
      } catch {
        // Bảng chưa dựng — để trống, giao diện hiện dấu gạch.
      }
    }

    return ket_qua;
  }

  /**
   * Vài dòng đầu của các bảng nguồn CÔNG KHAI.
   *
   * Bảng `internal` không bao giờ được lấy mẫu: đó là dữ liệu vận hành của Học viện
   * (GA4) hoặc nội dung do người dùng viết. Lọc ở đây, và schema dùng chung kiểm lại
   * lần nữa — hai lớp, vì một lần sửa nhầm là lộ dữ liệu ra ngoài.
   *
   * Chỉ lấy mẫu ở tầng thô: đó là thứ người xem muốn thấy tận mắt. Tầng sau là biến
   * đổi của chính dữ liệu này, xem lại không thêm thông tin gì.
   */
  private async layMau(datasets: Dataset[]): Promise<DatasetSample[]> {
    const duoc_lay = datasets.filter(
      (d) => d.stage === "raw" && d.sensitivity === "public" && (d.rowCount ?? 0) > 0,
    );

    const mau: DatasetSample[] = [];
    for (const d of duoc_lay) {
      try {
        // Tên bảng đến từ danh mục khai cứng trong mã nguồn, không từ người dùng.
        const ket_qua = await this.db.execute(
          sql.raw(`select * from raw."${d.name}" limit ${SO_DONG_MAU}`),
        );
        const dong = Array.isArray(ket_qua) ? (ket_qua as Record<string, unknown>[]) : [];
        if (dong.length === 0) continue;

        const columns = Object.keys(dong[0]!);
        mau.push({
          dataset: d.name,
          columns,
          rows: dong.map((r) => columns.map((c) => this.thanhChuoi(r[c]))),
          limit: SO_DONG_MAU,
        });
      } catch (loi) {
        this.logger.warn(
          `Không lấy được mẫu của ${d.name}: ${loi instanceof Error ? loi.message : String(loi)}`,
        );
      }
    }
    return mau;
  }

  /** Ép mọi kiểu về chuỗi để giao diện không phải đoán. Cắt ngắn ô quá dài. */
  private thanhChuoi(gia_tri: unknown): string | null {
    if (gia_tri === null || gia_tri === undefined) return null;
    const chuoi =
      gia_tri instanceof Date
        ? gia_tri.toISOString()
        : typeof gia_tri === "object"
          ? JSON.stringify(gia_tri)
          : String(gia_tri);
    return chuoi.length > 300 ? `${chuoi.slice(0, 300)}…` : chuoi;
  }
}

/** Bản không cần kho: hiện đúng cấu trúc đường ống, chưa có số dòng. */
@Injectable()
export class StaticLineageRepository extends LineageRepository {
  async getLineage(): Promise<DataLineageResponse> {
    return {
      updatedAt: new Date().toISOString(),
      datasets: [...LINEAGE_DATASETS],
      edges: [...LINEAGE_EDGES],
      kpiLinks: [...LINEAGE_KPI_LINKS],
      samples: [],
    };
  }
}
