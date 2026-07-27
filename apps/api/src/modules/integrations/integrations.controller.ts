import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import { ApiExcludeEndpoint, ApiOperation, ApiTags } from "@nestjs/swagger";
import {
  ConnectionStatusSchema,
  Ga4PropertyListSchema,
  SaveOauthClientSchema,
  SelectPropertySchema,
  SyncStatusSchema,
  type ConnectionStatus,
  type ConnectionStage,
  type Ga4PropertyList,
  type SaveOauthClient,
  type SelectProperty,
  type SyncStatus,
} from "@ptit/shared";
import type { FastifyReply } from "fastify";
import { ZodOkResponse } from "../../common/openapi";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import { CredentialStoreService } from "./credential-store.service";
import { Ga4AdminService } from "./ga4-admin.service";
import { GoogleOauthService } from "./google-oauth.service";
import { IngestRunnerService } from "./ingest-runner.service";

@ApiTags("Kết nối dữ liệu")
@Controller("v1/integrations")
export class IntegrationsController {
  constructor(
    private readonly store: CredentialStoreService,
    private readonly oauth: GoogleOauthService,
    private readonly ga4Admin: Ga4AdminService,
    private readonly ingest: IngestRunnerService,
  ) {}

  @Get("status")
  @ApiOperation({ summary: "Trạng thái kết nối Google Analytics" })
  @ZodOkResponse(ConnectionStatusSchema, "Trạng thái hiện tại của luồng kết nối")
  getStatus(): ConnectionStatus {
    const stored = this.store.read();

    let stage: ConnectionStage = "chua_khai_bao_client";
    if (stored.clientId && stored.clientSecret) stage = "chua_dang_nhap";
    if (stored.refreshToken) stage = "chua_chon_property";
    if (stored.refreshToken && stored.propertyId) stage = "san_sang";

    return {
      stage,
      accountEmail: stored.accountEmail,
      connectedAt: stored.connectedAt,
      redirectUri: this.oauth.redirectUri,
      selectedProperty: stored.propertyId
        ? {
            name: `properties/${stored.propertyId}`,
            propertyId: stored.propertyId,
            displayName: stored.propertyDisplayName ?? stored.propertyId,
            accountName: stored.accountDisplayName ?? "",
          }
        : null,
    };
  }

  @Post("google/client")
  @ApiOperation({
    summary: "Lưu OAuth client (bước một lần)",
    description:
      "Nhận client_id và client_secret của OAuth client do người dùng tạo trên Google Cloud. " +
      "Lưu vào file .secrets/google.json quyền 0600, không bao giờ trả ngược ra ngoài.",
  })
  @ZodOkResponse(ConnectionStatusSchema, "Trạng thái sau khi lưu")
  saveClient(
    @Body(new ZodValidationPipe(SaveOauthClientSchema)) body: SaveOauthClient,
  ): ConnectionStatus {
    this.store.write({
      clientId: body.clientId.trim(),
      clientSecret: body.clientSecret.trim(),
    });
    return this.getStatus();
  }

  @Get("google/authorize")
  @ApiExcludeEndpoint()
  authorize(@Res() res: FastifyReply): void {
    // Phải đặt status tường minh: Fastify giữ nguyên mã trạng thái đã có sẵn thay vì
    // tự dùng 302, nên gọi redirect() trần sẽ trả về 200 kèm header Location — trình
    // duyệt không đi đâu cả.
    void res.status(302).redirect(this.oauth.buildAuthorizeUrl());
  }

  @Get("google/callback")
  @ApiExcludeEndpoint()
  async callback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Res() res: FastifyReply,
  ): Promise<void> {
    const ve_trang_ket_noi = (tham_so: string): void => {
      void res.status(302).redirect(`${this.oauth.webUrl}/ket-noi?${tham_so}`);
    };

    if (error) return ve_trang_ket_noi(`loi=${encodeURIComponent(error)}`);
    if (!code || !state) return ve_trang_ket_noi("loi=thieu_ma_uy_quyen");

    try {
      await this.oauth.handleCallback(code, state);
      ve_trang_ket_noi("da_ket_noi=1");
    } catch (loi) {
      const thong_diep = loi instanceof Error ? loi.message : "khong_ro";
      ve_trang_ket_noi(`loi=${encodeURIComponent(thong_diep)}`);
    }
  }

  @Post("google/disconnect")
  @ApiOperation({ summary: "Ngắt kết nối tài khoản Google" })
  @ZodOkResponse(ConnectionStatusSchema, "Trạng thái sau khi ngắt")
  disconnect(): ConnectionStatus {
    this.oauth.disconnect();
    return this.getStatus();
  }

  @Get("ga4/properties")
  @ApiOperation({
    summary: "Danh sách property GA4 tài khoản có quyền xem",
    description: "Tự dò qua Admin API — người dùng không phải đi tìm và chép Property ID.",
  })
  @ZodOkResponse(Ga4PropertyListSchema, "Danh sách property")
  async listProperties(): Promise<Ga4PropertyList> {
    return { properties: await this.ga4Admin.listProperties() };
  }

  @Post("ga4/property")
  @ApiOperation({ summary: "Chọn property để đồng bộ" })
  @ZodOkResponse(ConnectionStatusSchema, "Trạng thái sau khi chọn")
  async selectProperty(
    @Body(new ZodValidationPipe(SelectPropertySchema)) body: SelectProperty,
  ): Promise<ConnectionStatus> {
    const properties = await this.ga4Admin.listProperties();
    const chon = properties.find((p) => p.propertyId === body.propertyId);

    if (!chon) {
      throw new BadRequestException(
        "Tài khoản đang đăng nhập không có quyền xem property này.",
      );
    }

    this.store.write({
      propertyId: chon.propertyId,
      propertyDisplayName: chon.displayName,
      accountDisplayName: chon.accountName,
    });
    return this.getStatus();
  }

  @Post("ga4/sync")
  @ApiOperation({ summary: "Bắt đầu đồng bộ dữ liệu GA4" })
  @ZodOkResponse(SyncStatusSchema, "Trạng thái lượt đồng bộ vừa khởi động")
  startSync(): SyncStatus {
    const stored = this.store.read();
    if (!stored.refreshToken || !stored.propertyId) {
      throw new BadRequestException("Chưa kết nối Google hoặc chưa chọn property.");
    }
    return this.ingest.start();
  }

  @Get("ga4/sync")
  @ApiOperation({ summary: "Tiến độ lượt đồng bộ" })
  @ZodOkResponse(SyncStatusSchema, "Trạng thái và log gần nhất")
  getSyncStatus(): SyncStatus {
    return this.ingest.getStatus();
  }
}
