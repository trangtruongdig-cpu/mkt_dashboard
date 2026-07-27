import { CrawlerAdmin } from "@/components/admin/CrawlerAdmin";

/**
 * Trang quản trị là client component từ đầu: toàn bộ nội dung phụ thuộc phiên đăng nhập
 * trong cookie và cần cập nhật liên tục trong lúc một lượt thu thập đang chạy.
 * Dựng sẵn trên máy chủ ở đây không mang lại gì.
 */
export default function QuanTriPage() {
  return <CrawlerAdmin />;
}
