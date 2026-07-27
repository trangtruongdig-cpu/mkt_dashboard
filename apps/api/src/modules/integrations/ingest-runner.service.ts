import { ConflictException, Injectable, Logger } from "@nestjs/common";
import type { SyncStatus } from "@ptit/shared";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { CredentialStoreService } from "./credential-store.service";

const MAX_LOG_LINES = 60;

/** Dòng tổng kết do worker in ra, ví dụ: "  ga4_pages_daily: 12.345 dòng". */
const DONG_TONG_KET = /^\s{2}(\S+):\s+([\d.,]+)\s+dòng\s*$/;

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

/**
 * Chạy job hút dữ liệu của worker Python và theo dõi tiến trình.
 *
 * API không tự gọi Google Analytics Data API — việc đó do connector chính thức của
 * Airbyte làm, để sau này chuyển sang Airbyte OSS không phải viết lại gì.
 */
@Injectable()
export class IngestRunnerService {
  private readonly logger = new Logger(IngestRunnerService.name);

  private status: SyncStatus = {
    state: "chua_chay",
    startedAt: null,
    finishedAt: null,
    logTail: [],
    rowsByStream: null,
  };

  constructor(private readonly store: CredentialStoreService) {}

  getStatus(): SyncStatus {
    return this.status;
  }

  start(): SyncStatus {
    if (this.status.state === "dang_chay") {
      throw new ConflictException("Đang có một lượt đồng bộ chạy dở.");
    }

    const workerDir = join(findRepoRoot(), "apps", "worker");
    const rowsByStream: Record<string, number> = {};

    this.status = {
      state: "dang_chay",
      startedAt: new Date().toISOString(),
      finishedAt: null,
      logTail: ["Bắt đầu đồng bộ…"],
      rowsByStream: null,
    };

    const child = spawn(this.resolveUv(), ["run", "python", "-m", "ingest", "sync"], {
      cwd: workerDir,
      env: {
        ...process.env,
        PATH: `${join(homedir(), ".local", "bin")}:${process.env.PATH ?? ""}`,
      },
    });

    const ghiLog = (chunk: Buffer): void => {
      for (const dong of this.store.redact(chunk.toString()).split("\n")) {
        const sach = dong.trimEnd();
        if (!sach) continue;

        const khop = DONG_TONG_KET.exec(sach);
        if (khop?.[1] && khop[2]) {
          rowsByStream[khop[1]] = Number(khop[2].replace(/[.,]/g, ""));
        }

        this.status.logTail = [...this.status.logTail, sach].slice(-MAX_LOG_LINES);
      }
    };

    child.stdout.on("data", ghiLog);
    child.stderr.on("data", ghiLog);

    child.on("error", (loi) => {
      this.logger.error(`Không chạy được worker: ${loi.message}`);
      this.status = {
        ...this.status,
        state: "that_bai",
        finishedAt: new Date().toISOString(),
        logTail: [
          ...this.status.logTail,
          `Không chạy được worker: ${loi.message}`,
          "Kiểm tra đã cài uv chưa: curl -LsSf https://astral.sh/uv/install.sh | sh",
        ].slice(-MAX_LOG_LINES),
      };
    });

    child.on("close", (code) => {
      if (this.status.state !== "dang_chay") return;
      this.status = {
        ...this.status,
        state: code === 0 ? "thanh_cong" : "that_bai",
        finishedAt: new Date().toISOString(),
        rowsByStream: Object.keys(rowsByStream).length > 0 ? rowsByStream : null,
      };
      this.logger.log(`Đồng bộ kết thúc với mã ${code}`);
    });

    return this.status;
  }

  private resolveUv(): string {
    const ung_vien = [
      process.env.UV_BIN,
      join(homedir(), ".local", "bin", "uv"),
      "/opt/homebrew/bin/uv",
      "/usr/local/bin/uv",
    ].filter((p): p is string => Boolean(p));

    return ung_vien.find((p) => existsSync(p)) ?? "uv";
  }
}
