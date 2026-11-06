import { INestApplication } from "@nestjs/common";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import {
  LINEAGE_DATASETS,
  LINEAGE_EDGES,
  LINEAGE_KPI_LINKS,
  type DataLineageResponse,
} from "@ptit/shared";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { LineageController } from "./lineage.controller";
import { LineageRepository, StaticLineageRepository } from "./lineage.repository";
import { LineageService } from "./lineage.service";

/**
 * Kiểm biên của `GET /v1/data-lineage`.
 *
 * Điều quan trọng nhất bài test này giữ: bảng chứa dữ liệu vận hành của Học viện KHÔNG
 * BAO GIỜ lọt vào phần dữ liệu mẫu. Màn hình này có thể được mở cho người ngoài xem
 * trong buổi nghiệm thu, nên một lần rò là rò thật.
 */

async function dungApp(kho: LineageRepository): Promise<INestApplication> {
  const module = await Test.createTestingModule({
    controllers: [LineageController],
    providers: [LineageService, { provide: LineageRepository, useValue: kho }],
  }).compile();

  const app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  app.setGlobalPrefix("api");
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

describe("GET /v1/data-lineage", () => {
  let app: INestApplication | null = null;

  afterEach(async () => {
    await app?.close();
    app = null;
  });

  it("trả bản đồ đủ bốn tầng kèm liên kết tới chỉ số", async () => {
    app = await dungApp(new StaticLineageRepository());

    const phan_hoi = await request(app.getHttpServer())
      .get("/api/v1/data-lineage")
      .expect(200);

    const body = phan_hoi.body as DataLineageResponse;
    expect(body.datasets).toHaveLength(LINEAGE_DATASETS.length);
    expect(body.edges).toHaveLength(LINEAGE_EDGES.length);
    expect(body.kpiLinks).toHaveLength(LINEAGE_KPI_LINKS.length);

    const tang = new Set(body.datasets.map((d) => d.stage));
    expect(tang.has("raw")).toBe(true);
    expect(tang.has("mart")).toBe(true);
  });

  it("mọi cạnh đều nối hai bảng có thật trong danh sách", async () => {
    app = await dungApp(new StaticLineageRepository());

    const body = (await request(app.getHttpServer()).get("/api/v1/data-lineage"))
      .body as DataLineageResponse;
    const ten = new Set(body.datasets.map((d) => d.name));

    for (const canh of body.edges) {
      expect(ten.has(canh.from), `cạnh từ ${canh.from}`).toBe(true);
      expect(ten.has(canh.to), `cạnh tới ${canh.to}`).toBe(true);
    }
  });

  it("từ chối cả gói khi có mẫu dữ liệu của bảng thuộc nhóm nội bộ", async () => {
    // Kho hỏng: cố hiện mẫu của bảng GA4 — dữ liệu vận hành của Học viện.
    const kho_ro_ri: LineageRepository = {
      async getLineage(): Promise<DataLineageResponse> {
        return {
          updatedAt: new Date().toISOString(),
          datasets: [...LINEAGE_DATASETS],
          edges: [...LINEAGE_EDGES],
          kpiLinks: [...LINEAGE_KPI_LINKS],
          samples: [
            {
              dataset: "ga4_pages_daily",
              columns: ["pagePath", "screenPageViews"],
              rows: [["/tuyen-sinh", "1234"]],
              limit: 5,
            },
          ],
        };
      },
    };

    app = await dungApp(kho_ro_ri);

    // Schema từ chối → Nest quy thành 500. Thà sập màn hình còn hơn rò dữ liệu.
    await request(app.getHttpServer()).get("/api/v1/data-lineage").expect(500);
  });

  it("từ chối cả gói khi cạnh trỏ tới bảng không tồn tại", async () => {
    const kho_sai: LineageRepository = {
      async getLineage(): Promise<DataLineageResponse> {
        return {
          updatedAt: new Date().toISOString(),
          datasets: [...LINEAGE_DATASETS],
          edges: [
            ...LINEAGE_EDGES,
            { from: "raw_news_mention", to: "mart__bang_khong_ton_tai" },
          ],
          kpiLinks: [...LINEAGE_KPI_LINKS],
          samples: [],
        };
      },
    };

    app = await dungApp(kho_sai);

    await request(app.getHttpServer()).get("/api/v1/data-lineage").expect(500);
  });

  it("mọi chỉ số trong bản đồ đều trỏ tới bảng tầng mart", async () => {
    app = await dungApp(new StaticLineageRepository());

    const body = (await request(app.getHttpServer()).get("/api/v1/data-lineage"))
      .body as DataLineageResponse;
    const tang_cua = new Map(body.datasets.map((d) => [d.name, d.stage]));

    for (const lien_ket of body.kpiLinks) {
      expect(tang_cua.get(lien_ket.dataset), lien_ket.kpiKey).toBe("mart");
    }
  });
});
