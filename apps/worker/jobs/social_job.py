"""Một mẻ lắng nghe mạng xã hội chạy theo lịch.

Chưa nối vào bảng điều khiển `crawler_source` như job tin bài: nguồn mạng xã hội hiện cấu
hình bằng file `config/social-sources.json`, chưa có màn hình quản trị tương ứng. Vì vậy
job này chạy theo một lịch cố định thay vì lịch do quản trị viên đặt trên web.

Khi nào có màn hình quản trị nguồn mạng xã hội thì chuyển sang cùng cơ chế với
`crawler_job` — bảng `crawler_run` đã đủ tổng quát để ghi cả hai loại lượt chạy.
"""

from __future__ import annotations

import logging

from social import collect

log = logging.getLogger(__name__)


def chay_theo_lich() -> None:
    """Điểm vào cho APScheduler. Không ném lỗi ra ngoài.

    Một mẻ hỏng không được làm chết scheduler — nếu chết thì mọi lịch sau đó im lặng
    không chạy, và không ai biết cho tới khi phát hiện số liệu đứng yên.
    """
    try:
        stats = collect.run()
    except Exception:  # noqa: BLE001 — mọi lỗi phải được ghi lại rồi đi tiếp
        log.exception("Mẻ lắng nghe mạng xã hội thất bại")
        return

    log.info(
        "Lắng nghe xong: %s bài gốc, %s bình luận, %s bản ghi mới.",
        stats.bai_goc_khop,
        stats.binh_luan,
        stats.ban_ghi_moi,
    )
    for canh_bao in stats.canh_bao:
        log.warning("%s", canh_bao)
