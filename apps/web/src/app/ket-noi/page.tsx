import type { Metadata } from "next";
import Link from "next/link";
import { ConnectFlow } from "@/components/connect/ConnectFlow";

export const metadata: Metadata = {
  title: "Kết nối dữ liệu — Dashboard PTIT",
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TrangKetNoi({ searchParams }: PageProps) {
  const tham_so = await searchParams;
  const loi = typeof tham_so.loi === "string" ? tham_so.loi : null;

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-5 py-8 sm:px-8 sm:py-12">
      <header className="mb-8">
        <Link
          href="/"
          className="text-xs text-ink-muted underline decoration-hairline underline-offset-2 hover:text-ink-secondary"
        >
          ← Về dashboard
        </Link>
        <h1 className="mt-3 text-xl font-semibold text-ink sm:text-2xl">
          Kết nối dữ liệu
        </h1>
        <p className="mt-1.5 text-sm text-ink-secondary">
          Nối Google Analytics 4 của Học viện vào hệ thống. Làm một lần, các lần sau chỉ
          bấm đồng bộ.
        </p>
      </header>

      <ConnectFlow loiTuGoogle={loi} />

      <footer className="mt-10 border-t border-hairline pt-5 text-xs leading-relaxed text-ink-muted">
        <p>
          Thông tin uỷ quyền lưu tại <code>.secrets/google.json</code> trên chính máy chạy
          hệ thống, không gửi đi đâu khác. Muốn thu hồi quyền bất cứ lúc nào: bấm Ngắt kết
          nối ở đây, hoặc vào{" "}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-hairline underline-offset-2"
          >
            myaccount.google.com/permissions
          </a>
          .
        </p>
      </footer>
    </div>
  );
}
