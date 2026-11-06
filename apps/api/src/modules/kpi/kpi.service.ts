import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import {
  applyTargetOverrides,
  BenchmarkScorecardResponseSchema,
  findOrphanOverrides,
  KpiCascadeResponseSchema,
  KpiTargetOverrideListSchema,
  ShareOfSearchResponseSchema,
  type BenchmarkScorecardResponse,
  type KpiCascadeResponse,
  type KpiTargetOverrideList,
  type ShareOfSearchResponse,
  type UpdateKpiTarget,
} from "@ptit/shared";
import { KpiTargetRepository } from "./kpi-target.repository";
import { KpiRepository } from "./kpi.repository";

/**
 * Mọi giá trị trả ra đều đi qua `parse` của zod schema dùng chung.
 *
 * Với cascade, `parse` làm nhiều hơn kiểm kiểu: nó kiểm luôn tính liền mạch của cây
 * mục tiêu — chỉ số mồ côi, mục tiêu trỏ sai tầng, trạng thái gắn lệch so với mức
 * hoàn thành đều bị chặn ngay tại đây, trước khi kịp lên tới giao diện.
 */
@Injectable()
export class KpiService {
  private readonly logger = new Logger(KpiService.name);

  constructor(
    private readonly repository: KpiRepository,
    private readonly targets: KpiTargetRepository,
  ) {}

  /**
   * Cây mục tiêu, ĐÃ chồng mức cần đạt do người dùng sửa.
   *
   * Chồng ở đây chứ không ở frontend: `applyTargetOverrides` tính lại `status` từ mục
   * tiêu mới, và nếu để mỗi trang tự làm thì sẽ có trang nhớ làm, trang quên — hiện ra
   * hai con số khác nhau cho cùng một chỉ số.
   */
  async getCascade(): Promise<KpiCascadeResponse> {
    const goc = await this.repository.getCascade();
    const ghi_de = await this.targets.list();

    const mo_coi = findOrphanOverrides(goc, ghi_de);
    if (mo_coi.length > 0) {
      // Không im lặng bỏ qua: bản ghi đè trỏ tới chỉ số không còn tồn tại nghĩa là cây
      // cascade đã đổi khoá, và mục tiêu người dùng từng chốt đang không có hiệu lực.
      this.logger.warn(
        `Có ${mo_coi.length} bản ghi đè trỏ tới chỉ số không tồn tại: ${mo_coi.join(", ")}`,
      );
    }

    return KpiCascadeResponseSchema.parse(applyTargetOverrides(goc, ghi_de));
  }

  async getShareOfSearch(): Promise<ShareOfSearchResponse> {
    return ShareOfSearchResponseSchema.parse(
      await this.repository.getShareOfSearch(),
    );
  }

  /** Bảng đối sánh. `parse` ở đây chặn luôn tổ hợp "khai đủ nhóm mà còn trường trống". */
  async getBenchmark(): Promise<BenchmarkScorecardResponse> {
    return BenchmarkScorecardResponseSchema.parse(
      await this.repository.getBenchmark(),
    );
  }

  async listTargets(): Promise<KpiTargetOverrideList> {
    return KpiTargetOverrideListSchema.parse({
      overrides: await this.targets.list(),
    });
  }

  /**
   * Sửa mức cần đạt của một chỉ số.
   *
   * Chặn khoá không có trong cây cascade: nhận bừa thì bản ghi đè sẽ nằm trong cơ sở dữ
   * liệu mà không bao giờ có hiệu lực, và người sửa vẫn thấy thông báo "đã lưu".
   */
  async saveTarget(
    kpiKey: string,
    thay_doi: UpdateKpiTarget,
    nguoi_sua: string,
  ): Promise<KpiTargetOverrideList> {
    const goc = await this.repository.getCascade();
    if (!goc.kpis.some((kpi) => kpi.key === kpiKey)) {
      throw new NotFoundException(`Không có chỉ số nào mang khoá "${kpiKey}"`);
    }

    await this.targets.save(kpiKey, thay_doi, nguoi_sua);
    return this.listTargets();
  }

  async removeTarget(kpiKey: string): Promise<KpiTargetOverrideList> {
    const da_xoa = await this.targets.remove(kpiKey);
    if (!da_xoa) {
      throw new NotFoundException(
        `Chỉ số "${kpiKey}" vốn chưa có bản ghi đè nào`,
      );
    }
    return this.listTargets();
  }
}
