"""Một mẻ thu thập chạy dưới quyền điều khiển của màn hình quản trị.

Mọi lượt chạy — dù do lịch hay do quản trị viên bấm nút — đều đi qua đây, nên nhật ký
trong bảng `crawler_run` phản ánh đủ mọi lần hệ thống ra ngoài lấy dữ liệu.
"""

from __future__ import annotations

import logging
import traceback

from crawler import collect
from crawler.control import ControlPlane, RunHandle, RunOutcome
from crawler.settings import CONTROL_DATABASE_URL

log = logging.getLogger(__name__)


def chay_mot_luot(
    control: ControlPlane,
    handle: RunHandle,
    lay_toan_van: bool = True,
) -> None:
    """Chạy và ghi kết quả vào lượt đã mở. Không ném lỗi ra ngoài.

    Một mẻ hỏng không được làm chết scheduler — nếu chết thì mọi lịch sau đó im lặng
    không chạy, và không ai biết cho tới khi phát hiện số liệu đứng yên.
    """
    try:
        sources = control.load_sources(only_name=handle.source_name)
        stats = collect.run(lay_toan_van=lay_toan_van, sources=sources)

        control.finish_run(
            handle,
            "thanh_cong",
            RunOutcome(
                mentions_found=stats.sau_khi_loc,
                mentions_new=stats.ban_ghi_moi,
                extracted_ok=stats.boc_thanh_cong,
                extracted_failed=stats.boc_that_bai,
            ),
        )
        log.info(
            "Lượt #%s xong: %s bài, %s bản ghi mới.",
            handle.id,
            stats.sau_khi_loc,
            stats.ban_ghi_moi,
        )
    except Exception as loi:  # noqa: BLE001 — mọi lỗi phải được ghi lại rồi đi tiếp
        log.exception("Lượt #%s thất bại", handle.id)
        control.finish_run(
            handle,
            "that_bai",
            error=f"{type(loi).__name__}: {loi}\n{traceback.format_exc(limit=5)}",
        )


def chay_theo_lich(source_name: str | None, lay_toan_van: bool = True) -> None:
    """Điểm vào cho APScheduler. Tự mở kết nối vì mỗi lần chạy là một luồng riêng."""
    with ControlPlane(CONTROL_DATABASE_URL) as control:
        handle = control.start_run(trigger="lich", source_name=source_name)
        log.info("Lịch kích hoạt lượt #%s cho %s.", handle.id, source_name or "toàn bộ nguồn")
        chay_mot_luot(control, handle, lay_toan_van=lay_toan_van)


def nhat_luot_cho() -> None:
    """Quét xem quản trị viên có bấm "Chạy ngay" không. Chạy mỗi vài chục giây."""
    with ControlPlane(CONTROL_DATABASE_URL) as control:
        if not control.tables_ready():
            log.warning("Chưa có bảng điều khiển — chờ apps/api chạy migration.")
            return

        handle = control.claim_pending_run()
        if handle is None:
            return

        log.info("Nhận lượt chạy thủ công #%s.", handle.id)
        chay_mot_luot(control, handle)
