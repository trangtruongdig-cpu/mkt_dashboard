"""Mặt phẳng điều khiển: worker đọc cấu hình và ghi nhật ký chạy qua PostgreSQL.

Luồng đi một chiều, KHÔNG có lời gọi mạng nào giữa API và worker:

    Quản trị viên bấm nút  →  NestJS ghi PostgreSQL  →  worker đọc trước mỗi lượt chạy

Hệ quả có chủ đích: API tắt thì lịch thu thập vẫn chạy đúng cấu hình đã lưu, và bấm
"Chạy ngay" lúc worker đang tắt thì lượt chạy nằm chờ, tự chạy khi worker bật lại.

Bảng `crawler_source` và `crawler_run` do drizzle-kit bên `apps/api` tạo — worker KHÔNG
tự tạo chúng. Hai nơi cùng khai báo một bảng là hai nguồn sự thật, và chúng sẽ lệch nhau.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from types import TracebackType
from typing import Any

from .settings import CrawlerError, MediaSources, RssFeed, SearchEngine

# Tên bảng do API sở hữu, luôn nằm ở schema `public`.
SOURCE_TABLE = "public.crawler_source"
RUN_TABLE = "public.crawler_run"

SEARCH_ENGINE_KINDS = ("bing_news", "google_news")


@dataclass(frozen=True)
class RunHandle:
    """Một lượt chạy đang mở. Đóng lại bằng `finish_run`."""

    id: int
    source_name: str | None


@dataclass(frozen=True)
class RunOutcome:
    mentions_found: int = 0
    mentions_new: int = 0
    extracted_ok: int = 0
    extracted_failed: int = 0


class ControlPlane:
    """Bọc mọi truy vấn tới hai bảng điều khiển. Dùng như context manager."""

    def __init__(self, dsn: str) -> None:
        import psycopg

        self._con = psycopg.connect(dsn, autocommit=True)

    def __enter__(self) -> ControlPlane:
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        self.close()

    def close(self) -> None:
        self._con.close()

    # -- Sẵn sàng ------------------------------------------------------------

    def tables_ready(self) -> bool:
        """API đã chạy migration chưa. Worker khởi động trước API là chuyện bình thường."""
        with self._con.cursor() as cur:
            cur.execute(
                "SELECT to_regclass(%s) IS NOT NULL AND to_regclass(%s) IS NOT NULL",
                (SOURCE_TABLE, RUN_TABLE),
            )
            row = cur.fetchone()
        return bool(row and row[0])

    def _require_tables(self) -> None:
        if not self.tables_ready():
            raise CrawlerError(
                f"Chưa có bảng {SOURCE_TABLE} / {RUN_TABLE}. "
                "Khởi động apps/api một lần để nó chạy migration, rồi chạy lại lệnh này."
            )

    # -- Dữ liệu mồi ---------------------------------------------------------

    def seed_sources(self, sources: MediaSources) -> tuple[int, int]:
        """Nạp nguồn từ file JSON vào cơ sở dữ liệu. Trả về (số thêm mới, tổng số nguồn).

        `ON CONFLICT DO NOTHING` là có chủ đích: nguồn đã có giữ nguyên trạng thái bật/tắt
        và lịch mà quản trị viên đã đặt. Nếu ghi đè, mỗi lần triển khai lại sẽ xoá sạch
        cấu hình vận hành — đúng thứ không ai muốn.

        Chạy từng câu thay vì `executemany` để `RETURNING` đếm được đúng số dòng thêm mới;
        danh sách nguồn chỉ vài chục dòng nên không đáng lo về tốc độ.
        """
        self._require_tables()
        ban_ghi = _to_rows(sources)
        them_moi = 0

        with self._con.cursor() as cur:
            for dong in ban_ghi:
                cur.execute(
                    f"""
                    INSERT INTO {SOURCE_TABLE}
                        (kind, name, publisher, url, enabled, pages, schedule, note, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, now())
                    ON CONFLICT (name) DO NOTHING
                    RETURNING id
                    """,
                    dong,
                )
                if cur.fetchone():
                    them_moi += 1

            cur.execute(f"SELECT count(*) FROM {SOURCE_TABLE}")
            tong = cur.fetchone()

        return them_moi, int(tong[0]) if tong else 0

    # -- Đọc cấu hình --------------------------------------------------------

    def load_sources(self, only_name: str | None = None) -> MediaSources:
        """Dựng cấu hình từ cơ sở dữ liệu, ở đúng dạng mà `collect.run` đang nhận.

        Nhờ giữ nguyên kiểu `MediaSources`, phần thu thập không cần biết cấu hình đến
        từ file JSON hay từ PostgreSQL.
        """
        self._require_tables()

        cau_lenh = f"SELECT kind, name, publisher, url, enabled, pages FROM {SOURCE_TABLE}"
        tham_so: tuple[Any, ...] = ()
        if only_name is not None:
            cau_lenh += " WHERE name = %s"
            tham_so = (only_name,)

        with self._con.cursor() as cur:
            cur.execute(cau_lenh, tham_so)
            dong = cur.fetchall()

        engines: list[SearchEngine] = []
        feeds: list[RssFeed] = []

        for kind, name, publisher, url, enabled, pages in dong:
            if kind in SEARCH_ENGINE_KINDS:
                engines.append(
                    SearchEngine(name=str(kind), enabled=bool(enabled), pages=int(pages))
                )
            elif url:
                feeds.append(
                    RssFeed(
                        name=str(name),
                        publisher=str(publisher),
                        url=str(url),
                        enabled=bool(enabled),
                    )
                )

        return MediaSources(search_engines=engines, rss_feeds=feeds)

    def scheduled_sources(self) -> list[tuple[str, str]]:
        """Các nguồn đang bật và có đặt lịch, dạng (tên nguồn, mã lịch)."""
        self._require_tables()
        with self._con.cursor() as cur:
            cur.execute(
                f"SELECT name, schedule FROM {SOURCE_TABLE} "
                "WHERE enabled AND schedule <> 'tat' ORDER BY name"
            )
            return [(str(n), str(s)) for n, s in cur.fetchall()]

    # -- Nhật ký lượt chạy ---------------------------------------------------

    def claim_pending_run(self) -> RunHandle | None:
        """Nhặt một lượt chạy do quản trị viên xếp hàng, đánh dấu là đang chạy.

        `FOR UPDATE SKIP LOCKED` để hai worker chạy song song không cùng nhặt một lượt.
        """
        self._require_tables()
        with self._con.cursor() as cur:
            cur.execute(
                f"""
                UPDATE {RUN_TABLE} SET status = 'dang_chay', started_at = now()
                WHERE id = (
                    SELECT id FROM {RUN_TABLE} WHERE status = 'cho_chay'
                    ORDER BY started_at LIMIT 1 FOR UPDATE SKIP LOCKED
                )
                RETURNING id, source_name
                """
            )
            row = cur.fetchone()

        return RunHandle(id=int(row[0]), source_name=row[1]) if row else None

    def start_run(self, trigger: str, source_name: str | None) -> RunHandle:
        """Mở một lượt chạy do lịch kích hoạt."""
        self._require_tables()
        with self._con.cursor() as cur:
            cur.execute(
                f"INSERT INTO {RUN_TABLE} (trigger, status, source_name) "
                "VALUES (%s, 'dang_chay', %s) RETURNING id",
                (trigger, source_name),
            )
            row = cur.fetchone()

        if row is None:
            raise CrawlerError("Không mở được lượt chạy mới.")
        return RunHandle(id=int(row[0]), source_name=source_name)

    def finish_run(
        self,
        handle: RunHandle,
        status: str,
        outcome: RunOutcome | None = None,
        error: str | None = None,
    ) -> None:
        ket_qua = outcome or RunOutcome()
        with self._con.cursor() as cur:
            cur.execute(
                f"""
                UPDATE {RUN_TABLE}
                   SET status = %s, finished_at = now(),
                       mentions_found = %s, mentions_new = %s,
                       extracted_ok = %s, extracted_failed = %s,
                       error_message = %s
                 WHERE id = %s
                """,
                (
                    status,
                    ket_qua.mentions_found,
                    ket_qua.mentions_new,
                    ket_qua.extracted_ok,
                    ket_qua.extracted_failed,
                    _cat_ngan(error),
                    handle.id,
                ),
            )
            # Nguồn nào vừa chạy thì cập nhật dấu vết lần chạy cuối, để màn hình quản trị
            # hiện được ngay trên từng dòng mà không phải nối bảng.
            cur.execute(
                f"UPDATE {SOURCE_TABLE} SET last_run_at = %s, last_run_status = %s "
                "WHERE (%s IS NULL AND enabled) OR name = %s",
                (datetime.now(UTC), status, handle.source_name, handle.source_name),
            )


def _to_rows(sources: MediaSources) -> list[tuple[Any, ...]]:
    """Đổi cấu hình JSON thành các dòng sẵn sàng ghi vào bảng."""
    rows: list[tuple[Any, ...]] = [
        (e.name, e.name, _TEN_CONG_CU.get(e.name, e.name), None, e.enabled, e.pages, "tat", None)
        for e in sources.search_engines
    ]
    rows += [
        (
            "rss",
            f.name,
            f.publisher,
            f.url,
            f.enabled,
            1,
            "tat",
            None if f.enabled else "Tắt sẵn trong dữ liệu mồi — xem media-sources.json.",
        )
        for f in sources.rss_feeds
    ]
    return rows


_TEN_CONG_CU = {"bing_news": "Bing News", "google_news": "Google News"}


def _cat_ngan(text: str | None, gioi_han: int = 2000) -> str | None:
    """Thông báo lỗi dài không được làm phình bảng nhật ký."""
    if text is None:
        return None
    return text if len(text) <= gioi_han else text[:gioi_han] + "…"
