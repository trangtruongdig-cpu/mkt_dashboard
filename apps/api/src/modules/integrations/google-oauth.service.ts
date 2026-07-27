import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { CredentialStoreService } from "./credential-store.service";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

/**
 * Phạm vi quyền duy nhất cần xin: đọc Google Analytics.
 *
 * Quyền này đủ cho cả Data API (lấy số liệu) lẫn Admin API (liệt kê property),
 * và **chỉ đọc** — không cho phép ứng dụng sửa bất cứ thứ gì trong GA4. Người
 * duyệt quyền nhìn thấy đúng điều đó trên màn hình xin quyền của Google.
 */
const SCOPE = [
  "https://www.googleapis.com/auth/analytics.readonly",
  // Chỉ để hiển thị "đang kết nối bằng tài khoản nào" trên giao diện. Không có hai
  // scope này Google không trả id_token, và ô Tài khoản sẽ trống.
  "openid",
  "email",
].join(" ");

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
}

@Injectable()
export class GoogleOauthService {
  private readonly logger = new Logger(GoogleOauthService.name);

  /** State chống CSRF, sống trong bộ nhớ vì luồng chỉ kéo dài vài giây. */
  private readonly pendingStates = new Set<string>();

  /** Access token nhớ tạm để không phải đổi lại ở mỗi lần gọi. */
  private accessToken: { value: string; expiresAt: number } | null = null;

  constructor(private readonly store: CredentialStoreService) {}

  get redirectUri(): string {
    const base = (process.env.API_PUBLIC_URL ?? "http://localhost:3001").replace(/\/$/, "");
    return `${base}/api/v1/integrations/google/callback`;
  }

  get webUrl(): string {
    return (process.env.WEB_URL ?? "http://localhost:3000").replace(/\/$/, "");
  }

  buildAuthorizeUrl(): string {
    const { clientId } = this.store.read();
    if (!clientId) {
      throw new BadRequestException(
        "Chưa khai báo OAuth client. Hoàn tất bước 1 trên màn hình Kết nối dữ liệu.",
      );
    }

    const state = randomUUID();
    this.pendingStates.add(state);
    setTimeout(() => this.pendingStates.delete(state), 10 * 60 * 1000).unref();

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: this.redirectUri,
      response_type: "code",
      scope: SCOPE,
      // Bắt buộc để Google trả về refresh token dùng lâu dài.
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state,
    });

    return `${AUTH_ENDPOINT}?${params.toString()}`;
  }

  async handleCallback(code: string, state: string): Promise<void> {
    if (!this.pendingStates.delete(state)) {
      throw new UnauthorizedException(
        "Phiên kết nối đã hết hạn hoặc không hợp lệ. Bấm Kết nối lại từ đầu.",
      );
    }

    const { clientId, clientSecret } = this.store.read();
    const token = await this.postToken({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: this.redirectUri,
      grant_type: "authorization_code",
    });

    if (!token.refresh_token) {
      throw new BadRequestException(
        "Google không trả về refresh token. Vào myaccount.google.com/permissions, gỡ quyền của ứng dụng rồi kết nối lại.",
      );
    }

    this.store.write({
      refreshToken: token.refresh_token,
      accountEmail: this.readEmailFromIdToken(token.id_token),
      connectedAt: new Date().toISOString(),
    });

    this.accessToken = {
      value: token.access_token,
      expiresAt: Date.now() + (token.expires_in - 60) * 1000,
    };

    this.logger.log("Đã kết nối tài khoản Google thành công.");
  }

  async getAccessToken(): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAt > Date.now()) {
      return this.accessToken.value;
    }

    const { clientId, clientSecret, refreshToken } = this.store.read();
    if (!refreshToken) {
      throw new UnauthorizedException("Chưa kết nối tài khoản Google.");
    }

    const token = await this.postToken({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    });

    this.accessToken = {
      value: token.access_token,
      expiresAt: Date.now() + (token.expires_in - 60) * 1000,
    };
    return token.access_token;
  }

  disconnect(): void {
    this.accessToken = null;
    this.store.write({
      refreshToken: null,
      accountEmail: null,
      propertyId: null,
      propertyDisplayName: null,
      accountDisplayName: null,
      connectedAt: null,
    });
  }

  private async postToken(body: Record<string, string>): Promise<TokenResponse> {
    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
    });

    const payload: unknown = await response.json();

    if (!response.ok) {
      const chi_tiet =
        typeof payload === "object" && payload !== null && "error_description" in payload
          ? String((payload as { error_description: unknown }).error_description)
          : `HTTP ${response.status}`;
      this.logger.error(`Google từ chối yêu cầu token: ${chi_tiet}`);
      throw new UnauthorizedException(`Google từ chối: ${chi_tiet}`);
    }

    return payload as TokenResponse;
  }

  /** Lấy email từ id_token. Không cần xác minh chữ ký vì token đến thẳng từ Google qua TLS. */
  private readEmailFromIdToken(idToken: string | undefined): string | null {
    if (!idToken) return null;
    const phan = idToken.split(".")[1];
    if (!phan) return null;

    try {
      const payload: unknown = JSON.parse(Buffer.from(phan, "base64url").toString("utf8"));
      if (typeof payload === "object" && payload !== null && "email" in payload) {
        return String((payload as { email: unknown }).email);
      }
    } catch {
      return null;
    }
    return null;
  }
}
