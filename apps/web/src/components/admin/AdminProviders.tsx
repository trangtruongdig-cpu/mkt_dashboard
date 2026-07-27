"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ChuaDangNhapError } from "@/lib/admin-api";

export function AdminProviders({ children }: { children: React.ReactNode }) {
  // Tạo trong useState chứ không phải biến ngoài module: mỗi lần render trên máy chủ
  // phải có cache riêng, nếu dùng chung thì dữ liệu của người này lọt sang người khác.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 10_000,
            // Hết phiên thì thử lại bao nhiêu lần cũng vẫn 401 — chuyển thẳng
            // về trang đăng nhập thay vì để người dùng ngồi đợi.
            retry: (soLan, loi) => !(loi instanceof ChuaDangNhapError) && soLan < 2,
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
