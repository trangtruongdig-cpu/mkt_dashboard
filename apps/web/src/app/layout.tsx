import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dashboard Marketing số & Thương hiệu — PTIT",
  description:
    "Hệ thống theo dõi hoạt động marketing số và sức khoẻ thương hiệu của Học viện Công nghệ Bưu chính Viễn thông.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
