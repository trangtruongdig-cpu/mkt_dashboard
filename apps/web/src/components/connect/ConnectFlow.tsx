"use client";

import type { ConnectionStage, ConnectionStatus } from "@ptit/shared";
import { useCallback, useEffect, useState } from "react";
import { connectApi, isApiConfigured } from "@/lib/api-client";
import { StepClient } from "./StepClient";
import { StepProperty } from "./StepProperty";
import { StepSignIn } from "./StepSignIn";
import { StepSync } from "./StepSync";

const CAC_BUOC: { stage: ConnectionStage; nhan: string }[] = [
  { stage: "chua_khai_bao_client", nhan: "Đăng ký ứng dụng" },
  { stage: "chua_dang_nhap", nhan: "Đăng nhập Google" },
  { stage: "chua_chon_property", nhan: "Chọn property" },
  { stage: "san_sang", nhan: "Đồng bộ" },
];

interface ConnectFlowProps {
  /** Thông điệp lỗi Google trả về qua đường dẫn, nếu có. */
  loiTuGoogle: string | null;
}

export function ConnectFlow({ loiTuGoogle }: ConnectFlowProps) {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [loi, setLoi] = useState<string | null>(loiTuGoogle);
  const [dangLuu, setDangLuu] = useState(false);

  const taiTrangThai = useCallback(async (): Promise<void> => {
    try {
      setStatus(await connectApi.status());
    } catch (e: unknown) {
      setLoi(e instanceof Error ? e.message : "Không đọc được trạng thái kết nối");
    }
  }, []);

  // Đọc trạng thái lần đầu. Cập nhật state nằm trong callback của promise, không nằm
  // thẳng trong thân effect — nếu không sẽ gây chuỗi render nối tiếp.
  useEffect(() => {
    let huy = false;

    connectApi
      .status()
      .then((ket_qua) => {
        if (!huy) setStatus(ket_qua);
      })
      .catch((e: unknown) => {
        if (!huy) {
          setLoi(e instanceof Error ? e.message : "Không đọc được trạng thái kết nối");
        }
      });

    return () => {
      huy = true;
    };
  }, []);

  if (!isApiConfigured()) {
    return (
      <div className="rounded-xl border border-hairline bg-surface p-5 text-sm text-ink-secondary">
        <p className="font-medium text-ink">Chưa cấu hình địa chỉ API</p>
        <p className="mt-1.5">
          Tạo file <code>apps/web/.env.local</code> với dòng{" "}
          <code>NEXT_PUBLIC_API_URL=http://localhost:3001</code> rồi khởi động lại{" "}
          <code>pnpm dev</code>.
        </p>
      </div>
    );
  }

  // Lần đọc đầu tiên hỏng thì phải nói ra. Trước đây khối này rơi thẳng xuống nhánh
  // "đang đọc" và trang quay mãi không hiện lý do.
  if (!status && loi) {
    return (
      <div className="space-y-3 rounded-xl border border-hairline bg-surface p-5">
        <p className="text-sm font-medium" style={{ color: "var(--delta-bad)" }}>
          Không kết nối được tới API
        </p>
        <p className="text-sm text-ink-secondary">{loi}</p>
        <p className="text-xs text-ink-muted">
          Kiểm tra: API đã chạy chưa (<code>pnpm dev</code>), và{" "}
          <code>NEXT_PUBLIC_API_URL</code> trong <code>apps/web/.env.local</code> có trỏ
          đúng cổng API không. Đổi file này xong phải khởi động lại{" "}
          <code>pnpm dev</code> thì Next.js mới đọc giá trị mới.
        </p>
        <button
          type="button"
          onClick={() => {
            setLoi(null);
            void taiTrangThai();
          }}
          className="rounded-lg border border-hairline px-3 py-1.5 text-sm font-medium text-ink-secondary hover:text-ink"
        >
          Thử lại
        </button>
      </div>
    );
  }

  if (!status) {
    return <p className="text-sm text-ink-muted">Đang đọc trạng thái kết nối…</p>;
  }

  const chiSoBuoc = CAC_BUOC.findIndex((b) => b.stage === status.stage);

  const luuClient = async (clientId: string, clientSecret: string): Promise<void> => {
    setDangLuu(true);
    setLoi(null);
    try {
      setStatus(await connectApi.saveOauthClient(clientId, clientSecret));
    } catch (e: unknown) {
      setLoi(e instanceof Error ? e.message : "Không lưu được OAuth client");
    } finally {
      setDangLuu(false);
    }
  };

  const ngatKetNoi = async (): Promise<void> => {
    setLoi(null);
    try {
      setStatus(await connectApi.disconnect());
    } catch (e: unknown) {
      setLoi(e instanceof Error ? e.message : "Không ngắt được kết nối");
    }
  };

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-x-2 gap-y-1 text-xs">
        {CAC_BUOC.map((buoc, i) => {
          const xong = i < chiSoBuoc;
          const dangO = i === chiSoBuoc;
          return (
            <li key={buoc.stage} className="flex items-center gap-2">
              <span
                className={
                  dangO
                    ? "font-medium text-ink"
                    : xong
                      ? "text-ink-secondary"
                      : "text-ink-muted"
                }
              >
                {xong ? "✓ " : `${i + 1}. `}
                {buoc.nhan}
              </span>
              {i < CAC_BUOC.length - 1 ? (
                <span className="text-ink-muted" aria-hidden="true">
                  ›
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>

      {loi ? (
        <div
          className="rounded-lg border px-4 py-3 text-sm"
          style={{ borderColor: "var(--delta-bad)", color: "var(--delta-bad)" }}
          role="alert"
        >
          {loi}
        </div>
      ) : null}

      <div className="rounded-xl border border-hairline bg-surface p-5">
        {status.stage === "chua_khai_bao_client" ? (
          <StepClient
            redirectUri={status.redirectUri}
            onSave={luuClient}
            dangLuu={dangLuu}
          />
        ) : null}

        {status.stage === "chua_dang_nhap" ? <StepSignIn /> : null}

        {status.stage === "chua_chon_property" ? (
          <StepProperty onSelected={taiTrangThai} />
        ) : null}

        {status.stage === "san_sang" ? <StepSync status={status} /> : null}
      </div>

      {status.accountEmail ? (
        <button
          type="button"
          onClick={() => void ngatKetNoi()}
          className="text-xs text-ink-muted underline decoration-hairline underline-offset-2 hover:text-ink-secondary"
        >
          Ngắt kết nối tài khoản {status.accountEmail}
        </button>
      ) : null}
    </div>
  );
}
