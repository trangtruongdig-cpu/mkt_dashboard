"use client";

import { useRef, useState } from "react";
import { CopyField } from "./CopyField";

interface StepClientProps {
  redirectUri: string;
  onSave: (clientId: string, clientSecret: string) => Promise<void>;
  dangLuu: boolean;
}

const LIEN_KET = {
  taoProject: "https://console.cloud.google.com/projectcreate",
  batDataApi:
    "https://console.cloud.google.com/apis/library/analyticsdata.googleapis.com",
  batAdminApi:
    "https://console.cloud.google.com/apis/library/analyticsadmin.googleapis.com",
  manHinhQuyen: "https://console.cloud.google.com/apis/credentials/consent",
  taoClient: "https://console.cloud.google.com/apis/credentials/oauthclient",
};

/**
 * Bước một lần duy nhất người dùng phải tự làm.
 *
 * Google không có API tạo OAuth client loại External — bắt buộc bấm trong console
 * của họ. Vì không bỏ được, màn hình này tối giản nó: mặc định chỉ hiện một ô thả
 * file, hướng dẫn gấp lại phía sau. Người đã có file chỉ việc kéo vào là xong.
 */
export function StepClient({ redirectUri, onSave, dangLuu }: StepClientProps) {
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [nhapTay, setNhapTay] = useState(false);
  const [loiFile, setLoiFile] = useState<string | null>(null);
  const [tenFile, setTenFile] = useState<string | null>(null);
  const [dangKeo, setDangKeo] = useState(false);
  const inputFile = useRef<HTMLInputElement>(null);

  const hopLe = clientId.trim().length > 10 && clientSecret.trim().length > 10;

  /** File Google cho tải về có dạng { "web": {...} } hoặc { "installed": {...} }. */
  const docFile = async (file: File): Promise<void> => {
    setLoiFile(null);
    try {
      const noi_dung: unknown = JSON.parse(await file.text());
      const goc =
        typeof noi_dung === "object" && noi_dung !== null
          ? ((noi_dung as Record<string, unknown>).web ??
            (noi_dung as Record<string, unknown>).installed)
          : null;

      const khoi = goc as { client_id?: string; client_secret?: string } | null;

      if (!khoi?.client_id || !khoi.client_secret) {
        setLoiFile(
          "File này không phải OAuth client của Google. Cần đúng file tải về từ nút ⬇ ở dòng client vừa tạo.",
        );
        return;
      }

      setClientId(khoi.client_id);
      setClientSecret(khoi.client_secret);
      setTenFile(file.name);
      await onSave(khoi.client_id, khoi.client_secret);
    } catch {
      setLoiFile("Không đọc được file. Hãy chọn đúng file .json tải từ Google.");
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-ink">
          Nạp thông tin ứng dụng Google
        </h2>
        <p className="mt-1 text-sm text-ink-secondary">
          Kéo vào đây file JSON mà Google cho tải về sau khi tạo OAuth client.
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDangKeo(true);
        }}
        onDragLeave={() => setDangKeo(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDangKeo(false);
          const file = e.dataTransfer.files[0];
          if (file) void docFile(file);
        }}
        className="rounded-xl border border-dashed p-6 text-center transition-colors"
        style={{
          borderColor: dangKeo ? "var(--series-1)" : "var(--baseline)",
          background: dangKeo ? "var(--plane)" : "transparent",
        }}
      >
        <p className="text-sm text-ink-secondary">
          {tenFile ? `Đã nạp ${tenFile}` : "Thả file .json vào đây"}
        </p>
        <button
          type="button"
          onClick={() => inputFile.current?.click()}
          disabled={dangLuu}
          className="mt-3 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          style={{ background: "var(--series-1)" }}
        >
          {dangLuu ? "Đang kiểm tra…" : "Chọn file…"}
        </button>
        <input
          ref={inputFile}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void docFile(file);
          }}
        />
      </div>

      {loiFile ? (
        <p className="text-sm" style={{ color: "var(--delta-bad)" }}>
          {loiFile}
        </p>
      ) : null}

      <details className="group rounded-lg border border-hairline bg-plane p-4">
        <summary className="cursor-pointer list-none text-sm font-medium text-ink">
          <span className="group-open:hidden">
            Chưa tạo ứng dụng trên Google? Mở hướng dẫn (≈3 phút, làm một lần)
          </span>
          <span className="hidden group-open:inline">Thu gọn hướng dẫn</span>
        </summary>

        <div className="mt-4 space-y-4">
          <p className="text-xs leading-relaxed text-ink-muted">
            Google bắt buộc mọi ứng dụng phải đăng ký trước khi được phép xin quyền, và
            không mở API để làm thay bước này. Mỗi dòng dưới đây là một liên kết mở
            thẳng đúng trang cần bấm.
          </p>

          <ol className="space-y-3 text-sm text-ink-secondary">
            <Buoc so={1} href={LIEN_KET.taoProject} nhan="Tạo project">
              Đặt tên gì cũng được, ví dụ <em>ptit-dashboard</em>. Đã có project rồi thì
              bỏ qua.
            </Buoc>

            <Buoc so={2} href={LIEN_KET.batDataApi} nhan="Bật Analytics Data API">
              Bấm nút <em>Enable</em>. Rồi làm tương tự với{" "}
              <a
                href={LIEN_KET.batAdminApi}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-hairline underline-offset-2"
                style={{ color: "var(--series-1)" }}
              >
                Analytics Admin API
              </a>
              .
            </Buoc>

            <Buoc so={3} href={LIEN_KET.manHinhQuyen} nhan="Khai màn hình xin quyền">
              Chọn <strong className="font-medium text-ink">External</strong>, điền tên
              và email.{" "}
              <strong className="font-medium text-ink">
                Nhớ thêm chính email của bạn vào mục Test users
              </strong>{" "}
              — thiếu bước này thì đến lúc đăng nhập Google sẽ chặn.
            </Buoc>

            <Buoc so={4} href={LIEN_KET.taoClient} nhan="Tạo OAuth client">
              Chọn loại <strong className="font-medium text-ink">Web application</strong>,
              dán chuỗi dưới đây vào ô <em>Authorized redirect URIs</em>, bấm Create, rồi
              bấm nút tải xuống ⬇ để lấy file JSON.
            </Buoc>
          </ol>

          <CopyField label="URI chuyển hướng — dán chính xác chuỗi này" value={redirectUri} />
        </div>
      </details>

      <details className="text-xs text-ink-muted">
        <summary className="cursor-pointer">Không có file, muốn dán tay</summary>
        <div className="mt-3 space-y-3">
          <input
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setNhapTay(true);
            }}
            placeholder="Client ID"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-lg border border-hairline bg-plane px-3 py-2 font-mono text-xs text-ink outline-none focus:border-ink-muted"
          />
          <input
            value={clientSecret}
            onChange={(e) => {
              setClientSecret(e.target.value);
              setNhapTay(true);
            }}
            type="password"
            placeholder="Client secret"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-lg border border-hairline bg-plane px-3 py-2 font-mono text-xs text-ink outline-none focus:border-ink-muted"
          />
          <button
            type="button"
            disabled={!hopLe || !nhapTay || dangLuu}
            onClick={() => void onSave(clientId.trim(), clientSecret.trim())}
            className="rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-ink-secondary disabled:opacity-40"
          >
            Lưu
          </button>
        </div>
      </details>

      <p className="text-[11px] leading-snug text-ink-muted">
        File chỉ được đọc ngay trên máy này và lưu vào{" "}
        <code>.secrets/google.json</code>, quyền chỉ chủ sở hữu đọc được. Không gửi đi
        đâu khác, không bao giờ trả ngược ra giao diện.
      </p>
    </div>
  );
}

function Buoc({
  so,
  href,
  nhan,
  children,
}: {
  so: number;
  href: string;
  nhan: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-2.5">
      <span className="shrink-0 text-ink-muted">{so}.</span>
      <span>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium underline decoration-hairline underline-offset-2"
          style={{ color: "var(--series-1)" }}
        >
          {nhan} ↗
        </a>{" "}
        — {children}
      </span>
    </li>
  );
}
