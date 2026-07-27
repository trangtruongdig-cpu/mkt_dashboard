"""Kiểu dữ liệu chung mà mọi nguồn mạng xã hội trả về.

Mỗi nguồn chỉ lo phần khác nhau: gọi API nào, phân tích định dạng gì. Phần giống nhau —
sinh khoá, đối chiếu từ khoá, ẩn danh tác giả, đóng dấu thời gian — nằm ở `collect.py`
để mọi nền tảng đi qua đúng một bộ quy tắc.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class SocialItem:
    """Một mẩu nội dung lấy về từ nền tảng, chưa qua xử lý của hệ thống."""

    platform: str
    source_name: str
    content_type: str
    # Định danh gốc trên nền tảng: video id của YouTube, id bài Reddit, URL chủ đề diễn đàn.
    # Phải ổn định giữa các lần chạy, nếu không tính idempotent của bảng thô mất hiệu lực.
    native_id: str
    body_text: str
    discovered_via: str
    # `native_id` của bản ghi cha. Bình luận trỏ về video chứa nó; bài gốc để None.
    parent_native_id: str | None = None
    url: str | None = None
    title: str | None = None
    author_id: str | None = None
    author_name: str | None = None
    published_at: datetime | None = None
    like_count: int | None = None
    reply_count: int | None = None
    view_count: int | None = None
    search_term: str | None = None
    is_owned: bool = False
