import { Injectable, Logger } from "@nestjs/common";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { z } from "zod";

/**
 * Nơi cất thông tin uỷ quyền Google.
 *
 * Ghi ra file `<gốc repo>/.secrets/google.json` với quyền 0600 — cả API (Node) và
 * worker (Python) cùng đọc một file này, nên chỉ có một nguồn sự thật.
 *
 * File nằm trong .gitignore. KHÔNG bao giờ trả nội dung file này qua API.
 */
const StoredCredentialsSchema = z.object({
  clientId: z.string(),
  clientSecret: z.string(),
  refreshToken: z.string().nullable(),
  accountEmail: z.string().nullable(),
  propertyId: z.string().nullable(),
  propertyDisplayName: z.string().nullable(),
  accountDisplayName: z.string().nullable(),
  connectedAt: z.string().nullable(),
});

export type StoredCredentials = z.infer<typeof StoredCredentialsSchema>;

const EMPTY: StoredCredentials = {
  clientId: "",
  clientSecret: "",
  refreshToken: null,
  accountEmail: null,
  propertyId: null,
  propertyDisplayName: null,
  accountDisplayName: null,
  connectedAt: null,
};

/** Đi ngược lên tìm gốc workspace, để chạy đúng cả khi dev lẫn khi đã build. */
function findRepoRoot(): string {
  let current = resolve(process.cwd());
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(join(current, "pnpm-workspace.yaml"))) return current;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return process.cwd();
}

@Injectable()
export class CredentialStoreService {
  private readonly logger = new Logger(CredentialStoreService.name);
  private readonly filePath =
    process.env.GOOGLE_CREDENTIALS_PATH ??
    join(findRepoRoot(), ".secrets", "google.json");

  read(): StoredCredentials {
    if (!existsSync(this.filePath)) return { ...EMPTY };

    try {
      const raw: unknown = JSON.parse(readFileSync(this.filePath, "utf8"));
      return StoredCredentialsSchema.parse(raw);
    } catch {
      this.logger.warn(
        `Không đọc được ${this.filePath} — coi như chưa kết nối. Xoá file rồi kết nối lại.`,
      );
      return { ...EMPTY };
    }
  }

  write(patch: Partial<StoredCredentials>): StoredCredentials {
    const next: StoredCredentials = { ...this.read(), ...patch };

    mkdirSync(dirname(this.filePath), { recursive: true, mode: 0o700 });
    writeFileSync(this.filePath, `${JSON.stringify(next, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });

    return next;
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
