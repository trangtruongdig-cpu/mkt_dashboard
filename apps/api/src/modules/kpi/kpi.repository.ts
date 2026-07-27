import { Injectable } from "@nestjs/common";
import {
  buildDemoCascade,
  buildDemoShareOfSearch,
  type KpiCascadeResponse,
  type ShareOfSearchResponse,
} from "@ptit/shared";

/**
 * Hợp đồng truy cập dữ liệu mục tiêu và chỉ số thương hiệu.
 *
 * Khi worker đã hút đủ dữ liệu và dbt đã dựng bảng mart, thêm
 * `PostgresKpiRepository` đọc `mart__brand_share_of_search` và
 * `mart__kpi_cascade` bằng SQL thuần rồi đổi provider trong `KpiModule`.
 * Tầng service và controller không phải sửa gì.
 */
export abstract class KpiRepository {
  abstract getCascade(): Promise<KpiCascadeResponse>;
  abstract getShareOfSearch(): Promise<ShareOfSearchResponse>;
}

/**
 * Nguồn dữ liệu GIẢ LẬP cho giai đoạn demo giao diện.
 *
 * Lưu ý phần nào là thật: cấu trúc cascade và các mức mục tiêu (`target`) là quyết
 * định thật, suy ra từ số liệu công bố. Chỉ giá trị hiện tại của các chỉ số là giả
 * lập — và phần lớn chỉ số vẫn để `null` kèm trạng thái "chờ dữ liệu gốc".
 */
@Injectable()
export class DemoKpiRepository extends KpiRepository {
  async getCascade(): Promise<KpiCascadeResponse> {
    return buildDemoCascade();
  }

  async getShareOfSearch(): Promise<ShareOfSearchResponse> {
    return buildDemoShareOfSearch();
  }
}
