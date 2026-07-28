"""Cấu hình cho crawler earned media. Đọc file JSON ở apps/worker/config/."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

from dotenv import load_dotenv

WORKER_ROOT = Path(__file__).resolve().parent.parent
CONFIG_DIR = WORKER_ROOT / "config"
KEYWORDS_PATH = CONFIG_DIR / "brand-keywords.json"
SOURCES_PATH = CONFIG_DIR / "media-sources.json"

load_dotenv(WORKER_ROOT / ".env")

# Tự giới thiệu trung thực kèm địa chỉ liên hệ — quản trị viên các báo cần biết ai đang
# truy cập để chặn hoặc liên hệ. Đây là chuẩn mực khi thu thập dữ liệu công khai.
# Bắt buộc thuần ASCII: tiêu đề HTTP mã hoá bằng latin-1, có dấu tiếng Việt là lỗi khi gửi.
USER_AGENT = os.getenv(
    "CRAWLER_USER_AGENT",
    "PTIT-BrandMonitor/0.1 (academic research; +https://ptit.edu.vn)",
)

# Giãn cách giữa hai lần gọi cùng một tên miền, tính bằng giây. Đừng hạ xuống dưới 1.
DOMAIN_DELAY_SECONDS = float(os.getenv("CRAWLER_DOMAIN_DELAY", "1.5"))

REQUEST_TIMEOUT_SECONDS = float(os.getenv("CRAWLER_TIMEOUT", "25"))

# Chuỗi kết nối tới PostgreSQL chứa hai bảng điều khiển `crawler_source` và `crawler_run`.
# Có biến này thì cấu hình nguồn đọc từ cơ sở dữ liệu (quản trị viên bật/tắt được);
# không có thì đọc từ file JSON và chạy như một job độc lập.
CONTROL_DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

# Múi giờ cho lịch APScheduler. Đặt sai thì "2h sáng" thành 2h sáng giờ UTC.
SCHEDULER_TIMEZONE = os.getenv("CRAWLER_TIMEZONE", "Asia/Ho_Chi_Minh")

# Bao lâu một lần worker ngó vào bảng xem có ai bấm "Chạy ngay" không, tính bằng giây.
PENDING_POLL_SECONDS = int(os.getenv("CRAWLER_POLL_SECONDS", "30"))


def has_control_plane() -> bool:
    """Có cấu hình cơ sở dữ liệu điều khiển hay không."""
    return bool(CONTROL_DATABASE_URL)


class CrawlerError(RuntimeError):
    """Cấu hình thiếu hoặc sai — dừng ngay thay vì chạy tiếp với dữ liệu nửa vời."""


if not USER_AGENT.isascii():
    raise CrawlerError(
        "CRAWLER_USER_AGENT phải là ASCII thuần (tiêu đề HTTP mã hoá bằng latin-1). "
        f"Giá trị hiện tại có ký tự ngoài ASCII: {USER_AGENT!r}"
    )


MatchMode = Literal["substring", "token"]


@dataclass(frozen=True)
class Keyword:
    text: str
    mode: MatchMode


@dataclass(frozen=True)
class BrandKeywords:
    """Từ khoá gửi cho công cụ tìm kiếm và từ khoá dùng để lọc kết quả trả về."""

    search_terms: list[str]
    match_keywords: list[Keyword]
    # Tên miền và tên nguồn do chính Học viện vận hành — dùng để tách owned khỏi earned.
    owned_sources: list[str]

    @classmethod
    def load(cls, path: Path | None = None) -> BrandKeywords:
        du_lieu = read_json(path or KEYWORDS_PATH)

        search_terms = [str(t).strip() for t in du_lieu.get("search_terms", []) if str(t).strip()]
        if not search_terms:
            raise CrawlerError(f"{KEYWORDS_PATH} không có search_terms nào.")

        keywords: list[Keyword] = []
        for muc in du_lieu.get("match_keywords", []):
            text = str(muc.get("text", "")).strip()
            mode = str(muc.get("mode", "substring")).strip()
            if not text:
                raise CrawlerError(f"{KEYWORDS_PATH}: có match_keywords thiếu 'text'.")
            if mode not in ("substring", "token"):
                raise CrawlerError(
                    f"{KEYWORDS_PATH}: mode của {text!r} phải là 'substring' hoặc 'token', "
                    f"nhận được {mode!r}."
                )
            keywords.append(Keyword(text=text, mode=mode))  # type: ignore[arg-type]

        if not keywords:
            raise CrawlerError(
                f"{KEYWORDS_PATH} không có match_keywords nào — không lọc được kết quả, "
                "sẽ nuốt toàn bộ tin tức giáo dục vào kho."
            )
        owned = [str(s).strip() for s in du_lieu.get("owned_sources", []) if str(s).strip()]

        # Gộp từ khoá của nhóm trường đối sánh vào cùng bộ.
        #
        # Không gộp thì kho chỉ có tin bài về Học viện, và chỉ số "thị phần thảo luận"
        # không có mẫu số — nó sẽ luôn bằng 100%, tức là vô nghĩa. Gộp ở đây để bước
        # thu thập không phải biết gì về chuyện có nhiều thương hiệu; phần phân biệt
        # bài nào của trường nào do `crawler/brands.py` lo sau khi đã lưu.
        for doi_thu in du_lieu.get("competitors", []):
            search_terms.extend(
                str(t).strip() for t in doi_thu.get("search_terms", []) if str(t).strip()
            )
            for muc in doi_thu.get("match_keywords", []):
                text = str(muc.get("text", "")).strip()
                mode = str(muc.get("mode", "substring")).strip()
                if text and mode in ("substring", "token"):
                    keywords.append(Keyword(text=text, mode=mode))  # type: ignore[arg-type]

        return cls(search_terms=search_terms, match_keywords=keywords, owned_sources=owned)


@dataclass(frozen=True)
class SearchEngine:
    name: str
    enabled: bool
    pages: int


@dataclass(frozen=True)
class RssFeed:
    name: str
    publisher: str
    url: str
    enabled: bool = True


@dataclass(frozen=True)
class MediaSources:
    search_engines: list[SearchEngine] = field(default_factory=list)
    rss_feeds: list[RssFeed] = field(default_factory=list)

    @classmethod
    def load(cls, path: Path | None = None) -> MediaSources:
        du_lieu = read_json(path or SOURCES_PATH)

        engines = [
            SearchEngine(
                name=str(m["name"]),
                enabled=bool(m.get("enabled", True)),
                pages=max(1, int(m.get("pages", 1))),
            )
            for m in du_lieu.get("search_engines", [])
        ]
        ho_tro = {"bing_news", "google_news"}
        for e in engines:
            if e.name not in ho_tro:
                raise CrawlerError(
                    f"{SOURCES_PATH}: chưa hỗ trợ công cụ tìm kiếm {e.name!r}. "
                    f"Hiện có: {', '.join(sorted(ho_tro))}."
                )

        feeds = [
            RssFeed(
                name=str(m["name"]),
                publisher=str(m["publisher"]),
                url=str(m["url"]),
                enabled=bool(m.get("enabled", True)),
            )
            for m in du_lieu.get("rss_feeds", [])
        ]

        ten = [e.name for e in engines] + [f.name for f in feeds]
        if len(set(ten)) != len(ten):
            raise CrawlerError(f"{SOURCES_PATH}: có tên nguồn bị trùng.")

        if not engines and not feeds:
            raise CrawlerError(f"{SOURCES_PATH} không khai báo nguồn nào.")
        return cls(search_engines=engines, rss_feeds=feeds)

    def enabled_engines(self) -> list[SearchEngine]:
        return [e for e in self.search_engines if e.enabled]

    def enabled_feeds(self) -> list[RssFeed]:
        return [f for f in self.rss_feeds if f.enabled]


StoreKind = Literal["duckdb", "postgres"]


@dataclass(frozen=True)
class StoreSettings:
    """Dùng chung biến môi trường với job hút dữ liệu GA4 để chỉ có một nơi cấu hình kho."""

    kind: StoreKind
    duckdb_path: Path
    postgres_host: str
    postgres_port: int
    postgres_db: str
    postgres_user: str
    postgres_password: str
    schema_name: str

    @classmethod
    def from_env(cls) -> StoreSettings:
        kind = os.getenv("INGEST_CACHE", "duckdb").strip().lower()
        if kind not in ("duckdb", "postgres"):
            raise CrawlerError(
                f"INGEST_CACHE phải là 'duckdb' hoặc 'postgres', nhận được: {kind!r}"
            )

        return cls(
            kind=kind,  # type: ignore[arg-type]
            duckdb_path=WORKER_ROOT / os.getenv("CRAWLER_DUCKDB_PATH", ".data/ptit_news.duckdb"),
            postgres_host=os.getenv("POSTGRES_HOST", "localhost"),
            postgres_port=int(os.getenv("POSTGRES_PORT", "5432")),
            postgres_db=os.getenv("POSTGRES_DB", "ptit_dashboard"),
            postgres_user=os.getenv("POSTGRES_USER", "ptit"),
            postgres_password=os.getenv("POSTGRES_PASSWORD", ""),
            schema_name=os.getenv("CRAWLER_SCHEMA", "news_raw"),
        )


def read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        raise CrawlerError(f"Không tìm thấy {path}")
    try:
        du_lieu: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as loi:
        raise CrawlerError(f"{path} không phải JSON hợp lệ: {loi}") from loi
    return du_lieu
