"""Tìm các bài báo có nhắc đến thương hiệu.

Ba cơ chế, đều là nguồn công khai — không cần token, không cần quyền sở hữu tài khoản:

  bing_news    RSS tìm kiếm của Bing. Trả về URL thật của báo nên lấy được toàn văn.
               Có cả bài cũ nhiều năm trước. Đây là nguồn chính.
  google_news  RSS tìm kiếm của Google. Độ phủ tốt nhất nhưng link là URL chuyển hướng
               đã mã hoá, không giải được nếu không chạy JavaScript — chỉ lấy được
               tiêu đề, tên báo, ngày đăng.
  rss          Feed chuyên mục của từng báo. URL thật, nhưng chỉ có vài chục bài mới nhất.

Giai đoạn này chạy bằng thư viện HTTP thường. news-please chỉ dùng ở bước bóc toàn văn
(xem extract.py) vì phần tìm bài theo từ khoá nằm ngoài phạm vi của nó.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any
from urllib.parse import parse_qs, quote_plus, urlparse

from .matching import publisher_from_url
from .net import get_feed
from .settings import RssFeed

GOOGLE_NEWS_URL = "https://news.google.com/rss/search?q={q}&hl=vi&gl=VN&ceid=VN:vi"
BING_NEWS_URL = "https://www.bing.com/news/search?q={q}&format=RSS&setmkt=vi-VN&first={first}"


@dataclass(frozen=True)
class MentionRef:
    """Một lần thương hiệu được nhắc đến, ở mức thông tin mà bước tìm kiếm biết được."""

    title: str
    publisher: str
    url: str | None
    published_at: datetime | None
    discovered_via: str
    search_term: str | None = None
    summary: str = ""


def _ngay_dang(entry: Any) -> datetime | None:
    """feedparser đã quy đổi mọi múi giờ trong feed về UTC, chỉ cần gắn nhãn UTC vào."""
    parsed = getattr(entry, "published_parsed", None) or getattr(entry, "updated_parsed", None)
    if not parsed:
        return None
    nam, thang, ngay, gio, phut, giay = parsed[:6]
    return datetime(nam, thang, ngay, gio, phut, giay, tzinfo=UTC)


def _bo_duoi_ten_bao(title: str, publisher: str) -> str:
    """Google News gắn " - Tên báo" vào cuối tiêu đề. Bỏ đi để so khớp và hiển thị cho sạch."""
    hau_to = f" - {publisher}"
    return title[: -len(hau_to)] if publisher and title.endswith(hau_to) else title


def from_google_news(search_term: str) -> list[MentionRef]:
    feed = get_feed(GOOGLE_NEWS_URL.format(q=quote_plus(search_term)))
    ket_qua: list[MentionRef] = []

    for entry in feed.entries:
        nguon = getattr(entry, "source", None)
        publisher = str(getattr(nguon, "title", "") or "").strip() or "không rõ"
        tieu_de = _bo_duoi_ten_bao(str(getattr(entry, "title", "") or "").strip(), publisher)
        if not tieu_de:
            continue

        ket_qua.append(
            MentionRef(
                title=tieu_de,
                publisher=publisher,
                # Link của Google News là chuỗi đã mã hoá, không phải URL bài báo — để trống
                # còn hơn ghi vào kho một URL không mở được.
                url=None,
                published_at=_ngay_dang(entry),
                discovered_via="google_news",
                search_term=search_term,
            )
        )
    return ket_qua


def _url_that_tu_bing(link: str) -> str | None:
    """Bing bọc URL bài báo trong tham số `url=` của link chuyển hướng — bóc ra là xong."""
    thuc_te = parse_qs(urlparse(link).query).get("url")
    if thuc_te and thuc_te[0].startswith(("http://", "https://")):
        return thuc_te[0]
    return link if link.startswith(("http://", "https://")) and "bing.com" not in link else None


def from_bing_news(search_term: str, pages: int = 1) -> list[MentionRef]:
    ket_qua: list[MentionRef] = []

    for trang in range(pages):
        feed = get_feed(BING_NEWS_URL.format(q=quote_plus(search_term), first=trang * 10 + 1))
        if not feed.entries:
            break

        for entry in feed.entries:
            url = _url_that_tu_bing(str(getattr(entry, "link", "") or ""))
            tieu_de = str(getattr(entry, "title", "") or "").strip()
            if not url or not tieu_de:
                continue

            ket_qua.append(
                MentionRef(
                    title=tieu_de,
                    publisher=publisher_from_url(url),
                    url=url,
                    published_at=_ngay_dang(entry),
                    discovered_via="bing_news",
                    search_term=search_term,
                    summary=str(getattr(entry, "summary", "") or ""),
                )
            )
    return ket_qua


def from_rss(feed_config: RssFeed) -> list[MentionRef]:
    feed = get_feed(feed_config.url)
    ket_qua: list[MentionRef] = []

    for entry in feed.entries:
        url = str(getattr(entry, "link", "") or "").strip()
        tieu_de = str(getattr(entry, "title", "") or "").strip()
        if not url.startswith(("http://", "https://")) or not tieu_de:
            continue

        ket_qua.append(
            MentionRef(
                title=tieu_de,
                publisher=feed_config.publisher,
                url=url,
                published_at=_ngay_dang(entry),
                discovered_via=f"rss:{feed_config.name}",
                summary=str(getattr(entry, "summary", "") or ""),
            )
        )
    return ket_qua
