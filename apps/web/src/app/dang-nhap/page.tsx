import type { Metadata } from "next";
import { LoginForm } from "@/components/admin/LoginForm";

export const metadata: Metadata = {
  title: "Đăng nhập quản trị — Dashboard PTIT",
  robots: { index: false, follow: false },
};

export default function DangNhapPage() {
  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-plane px-4 py-12">
      <div className="w-full max-w-sm">
        <header className="mb-6 text-center">
          <h1 className="text-lg font-semibold text-ink">Quản trị thu thập dữ liệu</h1>
          <p className="mt-1 text-xs text-ink-muted">
            Khu vực dành cho cán bộ vận hành hệ thống dashboard của Học viện.
          </p>
        </header>
        <LoginForm />
      </div>
    </main>
  );
}
