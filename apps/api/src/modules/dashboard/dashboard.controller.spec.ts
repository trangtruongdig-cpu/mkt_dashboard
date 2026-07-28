import { INestApplication } from "@nestjs/common";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import type {
  SocialMentionsQuery,
  SocialMentionsResponse,
} from "@ptit/shared";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DashboardController } from "./dashboard.controller";
import { DashboardRepository, DemoDashboardRepository } from "./dashboard.repository";
import { DashboardService } from "./dashboard.service";

/**
 * Kiểm biên của `GET /v1/social-mentions`.
 *
 * Hai điều bài test này giữ, và cả hai đều là chỗ đã từng hỏng ở nơi khác trong dự án:
 *
 *  1. Tham số sai phải trả 400, KHÔNG phải 500. Gọi `.parse()` trần trong controller
 *     ném `ZodError`, Nest không biết đó là lỗi của người gửi nên quy thành lỗi máy chủ —
 *     người dùng gõ nhầm một chữ mà tưởng hệ thống sập.
 *  2. Phản hồi phải qua đúng schema dùng chung. Repository trả thiếu một trường là hỏng
 *     ngay ở đây, không lọt xuống giao diện.
 */

const MOT_Y_KIEN: SocialMentionsResponse["mentions"][number] = {
  key: "yt:abc123",
  platform: "youtube",
  sourceName: "Kênh Tuyển sinh PTIT",
  contentType: "comment",
  url: "https://www.youtube.com/watch?v=abc#comment",
  text: "Học phí năm nay tăng hơi nhiều so với năm ngoái.",
  occurredAt: "2026-07-20T03:00:00.000Z",
  occurredAtEstimated: false,
  likeCount: 12,
  sentiment: "negative",
  confidence: 0.91,
  truncated: false,
};

/** Kho giả lập: trả đúng hợp đồng và ghi lại truy vấn nhận được để kiểm bộ lọc. */
class KhoGiaLap extends DemoDashboardRepository {
  truyVanNhanDuoc: SocialMentionsQuery | null = null;

  override async getSocialMentions(
    query: SocialMentionsQuery,
  ): Promise<SocialMentionsResponse> {
    this.truyVanNhanDuoc = query;
    return {
      period: { from: "2026-05-01", to: "2026-07-27", label: "3 tháng gần nhất" },
      modelVersion: "visobert-v1",
      totalMatching: 1,
      counts: { positive: 0, neutral: 0, negative: 1 },
      mentions: [MOT_Y_KIEN],
      confidenceThreshold: 0.7,
    };
  }
}

describe("GET /v1/social-mentions", () => {
  let app: INestApplication;
  let kho: KhoGiaLap;

  beforeAll(async () => {
    kho = new KhoGiaLap();

    const module = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [DashboardService, { provide: DashboardRepository, useValue: kho }],
    }).compile();

    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    app.setGlobalPrefix("api");
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("trả danh sách ý kiến kèm mẫu số của bộ lọc", async () => {
    const phan_hoi = await request(app.getHttpServer())
      .get("/api/v1/social-mentions")
      .expect(200);

    expect(phan_hoi.body.totalMatching).toBe(1);
    expect(phan_hoi.body.counts).toEqual({ positive: 0, neutral: 0, negative: 1 });
    expect(phan_hoi.body.mentions).toHaveLength(1);
    expect(phan_hoi.body.mentions[0].key).toBe("yt:abc123");
    // Ngưỡng tin cậy phải đi kèm phản hồi để giao diện không tự đặt một ngưỡng khác.
    expect(phan_hoi.body.confidenceThreshold).toBe(0.7);
  });

  it("không truyền limit thì lấy mặc định 50, không lấy cả kho", async () => {
    await request(app.getHttpServer()).get("/api/v1/social-mentions").expect(200);

    expect(kho.truyVanNhanDuoc?.limit).toBe(50);
  });

  it("chuyển bộ lọc xuống tầng kho đúng như người dùng gửi", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/social-mentions?sentiment=negative&platform=youtube&limit=10")
      .expect(200);

    expect(kho.truyVanNhanDuoc).toMatchObject({
      sentiment: "negative",
      platform: "youtube",
      limit: 10,
    });
  });

  it("sắc thái không hợp lệ thì trả 400, không phải 500", async () => {
    const phan_hoi = await request(app.getHttpServer())
      .get("/api/v1/social-mentions?sentiment=vui-ve")
      .expect(400);

    expect(phan_hoi.body.message).toBeDefined();
  });

  it("limit vượt trần 200 thì trả 400 — danh sách này để đọc, không phải để xuất dữ liệu", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/social-mentions?limit=5000")
      .expect(400);
  });

  it("limit không phải số thì trả 400", async () => {
    await request(app.getHttpServer())
      .get("/api/v1/social-mentions?limit=nhieu")
      .expect(400);
  });
});
