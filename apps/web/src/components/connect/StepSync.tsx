"use client";

import type { ConnectionStatus, SyncStatus } from "@ptit/shared";
import { useCallback, useEffect, useState } from "react";
import { connectApi } from "@/lib/api-client";

interface StepSyncProps {
  status: ConnectionStatus;
}

const NHAN_TRANG_THAI: Record<SyncStatus["state"], string> = {
  chua_chay: "Chưa chạy lần nào",
  dang_chay: "Đang đồng bộ…",
  thanh_cong: "Đồng bộ xong",
  that_bai: "Đồng bộ thất bại",
};

export function StepSync({ status }: StepSyncProps) {
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [loi, setLoi] = useState<string | null>(null);

  const doc = useCallback((): void => {
    connectApi
      .syncStatus()
      .then(setSync)
      .catch((e: unknown) => {
        setLoi(e instanceof Error ? e.message : "Không đọc được tiến độ");
      });
  }, []);

  // Đọc lần đầu. Cập nhật state nằm trong callback của promise chứ không nằm thẳng
  // trong thân effect — nếu không sẽ gây chuỗi render nối tiếp.
  useEffect(() => {
    doc();
  }, [doc]);

  // Chỉ hỏi lại khi đang chạy — tránh gọi API liên tục lúc rảnh.
  useEffect(() => {
    if (sync?.state !== "dang_chay") return;
    const dinh_ky = setInterval(doc, 2000);
    return () => clearInterval(dinh_ky);
  }, [sync?.state, doc]);

  const chay = async (): Promise<void> => {
    setLoi(null);
    try {
      setSync(await connectApi.startSync());
    } catch (e: unknown) {
      setLoi(e instanceof Error ? e.message : "Không khởi động được lượt đồng bộ");
    }
  };

  const dangChay = sync?.state === "dang_chay";

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-hairline bg-plane p-3 text-sm">
        {/* Chỉ hiện khi biết email — kết nối cũ chưa xin quyền openid nên có thể rỗng. */}
        {status.accountEmail ? (
          <p className="text-ink">
            <span className="text-ink-muted">Tài khoản: </span>
            {status.accountEmail}
          </p>
        ) : null}
        <p className="text-ink">
          <span className="text-ink-muted">Property: </span>
          {status.selectedProperty?.displayName} (ID {status.selectedProperty?.propertyId})
        </p>
      </div>

      <button
        type="button"
        disabled={dangChay}
        onClick={() => void chay()}
        className="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-opacity disabled:opacity-40"
        style={{ background: "var(--series-1)" }}
      >
        {dangChay ? "Đang đồng bộ…" : "Đồng bộ dữ liệu từ Google Analytics"}
      </button>

      <p className="text-[11px] leading-snug text-ink-muted">
        Lượt đầu kéo dữ liệu từ ngày bắt đầu đến hôm nay nên có thể mất vài phút. Các
        lượt sau chỉ lấy phần mới.
      </p>

      {loi ? (
        <p className="text-sm" style={{ color: "var(--delta-bad)" }}>
          {loi}
        </p>
      ) : null}

      {sync ? (
        <div className="space-y-3 border-t border-hairline pt-4">
          <p className="text-sm font-medium text-ink">{NHAN_TRANG_THAI[sync.state]}</p>

          {sync.rowsByStream ? (
            <ul className="space-y-1 text-sm tabular-nums">
              {Object.entries(sync.rowsByStream).map(([ten, so_dong]) => (
                <li key={ten} className="flex justify-between gap-4">
                  <span className="truncate font-mono text-xs text-ink-secondary">{ten}</span>
                  <span className="shrink-0 text-ink">
                    {so_dong.toLocaleString("vi-VN")} dòng
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {sync.logTail.length > 0 ? (
            <pre className="max-h-56 overflow-auto rounded-lg bg-plane p-3 font-mono text-[11px] leading-relaxed text-ink-secondary">
              {sync.logTail.join("\n")}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
