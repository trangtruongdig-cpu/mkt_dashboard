import { ConflictException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import type {
  CrawlerOverview,
  CrawlerRun,
  CrawlerSource,
  UpdateCrawlerSource,
} from "@ptit/shared";
import { CrawlerAdminRepository } from "./crawler-admin.repository";

/** Số lượt chạy gần nhất hiện ra trong bảng nhật ký. */
const RUN_HISTORY_LIMIT = 30;

@Injectable()
export class CrawlerAdminService {
  private readonly logger = new Logger(CrawlerAdminService.name);

  constructor(private readonly repo: CrawlerAdminRepository) {}

  listSources(): Promise<CrawlerSource[]> {
    return this.repo.listSources();
  }

  listRuns(): Promise<CrawlerRun[]> {
    return this.repo.listRuns(RUN_HISTORY_LIMIT);
  }

  async getOverview(): Promise<CrawlerOverview> {
    const [dem, totalMentions, lastRun, running] = await Promise.all([
      this.repo.countSources(),
      this.repo.countMentions(),
      this.repo.findLastRun(),
      this.repo.hasPendingOrRunning(),
    ]);

    return {
      totalSources: dem.total,
      enabledSources: dem.enabled,
      scheduledSources: dem.scheduled,
      totalMentions,
      lastRun: lastRun ?? null,
      running,
    };
  }

  async updateSource(
    id: number,
    patch: UpdateCrawlerSource,
    updatedBy: string,
  ): Promise<CrawlerSource> {
    const truoc = await this.repo.findSourceById(id);
    if (!truoc) throw new NotFoundException(`Không có nguồn nào mang mã ${id}`);

    const sau = await this.repo.updateSource(id, patch, updatedBy);
    if (!sau) throw new NotFoundException(`Không có nguồn nào mang mã ${id}`);

    // Vết kiểm toán: ai đổi gì, lúc nào. Cột updated_by lưu người, nhật ký lưu nội dung đổi.
    this.logger.log(
      `"${updatedBy}" sửa nguồn "${sau.name}": ${moTaThayDoi(truoc, sau) || "không có gì đổi"}`,
    );
    return sau;
  }

  /**
   * Xếp một lượt chạy thủ công vào hàng đợi.
   *
   * Không chạy trực tiếp ở đây: worker là tiến trình riêng, có thể nằm ở container khác.
   * API chỉ ghi dòng chờ vào PostgreSQL.
   */
  async requestRun(sourceId: number | null, requestedBy: string): Promise<CrawlerRun> {
    if (await this.repo.hasPendingOrRunning()) {
      throw new ConflictException("Đang có một lượt thu thập chờ hoặc đang chạy.");
    }

    let sourceName: string | null = null;
    if (sourceId !== null) {
      const source = await this.repo.findSourceById(sourceId);
      if (!source) throw new NotFoundException(`Không có nguồn nào mang mã ${sourceId}`);
      sourceName = source.name;
    }

    const run = await this.repo.enqueueRun({ trigger: "thu_cong", sourceName });
    this.logger.log(
      `"${requestedBy}" yêu cầu chạy ${sourceName ?? "toàn bộ nguồn đang bật"} (lượt #${run.id}).`,
    );
    return run;
  }
}

/** Mô tả thay đổi bằng tiếng Việt để đọc được trong nhật ký. */
function moTaThayDoi(truoc: CrawlerSource, sau: CrawlerSource): string {
  const phan: string[] = [];
  if (truoc.enabled !== sau.enabled) phan.push(sau.enabled ? "bật" : "tắt");
  if (truoc.schedule !== sau.schedule) phan.push(`lịch ${truoc.schedule} → ${sau.schedule}`);
  if (truoc.pages !== sau.pages) phan.push(`số trang ${truoc.pages} → ${sau.pages}`);
  return phan.join(", ");
}
