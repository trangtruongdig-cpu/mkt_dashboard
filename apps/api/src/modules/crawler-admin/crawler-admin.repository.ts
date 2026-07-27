import { Inject, Injectable } from "@nestjs/common";
import type {
  CrawlerRun,
  CrawlerRunStatus,
  CrawlerSchedule,
  CrawlerSource,
  CrawlerSourceKind,
  CrawlerTrigger,
} from "@ptit/shared";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { DB, type Database } from "../../db/db.module";
import { crawlerRun, crawlerSource } from "../../db/schema";

type SourceRow = typeof crawlerSource.$inferSelect;
type RunRow = typeof crawlerRun.$inferSelect;

/**
 * Truy vấn cho màn hình quản trị crawler.
 *
 * Bảng `crawler_source` và `crawler_run` là bảng ứng dụng nên đọc bằng Drizzle.
 * Bảng `raw_news_mention` do worker Python sở hữu — đọc bằng SQL thô, đúng như quy tắc
 * với các bảng không thuộc lược đồ Drizzle.
 */
@Injectable()
export class CrawlerAdminRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  async listSources(): Promise<CrawlerSource[]> {
    const rows = await this.db
      .select()
      .from(crawlerSource)
      .orderBy(crawlerSource.kind, crawlerSource.name);
    return rows.map(toSource);
  }

  async findSourceById(id: number): Promise<CrawlerSource | undefined> {
    const [row] = await this.db
      .select()
      .from(crawlerSource)
      .where(eq(crawlerSource.id, id))
      .limit(1);
    return row ? toSource(row) : undefined;
  }

  async updateSource(
    id: number,
    patch: { enabled?: boolean; pages?: number; schedule?: CrawlerSchedule },
    updatedBy: string,
  ): Promise<CrawlerSource | undefined> {
    const [row] = await this.db
      .update(crawlerSource)
      .set({ ...patch, updatedBy, updatedAt: new Date() })
      .where(eq(crawlerSource.id, id))
      .returning();
    return row ? toSource(row) : undefined;
  }

  async listRuns(limit: number): Promise<CrawlerRun[]> {
    const rows = await this.db
      .select()
      .from(crawlerRun)
      .orderBy(desc(crawlerRun.startedAt))
      .limit(limit);
    return rows.map(toRun);
  }

  async findLastRun(): Promise<CrawlerRun | undefined> {
    const [row] = await this.db
      .select()
      .from(crawlerRun)
      .orderBy(desc(crawlerRun.startedAt))
      .limit(1);
    return row ? toRun(row) : undefined;
  }

  /** Có lượt nào đang chờ hoặc đang chạy không. Dùng để khoá nút "Chạy ngay". */
  async hasPendingOrRunning(): Promise<boolean> {
    const [row] = await this.db
      .select({ id: crawlerRun.id })
      .from(crawlerRun)
      .where(
        inArray(crawlerRun.status, [
          "cho_chay",
          "dang_chay",
        ] satisfies CrawlerRunStatus[]),
      )
      .limit(1);
    return Boolean(row);
  }

  /**
   * Xếp một lượt chạy vào hàng đợi.
   *
   * API KHÔNG gọi sang worker — nó chỉ ghi dòng `cho_chay` này. Worker nhặt lên
   * ở lần quét kế tiếp. Nhờ vậy hai bên chạy trong hai container không cần biết
   * địa chỉ mạng của nhau.
   */
  async enqueueRun(input: {
    trigger: CrawlerTrigger;
    sourceName: string | null;
  }): Promise<CrawlerRun> {
    const [row] = await this.db
      .insert(crawlerRun)
      .values({ ...input, status: "cho_chay" satisfies CrawlerRunStatus })
      .returning();
    return toRun(row as RunRow);
  }

  async countSources(): Promise<{ total: number; enabled: number; scheduled: number }> {
    const [row] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        enabled: sql<number>`count(*) filter (where ${crawlerSource.enabled})::int`,
        scheduled: sql<number>`count(*) filter (where ${crawlerSource.enabled} and ${crawlerSource.schedule} <> 'tat')::int`,
      })
      .from(crawlerSource);

    return row ?? { total: 0, enabled: 0, scheduled: 0 };
  }

  /**
   * Đếm tin bài đã thu về.
   *
   * `raw_news_mention` do worker Python tạo, không có trong lược đồ Drizzle — đọc bằng
   * SQL thô. Bảng có thể chưa tồn tại nếu worker chưa chạy lần nào, nên phải kiểm tra
   * trước bằng `to_regclass` thay vì để truy vấn ném lỗi.
   */
  async countMentions(): Promise<number> {
    const rows = await this.db.execute<{ so: number }>(sql`
      SELECT CASE
               WHEN to_regclass('public.raw_news_mention') IS NULL THEN 0
               ELSE (SELECT count(*) FROM public.raw_news_mention)
             END::int AS so
    `);
    return rows[0]?.so ?? 0;
  }
}

function toSource(row: SourceRow): CrawlerSource {
  return {
    id: row.id,
    kind: row.kind as CrawlerSourceKind,
    name: row.name,
    publisher: row.publisher,
    url: row.url,
    enabled: row.enabled,
    pages: row.pages,
    schedule: row.schedule as CrawlerSchedule,
    note: row.note,
    lastRunAt: row.lastRunAt ? row.lastRunAt.toISOString() : null,
    lastRunStatus: row.lastRunStatus as CrawlerRunStatus | null,
    updatedBy: row.updatedBy,
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toRun(row: RunRow): CrawlerRun {
  return {
    id: row.id,
    startedAt: row.startedAt.toISOString(),
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
    trigger: row.trigger as CrawlerTrigger,
    status: row.status as CrawlerRunStatus,
    sourceName: row.sourceName,
    mentionsFound: row.mentionsFound,
    mentionsNew: row.mentionsNew,
    extractedOk: row.extractedOk,
    extractedFailed: row.extractedFailed,
    errorMessage: row.errorMessage,
  };
}
