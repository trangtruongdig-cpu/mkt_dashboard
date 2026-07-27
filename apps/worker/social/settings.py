"""Cấu hình nguồn mạng xã hội. Đọc apps/worker/config/social-sources.json.

Từ khoá thương hiệu KHÔNG khai lại ở đây — dùng chung `BrandKeywords` với crawler báo chí.
Một thương hiệu chỉ có một bộ từ khoá; nhân đôi là mở đường cho hai bản lệch nhau.

Cùng lý do đó, phần gọi HTTP, chuẩn hoá URL, đối chiếu từ khoá và cấu hình kho đều lấy
thẳng từ gói `crawler`. Hai gói khác nhau ở NGUỒN dữ liệu, không khác ở hạ tầng.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from crawler.settings import CONFIG_DIR, CrawlerError, read_json

SOCIAL_SOURCES_PATH = CONFIG_DIR / "social-sources.json"


class SocialError(CrawlerError):
    """Cấu hình thiếu hoặc sai — dừng ngay thay vì chạy tiếp với dữ liệu nửa vời."""


# Hai nguồn đều gọi API của Google và đều chỉ đọc dữ liệu công khai, nên dùng API key là
# đủ — không cần OAuth như phía GA4. MỘT khoá bật cả hai API cũng chạy được, vì vậy
# GOOGLE_API_KEY là giá trị dùng chung; hai biến riêng chỉ để tách quyền khi cần.
# Thiếu khoá thì nguồn tương ứng tự bỏ qua, các nguồn còn lại vẫn chạy.
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "").strip()

# API: "YouTube Data API v3".
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY", "").strip() or GOOGLE_API_KEY

# API: "Custom Search API" + một Programmable Search Engine tạo ở
# programmablesearchengine.google.com (miễn phí, không cần thẻ). CX là mã của engine đó.
# 100 truy vấn/ngày miễn phí — đủ cho 7 từ khoá × 3 diễn đàn × 2 trang = 42 truy vấn.
GOOGLE_CSE_KEY = os.getenv("GOOGLE_CSE_KEY", "").strip() or GOOGLE_API_KEY
GOOGLE_CSE_CX = os.getenv("GOOGLE_CSE_CX", "").strip()


@dataclass(frozen=True)
class YoutubeSource:
    enabled: bool
    so_video_moi_tu_khoa: int
    so_binh_luan_moi_video: int
    so_ngay_nhin_lai: int
    han_muc_don_vi_moi_lan_chay: int
    kenh_cua_hoc_vien: list[str]

    @property
    def co_khoa_api(self) -> bool:
        return bool(YOUTUBE_API_KEY)


@dataclass(frozen=True)
class RedditSource:
    enabled: bool
    so_bai_moi_tu_khoa: int
    subreddits: list[str]


@dataclass(frozen=True)
class ForumSource:
    name: str
    domain: str
    enabled: bool
    pages: int


@dataclass(frozen=True)
class SocialSources:
    youtube: YoutubeSource
    reddit: RedditSource
    dien_dan: list[ForumSource] = field(default_factory=list)
    # Lưu mã băm tài khoản thay vì tên hiển thị. Xem phần _ghi_chu_rieng_tu trong file JSON.
    an_danh_tac_gia: bool = True

    @classmethod
    def load(cls, path: Path | None = None) -> SocialSources:
        du_lieu = read_json(path or SOCIAL_SOURCES_PATH)
        duong_dan = path or SOCIAL_SOURCES_PATH

        yt: dict[str, Any] = du_lieu.get("youtube", {})
        youtube = YoutubeSource(
            enabled=bool(yt.get("enabled", False)),
            so_video_moi_tu_khoa=_so_duong(yt, "so_video_moi_tu_khoa", 25, duong_dan),
            so_binh_luan_moi_video=_so_duong(yt, "so_binh_luan_moi_video", 200, duong_dan),
            so_ngay_nhin_lai=_so_duong(yt, "so_ngay_nhin_lai", 365, duong_dan),
            han_muc_don_vi_moi_lan_chay=_so_duong(
                yt, "han_muc_don_vi_moi_lan_chay", 9000, duong_dan
            ),
            kenh_cua_hoc_vien=[
                str(k).strip() for k in yt.get("kenh_cua_hoc_vien", []) if str(k).strip()
            ],
        )

        rd: dict[str, Any] = du_lieu.get("reddit", {})
        reddit = RedditSource(
            enabled=bool(rd.get("enabled", False)),
            # Reddit trả tối đa 100 mục một feed, xin nhiều hơn cũng không có thêm.
            so_bai_moi_tu_khoa=min(100, _so_duong(rd, "so_bai_moi_tu_khoa", 100, duong_dan)),
            subreddits=[
                str(s).strip().lstrip("r/") for s in rd.get("subreddits", []) if str(s).strip()
            ],
        )

        dien_dan = [
            ForumSource(
                name=str(m["name"]),
                domain=str(m["domain"]).strip().lower(),
                enabled=bool(m.get("enabled", True)),
                pages=max(1, int(m.get("pages", 1))),
            )
            for m in du_lieu.get("dien_dan", [])
        ]

        ten = [f.name for f in dien_dan]
        if len(set(ten)) != len(ten):
            raise SocialError(f"{duong_dan}: có tên diễn đàn bị trùng.")

        if not youtube.enabled and not reddit.enabled and not any(f.enabled for f in dien_dan):
            raise SocialError(f"{duong_dan}: không có nguồn nào đang bật.")

        return cls(
            youtube=youtube,
            reddit=reddit,
            dien_dan=dien_dan,
            an_danh_tac_gia=bool(du_lieu.get("an_danh_tac_gia", True)),
        )

    def enabled_forums(self) -> list[ForumSource]:
        return [f for f in self.dien_dan if f.enabled]


def _so_duong(khoi: dict[str, Any], khoa: str, mac_dinh: int, duong_dan: Path) -> int:
    """Đọc một số nguyên dương. Số âm hay số 0 gần như luôn là lỗi gõ nhầm cấu hình."""
    gia_tri = khoi.get(khoa, mac_dinh)
    try:
        so = int(gia_tri)
    except (TypeError, ValueError) as loi:
        raise SocialError(f"{duong_dan}: {khoa} phải là số nguyên, nhận được {gia_tri!r}.") from loi
    if so <= 0:
        raise SocialError(f"{duong_dan}: {khoa} phải lớn hơn 0, nhận được {so}.")
    return so
