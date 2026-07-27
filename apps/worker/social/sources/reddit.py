"""Reddit — feed tìm kiếm công khai, không cần token.

Lượng thảo luận về một trường đại học Việt Nam trên Reddit ít hơn hẳn diễn đàn trong nước,
nhưng chất lượng cao: người viết ẩn danh nên nói thẳng những điều không ai viết dưới tên
thật trên Facebook. Với bài toán sức khoẻ thương hiệu thì đây đúng là thứ cần nghe.

Chỉ lấy được BÀI ĐĂNG. Feed bình luận (`<permalink>.rss`) trả 429 ngay từ lần gọi thứ hai
— Reddit siết rất chặt truy cập không xác thực. Muốn có bình luận phải đăng ký ứng dụng
OAuth theo Reddit Data API; chưa làm ở phiên bản này và đã ghi rõ trong social-sources.json.

Đo thực tế: Reddit trả 429 THẤT THƯỜNG chứ không theo một ngưỡng cố định — giãn cách 20
giây vẫn dính, mà thử lại ngay sau đó lại qua. Nên cách xử lý đúng là thử lại có chờ tăng
dần, không phải hạ nhịp gọi thật thấp rồi vẫn hỏng mà lại chạy chậm gấp mấy lần.
"""

from __future__ import annotations

import html
import os
import re
import time
from datetime import UTC, datetime
from typing import Any
from urllib.parse import quote_plus

import feedparser

from crawler.net import get

from ..settings import RedditSource, SocialError
from . import SocialItem

PLATFORM = "reddit"

SEARCH_URL = "https://www.reddit.com/search.rss?q={q}&sort=new&limit={limit}"
SUB_SEARCH_URL = (
    "https://www.reddit.com/r/{sub}/search.rss?q={q}&restrict_sr=1&sort=new&limit={limit}"
)

_THE_HTML = re.compile(r"<[^>]+>")
_KHOANG_TRANG_THUA = re.compile(r"\n{3,}")

# Giãn cách tối thiểu giữa hai lần gọi Reddit, tính bằng giây.
CHO_GIUA_HAI_LAN = float(os.getenv("REDDIT_DELAY", "8"))
# Bị từ chối thì chờ bao lâu trước lần thử đầu tiên. Các lần sau nhân dần lên.
CHO_SAU_KHI_BI_TU_CHOI = float(os.getenv("REDDIT_BACKOFF", "12"))
SO_LAN_THU = 3

_lan_goi_cuoi = 0.0


def _giu_nhip() -> None:
    global _lan_goi_cuoi
    con_lai = CHO_GIUA_HAI_LAN - (time.monotonic() - _lan_goi_cuoi)
    if con_lai > 0:
        time.sleep(con_lai)
    _lan_goi_cuoi = time.monotonic()


def _lay_feed(url: str) -> Any:
    """Tải một feed của Reddit, thử lại khi bị từ chối vì gọi quá nhanh."""
    for lan in range(SO_LAN_THU):
        _giu_nhip()
        phan_hoi = get(url, accept="application/atom+xml, application/xml")

        if phan_hoi.status_code == 200:
            return feedparser.parse(phan_hoi.content)
        if phan_hoi.status_code != 429:
            phan_hoi.raise_for_status()

        cho = CHO_SAU_KHI_BI_TU_CHOI * (lan + 1)
        print(f"    reddit 429, chờ {cho:.0f}s rồi thử lại ({lan + 1}/{SO_LAN_THU})", flush=True)
        time.sleep(cho)

    raise SocialError(
        f"Reddit từ chối {SO_LAN_THU} lần liên tiếp. Tăng REDDIT_DELAY trong .env hoặc "
        "chạy lại sau ít phút — dữ liệu các từ khoá trước đó vẫn đã được ghi."
    )


def _thanh_van_ban(noi_dung_html: str) -> str:
    """Reddit trả thân bài dưới dạng HTML đã escape hai lần. Gỡ về văn bản thuần.

    Không kéo thêm thư viện phân tích HTML: thân bài Reddit chỉ có thẻ đoạn văn, danh sách
    và liên kết — biểu thức chính quy đủ dùng và không thêm phụ thuộc cho một việc nhỏ.
    """
    van_ban = html.unescape(noi_dung_html)
    van_ban = re.sub(r"<br\s*/?>", "\n", van_ban)
    van_ban = re.sub(r"</p>", "\n\n", van_ban)
    van_ban = _THE_HTML.sub("", van_ban)
    return _KHOANG_TRANG_THUA.sub("\n\n", html.unescape(van_ban)).strip()


def _thoi_diem(entry: Any) -> datetime | None:
    parsed = getattr(entry, "updated_parsed", None) or getattr(entry, "published_parsed", None)
    if not parsed:
        return None
    nam, thang, ngay, gio, phut, giay = parsed[:6]
    return datetime(nam, thang, ngay, gio, phut, giay, tzinfo=UTC)


def _subreddit(entry: Any) -> str:
    tags = getattr(entry, "tags", None) or []
    ten = str(tags[0].get("term", "")).strip() if tags else ""
    return f"r/{ten}" if ten else "reddit"


def tim_bai(term: str, cau_hinh: RedditSource) -> list[SocialItem]:
    """Tìm bài đăng khớp từ khoá. Không khai báo subreddit thì tìm toàn Reddit."""
    dia_chi = (
        [
            SUB_SEARCH_URL.format(sub=s, q=quote_plus(term), limit=cau_hinh.so_bai_moi_tu_khoa)
            for s in cau_hinh.subreddits
        ]
        if cau_hinh.subreddits
        else [SEARCH_URL.format(q=quote_plus(term), limit=cau_hinh.so_bai_moi_tu_khoa)]
    )

    ket_qua: list[SocialItem] = []
    for url in dia_chi:
        feed = _lay_feed(url)
        for entry in feed.entries:
            item = _thanh_item(entry, term)
            if item is not None:
                ket_qua.append(item)

    return ket_qua


def _thanh_item(entry: Any, term: str) -> SocialItem | None:
    # Dạng "t3_1v4e4q5" — ổn định vĩnh viễn, kể cả khi bài bị sửa tiêu đề.
    native_id = str(getattr(entry, "id", "") or "").strip()
    tieu_de = str(getattr(entry, "title", "") or "").strip()
    if not native_id or not tieu_de:
        return None

    noi_dung = ""
    khoi = getattr(entry, "content", None)
    if khoi:
        noi_dung = _thanh_van_ban(str(khoi[0].get("value", "")))

    # Tác giả về dưới dạng "/u/tên". Bỏ tiền tố để cột author_ref chỉ chứa định danh.
    tac_gia = str(getattr(entry, "author", "") or "").strip().removeprefix("/u/")

    return SocialItem(
        platform=PLATFORM,
        source_name=_subreddit(entry),
        content_type="post",
        native_id=native_id,
        url=str(getattr(entry, "link", "") or "") or None,
        title=tieu_de,
        body_text=f"{tieu_de}\n{noi_dung}".strip(),
        author_id=tac_gia or None,
        author_name=tac_gia or None,
        published_at=_thoi_diem(entry),
        discovered_via="reddit:search",
        search_term=term,
    )
