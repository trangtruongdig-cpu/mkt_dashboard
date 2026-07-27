import type { Metadata } from "next";
import { AdminProviders } from "@/components/admin/AdminProviders";

export const metadata: Metadata = {
  title: "Quản trị thu thập dữ liệu — Dashboard PTIT",
  robots: { index: false, follow: false },
};

/**
 * Bọc TanStack Query cho riêng nhánh quản trị.
 *
 * Đặt provider ở đây chứ không ở layout gốc: các trang dashboard là Server Component,
 * kéo provider lên gốc sẽ biến cả cây thành client component mà chẳng để làm gì.
 */
export default function QuanTriLayout({ children }: { children: React.ReactNode }) {
  return <AdminProviders>{children}</AdminProviders>;
}
