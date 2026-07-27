import { Injectable, InternalServerErrorException } from "@nestjs/common";
import type { Ga4Property } from "@ptit/shared";
import { GoogleOauthService } from "./google-oauth.service";

const ADMIN_ENDPOINT =
  "https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200";

interface PropertySummary {
  property?: string;
  displayName?: string;
}

interface AccountSummary {
  displayName?: string;
  propertySummaries?: PropertySummary[];
}

/**
 * Tự dò danh sách property mà tài khoản đã đăng nhập có quyền xem.
 *
 * Nhờ bước này người dùng không phải đi tìm và chép Property ID — nguồn sai sót
 * thường gặp nhất khi cấu hình tay.
 */
@Injectable()
export class Ga4AdminService {
  constructor(private readonly oauth: GoogleOauthService) {}

  async listProperties(): Promise<Ga4Property[]> {
    const accessToken = await this.oauth.getAccessToken();

    const response = await fetch(ADMIN_ENDPOINT, {
      headers: { authorization: `Bearer ${accessToken}` },
    });

    if (!response.ok) {
      throw new InternalServerErrorException(
        `Không lấy được danh sách property từ Google (HTTP ${response.status}). ` +
          "Kiểm tra xem đã bật Google Analytics Admin API trong project chưa.",
      );
    }

    const payload = (await response.json()) as {
      accountSummaries?: AccountSummary[];
    };

    const properties: Ga4Property[] = [];
    for (const account of payload.accountSummaries ?? []) {
      for (const summary of account.propertySummaries ?? []) {
        if (!summary.property) continue;
        properties.push({
          name: summary.property,
          propertyId: summary.property.replace("properties/", ""),
          displayName: summary.displayName ?? summary.property,
          accountName: account.displayName ?? "",
        });
      }
    }

    return properties.sort((a, b) => a.displayName.localeCompare(b.displayName, "vi"));
  }
}
