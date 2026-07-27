import { Injectable } from "@nestjs/common";
import {
  KpiCascadeResponseSchema,
  ShareOfSearchResponseSchema,
  type KpiCascadeResponse,
  type ShareOfSearchResponse,
} from "@ptit/shared";
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
  constructor(private readonly repository: KpiRepository) {}

  async getCascade(): Promise<KpiCascadeResponse> {
    return KpiCascadeResponseSchema.parse(await this.repository.getCascade());
  }

  async getShareOfSearch(): Promise<ShareOfSearchResponse> {
    return ShareOfSearchResponseSchema.parse(
      await this.repository.getShareOfSearch(),
    );
  }
}
