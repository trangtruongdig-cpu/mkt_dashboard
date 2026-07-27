"""Bảng quy đổi lịch bên Python phải khớp bảng bên TypeScript.

Đây là bản sao bắt buộc: TypeScript và Python không dùng chung được hằng số. Test này
đọc thẳng file TypeScript nên sửa một bên mà quên bên kia là hỏng ngay tại đây, thay vì
im lặng chạy sai lịch trên máy chủ.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from jobs.schedules import SCHEDULE_CRON, cron_for

TS_PATH = (
    Path(__file__).resolve().parents[3]
    / "packages"
    / "shared"
    / "src"
    / "schemas"
    / "crawler-admin.ts"
)

# Bắt phần thân của `export const CRAWLER_SCHEDULE_CRON: Record<...> = { ... };`
KHOI_CRON = re.compile(r"CRAWLER_SCHEDULE_CRON:\s*Record<[^>]*>\s*=\s*\{(.*?)\};", re.DOTALL)
DONG_CRON = re.compile(r"(\w+)\s*:\s*(null|\"([^\"]*)\")")


def _doc_bang_typescript() -> dict[str, str | None]:
    if not TS_PATH.exists():  # pragma: no cover — chỉ xảy ra khi đổi cấu trúc thư mục
        pytest.skip(f"Không tìm thấy {TS_PATH}")

    khop = KHOI_CRON.search(TS_PATH.read_text(encoding="utf-8"))
    assert khop, "Không tìm thấy CRAWLER_SCHEDULE_CRON trong crawler-admin.ts"

    return {
        khoa: (None if gia_tri == "null" else chuoi)
        for khoa, gia_tri, chuoi in DONG_CRON.findall(khop.group(1))
    }


def test_hai_ben_khai_bao_cung_bo_ma_lich() -> None:
    assert set(SCHEDULE_CRON) == set(_doc_bang_typescript())


def test_hai_ben_cho_cung_bieu_thuc_cron() -> None:
    assert _doc_bang_typescript() == SCHEDULE_CRON


def test_lich_tat_khong_sinh_cron() -> None:
    assert cron_for("tat") is None


def test_ma_lich_la_coi_nhu_tat() -> None:
    """Worker cũ gặp mã lịch của phiên bản mới thì bỏ qua, không được chết cả tiến trình."""
    assert cron_for("moi_15_phut") is None


def test_moi_lich_bat_deu_co_cron_hop_le() -> None:
    from apscheduler.triggers.cron import CronTrigger

    for ma, cron in SCHEDULE_CRON.items():
        if cron is None:
            continue
        # Ném lỗi nếu biểu thức sai cú pháp — bắt lỗi gõ nhầm ngay tại đây.
        CronTrigger.from_crontab(cron, timezone="Asia/Ho_Chi_Minh")
        assert len(cron.split()) == 5, ma
