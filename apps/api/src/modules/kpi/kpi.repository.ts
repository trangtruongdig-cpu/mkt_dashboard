import { Injectable } from "@nestjs/common";
import {
  buildDemoBenchmark,
  buildDemoCascade,
  buildDemoShareOfSearch,
  type BenchmarkScorecardResponse,
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
  /**
   * Bảng đối sánh — Học viện đứng ở đâu so với nhóm trường cạnh tranh.
   *
   * Tách khỏi `getCascade` vì trả lời một câu khác: cascade nói chỉ số của TA so với
   * mục tiêu của TA, còn bảng này nói phần của ta trong nhóm. Dữ liệu vốn đã nằm sẵn
   * theo từng trường trong các bảng mart; trước đây tầng đọc lọc lấy mỗi dòng `ptit`.
   */
  abstract getBenchmark(): Promise<BenchmarkScorecardResponse>;
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

  async getBenchmark(): Promise<BenchmarkScorecardResponse> {
    return buildDemoBenchmark();
  }
}
