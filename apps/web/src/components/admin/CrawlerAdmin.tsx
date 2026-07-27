"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { authApi, ChuaDangNhapError, crawlerAdminApi } from "@/lib/admin-api";
import { RunTable } from "./RunTable";
import { SourceTable } from "./SourceTable";

/** Khi có lượt đang chạy thì hỏi lại thường xuyên hơn để bảng nhật ký tự cập nhật. */
const NHIP_KHI_DANG_CHAY = 5_000;

export function CrawlerAdmin() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const phien = useQuery({ queryKey: ["auth", "me"], queryFn: authApi.me, retry: false });

  const overview = useQuery({
    queryKey: ["crawler", "overview"],
    queryFn: crawlerAdminApi.overview,
    enabled: phien.isSuccess,
    refetchInterval: (q) => (q.state.data?.running ? NHIP_KHI_DANG_CHAY : false),
  });

  const sources = useQuery({
    queryKey: ["crawler", "sources"],
    queryFn: crawlerAdminApi.sources,
    enabled: phien.isSuccess,
  });

  const runs = useQuery({
    queryKey: ["crawler", "runs"],
    queryFn: crawlerAdminApi.runs,
    enabled: phien.isSuccess,
    refetchInterval: overview.data?.running ? NHIP_KHI_DANG_CHAY : false,
  });

  const chayTatCa = useMutation({
    mutationFn: crawlerAdminApi.runAll,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["crawler"] }),
  });

  const dangXuat = useMutation({
    mutationFn: authApi.logout,
    onSuccess: () => router.replace("/dang-nhap"),
  });

  // Hết phiên thì đưa về trang đăng nhập. Đặt trong effect chứ không gọi thẳng trong
  // thân component: điều hướng trong lúc render là tác dụng phụ, React sẽ cảnh báo.
  const hetPhien = phien.isError && phien.error instanceof ChuaDangNhapError;
  useEffect(() => {
    if (hetPhien) router.replace("/dang-nhap");
  }, [hetPhien, router]);

  // Kiểm tra bằng isSuccess chứ không phải isLoading: khi `enabled` còn false, query nằm
  // ở trạng thái chờ mà isLoading vẫn là false — chỉ isSuccess mới bảo đảm có dữ liệu.
  if (!phien.isSuccess) {
    if (phien.isError) {
      return (
        <p role="alert" className="p-8 text-sm text-[var(--status-bad)]">
          {hetPhien
            ? "Phiên đã hết hạn, đang chuyển về trang đăng nhập…"
            : phien.error instanceof Error
              ? phien.error.message
              : "Không kiểm tra được phiên đăng nhập"}
        </p>
      );
    }
    return <p className="p-8 text-sm text-ink-muted">Đang kiểm tra phiên đăng nhập…</p>;
  }

  const tong = overview.data;
  const dangBanRon = tong?.running ?? false;

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-ink">Quản trị thu thập tin bài</h1>
          <p className="mt-1 text-xs text-ink-muted">
            Bật/tắt từng nguồn và đặt lịch tự chạy. Thay đổi có hiệu lực trong vòng một phút,
            không cần khởi động lại hệ thống.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-ink-secondary">{phien.data.user.displayName}</span>
          <button
            type="button"
            onClick={() => dangXuat.mutate()}
            className="rounded-lg border border-hairline px-3 py-1 text-xs text-ink"
          >
            Đăng xuất
          </button>
        </div>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <O nhan="Nguồn đang bật" giaTri={`${tong?.enabledSources ?? "—"} / ${tong?.totalSources ?? "—"}`} />
        <O nhan="Nguồn có lịch" giaTri={tong?.scheduledSources ?? "—"} />
        <O nhan="Tin bài đã thu" giaTri={tong ? tong.totalMentions.toLocaleString("vi-VN") : "—"} />
        <O
          nhan="Tình trạng"
          giaTri={dangBanRon ? "Đang chạy" : "Rảnh"}
          nhanMau={dangBanRon ? "text-[var(--status-warning)]" : "text-[var(--status-good)]"}
        />
      </section>

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => chayTatCa.mutate()}
          disabled={dangBanRon || chayTatCa.isPending}
          className="rounded-lg bg-[var(--series-1)] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {dangBanRon ? "Đang có lượt chạy…" : "Chạy ngay toàn bộ nguồn đang bật"}
        </button>
        {chayTatCa.isError ? (
          <span role="alert" className="text-xs text-[var(--status-bad)]">
            {chayTatCa.error instanceof Error ? chayTatCa.error.message : "Không xếp được lượt chạy"}
          </span>
        ) : null}
      </div>

      <h2 className="mb-2 text-sm font-semibold text-ink">Nguồn thu thập</h2>
      {sources.data ? (
        <SourceTable sources={sources.data.sources} dangBanRon={dangBanRon} />
      ) : sources.isError ? (
        <p role="alert" className="text-xs text-[var(--status-bad)]">
          {sources.error instanceof Error ? sources.error.message : "Không tải được danh sách nguồn"}
        </p>
      ) : (
        <p className="text-xs text-ink-muted">Đang tải danh sách nguồn…</p>
      )}

      <h2 className="mt-8 mb-2 text-sm font-semibold text-ink">Nhật ký các lượt chạy</h2>
      {runs.data ? (
        <RunTable runs={runs.data.runs} />
      ) : runs.isError ? (
        <p role="alert" className="text-xs text-[var(--status-bad)]">
          {runs.error instanceof Error ? runs.error.message : "Không tải được nhật ký"}
        </p>
      ) : (
        <p className="text-xs text-ink-muted">Đang tải nhật ký…</p>
      )}
    </main>
  );
}

function O({
  nhan,
  giaTri,
  nhanMau = "text-ink",
}: {
  nhan: string;
  giaTri: string | number;
  nhanMau?: string;
}) {
  return (
    <div className="rounded-xl border border-hairline bg-surface p-4">
      <div className="text-xs text-ink-muted">{nhan}</div>
      <div className={`mt-1 text-xl font-semibold tabular-nums ${nhanMau}`}>{giaTri}</div>
    </div>
  );
}
