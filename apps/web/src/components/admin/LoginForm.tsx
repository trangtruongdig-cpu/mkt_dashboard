"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { authApi } from "@/lib/admin-api";

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loi, setLoi] = useState<string | null>(null);
  const [dangGui, setDangGui] = useState(false);

  const guiForm = async (su_kien: FormEvent<HTMLFormElement>): Promise<void> => {
    su_kien.preventDefault();
    setLoi(null);
    setDangGui(true);

    try {
      await authApi.login(username.trim(), password);
      router.replace("/quan-tri");
      // Không tắt cờ dangGui ở đây: giữ nút khoá cho tới khi trang mới thay thế trang này,
      // tránh người dùng bấm hai lần trong lúc chuyển trang.
    } catch (that_bai) {
      setLoi(that_bai instanceof Error ? that_bai.message : "Đăng nhập không thành công");
      setDangGui(false);
    }
  };

  return (
    <form
      onSubmit={guiForm}
      className="rounded-xl border border-hairline bg-surface p-6"
      noValidate
    >
      <label className="block text-xs font-medium text-ink-secondary" htmlFor="username">
        Tên đăng nhập
      </label>
      <input
        id="username"
        name="username"
        autoComplete="username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        className="mt-1 w-full rounded-lg border border-hairline bg-surface-inset px-3 py-2 text-sm text-ink outline-none focus:border-[var(--series-1)]"
        required
      />

      <label
        className="mt-4 block text-xs font-medium text-ink-secondary"
        htmlFor="password"
      >
        Mật khẩu
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mt-1 w-full rounded-lg border border-hairline bg-surface-inset px-3 py-2 text-sm text-ink outline-none focus:border-[var(--series-1)]"
        required
      />

      {loi ? (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-surface-inset px-3 py-2 text-xs text-[var(--status-bad)]"
        >
          {loi}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={dangGui || !username.trim() || !password}
        className="mt-5 w-full rounded-lg bg-[var(--series-1)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {dangGui ? "Đang kiểm tra…" : "Đăng nhập"}
      </button>

      <p className="mt-4 text-center text-xs text-ink-muted">
        Tài khoản do quản trị hệ thống cấp qua biến môi trường của máy chủ.
      </p>
    </form>
  );
}
