import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Env } from "../../config/env";

/**
 * Nơi đọc thông tin uỷ quyền Google.
 *
 * Bí mật CHỈ đến từ biến môi trường — CLAUDE.md mục 4. Service này không ghi ra
 * đĩa, không log giá trị bí mật, và không trả bí mật ngược qua API.
 *
 * Vì sao đổi: trước đây bộ credential được ghi ra `<gốc repo>/.secrets/google.json`.
 * File nằm ngay trong repo nên chỉ cần một lần gom cả thư mục là lọt vào commit —
 * và đã lọt thật, chỉ dừng lại nhờ GitHub chặn ở bước đẩy lên. Đưa về biến môi
 * trường thì không còn đường nào cho nó quay lại git.
 *
 * Đánh đổi phải biết: những gì luồng "Kết nối" phát hiện lúc chạy — refresh token
 * vừa đổi được, property vừa chọn, tên tài khoản — chỉ nằm trong bộ nhớ tiến trình
 * và MẤT khi khởi động lại. Muốn giữ lâu dài thì chép vào `.env` rồi dựng lại
 * container. Xem `apps/api/.env.example`.
 */
export interface StoredCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string | null;
  accountEmail: string | null;
  propertyId: string | null;
  propertyDisplayName: string | null;
  accountDisplayName: string | null;
  connectedAt: string | null;
}

/** Biến môi trường để trống nghĩa là chưa có, không phải chuỗi rỗng hợp lệ. */
function rongThanhNull(gia_tri: string): string | null {
  const cat = gia_tri.trim();
  return cat.length > 0 ? cat : null;
}

@Injectable()
export class CredentialStoreService {
  /**
   * Giá trị phát hiện trong phiên chạy hiện tại. Không bao giờ chạm đĩa.
   * Ghi đè lên giá trị từ môi trường vì nó mới hơn.
   */
  private runtime: Partial<StoredCredentials> = {};

  constructor(private readonly config: ConfigService<Env, true>) {}

  read(): StoredCredentials {
    const tu_moi_truong: StoredCredentials = {
      clientId: this.config.get("GOOGLE_CLIENT_ID", { infer: true }).trim(),
      clientSecret: this.config
        .get("GOOGLE_CLIENT_SECRET", { infer: true })
        .trim(),
      refreshToken: rongThanhNull(
        this.config.get("GOOGLE_REFRESH_TOKEN", { infer: true }),
      ),
      propertyId: rongThanhNull(
        this.config.get("GA4_PROPERTY_ID", { infer: true }),
      ),
      // Thuần hiển thị, không phải bí mật — chỉ có sau khi dò qua Admin API.
      accountEmail: null,
      propertyDisplayName: null,
      accountDisplayName: null,
      connectedAt: null,
    };

    return { ...tu_moi_truong, ...this.runtime };
  }

  /**
   * Nhớ tạm trong bộ nhớ tiến trình. Cố ý KHÔNG persist: ghi bí mật xuống đĩa là
   * đúng cái đã làm lộ khoá lần trước.
   */
  remember(patch: Partial<StoredCredentials>): StoredCredentials {
    this.runtime = { ...this.runtime, ...patch };
    return this.read();
  }

  hasOauthClient(): boolean {
    const stored = this.read();
    return stored.clientId.length > 0 && stored.clientSecret.length > 0;
  }

  /** Che mọi chuỗi trông giống bí mật trước khi đưa ra ngoài (log, giao diện). */
  redact(text: string): string {
    const { clientSecret, refreshToken } = this.read();
    let ket_qua = text;

    for (const bi_mat of [clientSecret, refreshToken]) {
      if (bi_mat && bi_mat.length > 8) {
        ket_qua = ket_qua.split(bi_mat).join("«đã ẩn»");
      }
    }

    // Token của Google: access token bắt đầu bằng "ya29.", refresh token bằng "1//".
    return ket_qua
      .replace(/ya29\.[A-Za-z0-9._-]+/g, "«đã ẩn»")
      .replace(/1\/\/[A-Za-z0-9._-]{20,}/g, "«đã ẩn»");
  }
}
