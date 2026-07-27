"""Phần dùng chung khi gọi API của Google: bóc lỗi mà không làm lộ khoá.

Cả YouTube Data API lẫn Custom Search đều nhận khoá qua tham số `key=` trên URL, và đều
trả lỗi theo cùng một khuôn JSON. Gộp phần đọc lỗi vào một chỗ để hai nguồn không lệch
nhau về cách xử lý — và quan trọng hơn, để quy tắc "không log URL" chỉ phải giữ ở một nơi.
"""

from __future__ import annotations

from typing import Any

# Google phân biệt "chưa bật API" với "hết hạn mức" bằng những mã này. Gộp chung hai
# trường hợp là đưa ra lời khuyên sai: hết hạn mức thì chờ sang hôm sau là chạy được,
# còn chưa bật API thì có chờ bao lâu cũng vẫn 403.
LY_DO_HET_HAN_MUC = frozenset(
    {"quotaExceeded", "rateLimitExceeded", "dailyLimitExceeded", "userRateLimitExceeded"}
)


def ly_do_loi(phan_hoi: Any) -> str:
    """Mã lỗi máy đọc được, ví dụ "quotaExceeded" hay "forbidden"."""
    try:
        loi = phan_hoi.json().get("error", {})
        chi_tiet = loi.get("errors") or [{}]
        return str(chi_tiet[0].get("reason") or loi.get("status") or "không rõ")
    except Exception:  # noqa: BLE001 — phản hồi lỗi không phải JSON thì cũng chỉ ghi "không rõ"
        return "không rõ"


def mo_ta_loi(phan_hoi: Any) -> str:
    """Mô tả lỗi cho người đọc: mã lỗi kèm nguyên văn giải thích của Google.

    Nguyên văn quan trọng vì mã lỗi của Google quá thô — cả "chưa bật API" lẫn "khoá bị
    hạn chế sai" đều về `forbidden`, chỉ phần message mới nói rõ phải sửa gì.

    Chặn phòng hờ: nếu message có chứa tham số `key=` thì bỏ đi. Hiện Google không trả URL
    trong message, nhưng khoá lọt vào nhật ký là loại sự cố không sửa lại được.
    """
    ma = ly_do_loi(phan_hoi)
    try:
        loi_message = str(phan_hoi.json().get("error", {}).get("message") or "").strip()
    except Exception:  # noqa: BLE001
        loi_message = ""

    if not loi_message or "key=" in loi_message:
        return ma
    return f"{ma} — {loi_message}"
