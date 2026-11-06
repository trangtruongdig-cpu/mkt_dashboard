import { Injectable } from "@nestjs/common";
import { DataLineageResponseSchema, type DataLineageResponse } from "@ptit/shared";
import { LineageRepository } from "./lineage.repository";

/**
 * Mọi phản hồi đều qua `parse` của schema dùng chung.
 *
 * Với bản đồ đường ống, `parse` làm nhiều hơn kiểm kiểu: nó chặn cạnh trỏ tới bảng
 * không tồn tại, và chặn việc lỡ hiện dữ liệu mẫu của bảng thuộc nhóm nội bộ.
 */
@Injectable()
export class LineageService {
  constructor(private readonly repository: LineageRepository) {}

  async getLineage(): Promise<DataLineageResponse> {
    return DataLineageResponseSchema.parse(await this.repository.getLineage());
  }
}
