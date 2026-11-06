import type { Metadata } from "next";
import { TopBar } from "@/components/layout/TopBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dashboard Marketing số & Thương hiệu — PTIT",
  description:
    "Hệ thống theo dõi hoạt động marketing số và sức khoẻ thương hiệu của Học viện Công nghệ Bưu chính Viễn thông.",
  robots: { index: false, follow: false },
};

/**
 * Thanh điều hướng dựng ở ĐÂY, không dựng trong từng trang.
 *
 * Trước đây chỉ `/` và `/du-lieu` gọi `<TopBar>`; chín trang còn lại không có thanh
 * điều hướng nào, mỗi trang tự làm một liên kết "← Về bảng điều khiển" riêng. Hệ quả:
 * từ `/kenh` không có đường nào sang `/muc-tieu`, và `/utm` với `/quan-tri` không vào
 * được từ bất kỳ đâu. Đặt ở layout gốc thì không trang nào bỏ sót được nữa.
 */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <TopBar />
        {children}
      </body>
    </html>
  );
}
