import { INestApplication } from "@nestjs/common";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { Test } from "@nestjs/testing";
import {
  buildDemoCascade,
  type KpiTargetOverride,
  type UpdateKpiTarget,
} from "@ptit/shared";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuthGuard, type RequestWithSession } from "../auth/auth.guard";
import { KpiAdminController } from "./kpi-admin.controller";
import { KpiTargetRepository } from "./kpi-target.repository";
import { KpiController } from "./kpi.controller";
import { DemoKpiRepository, KpiRepository } from "./kpi.repository";
import { KpiService } from "./kpi.service";

/**
 * Kiểm biên của việc sửa mức cần đạt.
 *
 * Ba điều bài test này giữ, và đều là chỗ bản cũ (route handler của Next.js) làm sai:
 *
 *  1. Sửa mục tiêu thì `status` phải được TÍNH LẠI ở máy chủ. Bản cũ để frontend tự
 *     chồng bản ghi đè, nên có đường một chỉ số bị hạ mục tiêu xuống cho vừa số hiện
 *     tại mà vẫn giữ nhãn "có rủi ro" của mức cũ.
 *  2. Thiếu căn cứ phải trả 400. Mức cần đạt là cam kết, không nhận con số trần.
 *  3. Khoá chỉ số không tồn tại phải trả 404, không được lặng lẽ nhận. Bản cũ nhận mọi
 *     khoá, nên bản ghi đè nằm trong kho mà không bao giờ có hiệu lực.
 */

/** Chỉ số đầu tiên của cây cascade, lấy động để test không mục khi cây đổi tên chỉ số. */
function chiSoDau() {
  const kpi = buildDemoCascade().kpis[0];
  if (!kpi) throw new Error("Cây cascade không có chỉ số nào — bộ dữ liệu demo đã hỏng");
  return kpi;
}

const KHOA_THAT = chiSoDau().key;

const CAN_CU: UpdateKpiTarget = {
  target: 42,
  targetRationale: { basis: "internal_benchmark", note: "Mức đã đạt cùng kỳ 2025." },
};

/** Thay cho bảng `kpi_target_override` — giữ trong bộ nhớ để test không cần PostgreSQL. */
class KhoGiaLap extends KpiTargetRepository {
  private luu = new Map<string, KpiTargetOverride>();

  constructor() {
    super(undefined as never);
  }

  xoaSach(): void {
    this.luu.clear();
  }

  async list(): Promise<KpiTargetOverride[]> {
    return [...this.luu.values()].sort((a, b) => a.kpiKey.localeCompare(b.kpiKey));
  }

  async save(
    kpiKey: string,
    thay_doi: UpdateKpiTarget,
    nguoi_sua: string,
  ): Promise<KpiTargetOverride> {
    const ban_ghi: KpiTargetOverride = {
      kpiKey,
      target: thay_doi.target,
      targetRationale: thay_doi.targetRationale,
      updatedBy: nguoi_sua,
      updatedAt: new Date().toISOString(),
    };
    this.luu.set(kpiKey, ban_ghi);
    return ban_ghi;
  }

  async remove(kpiKey: string): Promise<boolean> {
    return this.luu.delete(kpiKey);
  }
}

describe("Mức cần đạt của chỉ số", () => {
  let app: INestApplication;
  const kho = new KhoGiaLap();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [KpiController, KpiAdminController],
      providers: [
        KpiService,
        { provide: KpiRepository, useClass: DemoKpiRepository },
        { provide: KpiTargetRepository, useValue: kho },
      ],
    })
      // Thay guard thật bằng một phiên cố định: ở đây đang kiểm luồng sửa mục tiêu,
      // không kiểm đăng nhập — phần đó là việc của test riêng cho AuthModule.
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: {
          switchToHttp: () => { getRequest: () => RequestWithSession };
        }) => {
          context.switchToHttp().getRequest().session = {
            user: { username: "ptit_admin", displayName: "Quản trị viên", lastLoginAt: null },
            expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
          };
          return true;
        },
      })
      .compile();

    app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => kho.xoaSach());

  it("chưa sửa gì thì danh sách rỗng", async () => {
    const res = await request(app.getHttpServer()).get("/v1/kpi-targets").expect(200);
    expect(res.body).toEqual({ overrides: [] });
  });

  it("sửa xong thì ghi lại đúng tên người đăng nhập", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/v1/admin/kpi-targets/${KHOA_THAT}`)
      .send(CAN_CU)
      .expect(200);

    expect(res.body.overrides).toHaveLength(1);
    expect(res.body.overrides[0]).toMatchObject({
      kpiKey: KHOA_THAT,
      target: 42,
      updatedBy: "ptit_admin",
    });
  });

  it("cây mục tiêu trả về mức đã sửa, không phải mức mặc định", async () => {
    await request(app.getHttpServer())
      .patch(`/v1/admin/kpi-targets/${KHOA_THAT}`)
      .send(CAN_CU)
      .expect(200);

    const res = await request(app.getHttpServer()).get("/v1/kpi-cascade").expect(200);
    const kpi = res.body.kpis.find((k: { key: string }) => k.key === KHOA_THAT);
    expect(kpi.target).toBe(42);
    expect(kpi.targetRationale.note).toBe(CAN_CU.targetRationale.note);
  });

  it("gọi lại hai lần cùng tham số vẫn chỉ có một bản ghi", async () => {
    for (let i = 0; i < 2; i += 1) {
      await request(app.getHttpServer())
        .patch(`/v1/admin/kpi-targets/${KHOA_THAT}`)
        .send(CAN_CU)
        .expect(200);
    }

    const res = await request(app.getHttpServer()).get("/v1/kpi-targets").expect(200);
    expect(res.body.overrides).toHaveLength(1);
  });

  it("thiếu căn cứ thì 400, không phải 500", async () => {
    const res = await request(app.getHttpServer())
      .patch(`/v1/admin/kpi-targets/${KHOA_THAT}`)
      .send({ target: 42, targetRationale: { basis: "internal_benchmark", note: "" } })
      .expect(400);

    expect(res.body.message).toContain("không hợp lệ");
  });

  it("khoá chỉ số không tồn tại thì 404", async () => {
    await request(app.getHttpServer())
      .patch("/v1/admin/kpi-targets/khong_co_chi_so_nao_ten_the_nay")
      .send(CAN_CU)
      .expect(404);
  });

  it("gỡ bản ghi đè chưa từng có thì 404", async () => {
    await request(app.getHttpServer())
      .delete(`/v1/admin/kpi-targets/${KHOA_THAT}`)
      .expect(404);
  });

  it("gỡ bản ghi đè đã có thì đưa mục tiêu về mặc định", async () => {
    const mac_dinh = chiSoDau().target;

    await request(app.getHttpServer())
      .patch(`/v1/admin/kpi-targets/${KHOA_THAT}`)
      .send(CAN_CU)
      .expect(200);
    await request(app.getHttpServer())
      .delete(`/v1/admin/kpi-targets/${KHOA_THAT}`)
      .expect(200);

    const res = await request(app.getHttpServer()).get("/v1/kpi-cascade").expect(200);
    const kpi = res.body.kpis.find((k: { key: string }) => k.key === KHOA_THAT);
    expect(kpi.target).toBe(mac_dinh);
  });
});
