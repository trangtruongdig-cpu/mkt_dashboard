"""Ghép cấu hình, tầng mạng và kho cho job thị phần chú ý trên Wikipedia.

Tách khỏi `wiki.py` để phần tính toán ở đó không kéo theo phụ thuộc mạng nào.
"""

from __future__ import annotations

import os
from datetime import date, timedelta

from .settings import BenchmarkBrands
from .wiki import align_weeks, compute_shares, to_weekly, week_start_of
from .wiki_client import fetch_daily_views
from .wiki_storage import PageviewsRow, now, open_store

DEFAULT_WEEKS = int(os.getenv("WIKI_WEEKS", "26"))


def _khoang_thoi_gian(weeks: int, today: date | None = None) -> tuple[date, date]:
    """Khoảng ngày cần hỏi: `weeks` tuần TRỌN VẸN gần nhất, không tính tuần đang chạy."""
    hom_nay = today or date.today()
    tuan_nay = week_start_of(hom_nay)
    ket_thuc = tuan_nay - timedelta(days=1)  # Chủ nhật của tuần trọn vẹn cuối cùng
    bat_dau = tuan_nay - timedelta(weeks=weeks)
    return bat_dau, ket_thuc


def _thu_thap(
    config: BenchmarkBrands,
    weeks: int,
) -> tuple[list[date], dict[str, list[int]], dict[str, list[float]]]:
    bat_dau, ket_thuc = _khoang_thoi_gian(weeks)
    brands = config.wikipedia_brands()

    theo_brand: dict[str, dict[date, int]] = {}
    for brand in brands:
        daily = fetch_daily_views(
            project=config.wikipedia_project,
            article=brand.wikipedia_article,
            start=bat_dau,
            end=ket_thuc,
        )
        theo_brand[brand.key] = to_weekly(daily)

    tuan, luot_xem = align_weeks(theo_brand)
    return tuan, luot_xem, compute_shares(luot_xem)


def run_sync(weeks: int = DEFAULT_WEEKS) -> None:
    """Hút lượt xem trang Wikipedia về kho. Chạy lại nhiều lần không sinh bản ghi trùng."""
    config = BenchmarkBrands.load()
    print(
        f"Nhóm đối sánh: {len(config.brands)} thương hiệu · "
        f"{config.wikipedia_project} · {weeks} tuần gần nhất"
    )

    tuan, luot_xem, _ = _thu_thap(config, weeks)
    thoi_diem = now()

    rows = [
        PageviewsRow(
            brand_key=brand.key,
            week_start=w,
            views=luot_xem[brand.key][i],
            article=brand.wikipedia_article,
            project=config.wikipedia_project,
            collected_at=thoi_diem,
        )
        for brand in config.wikipedia_brands()
        for i, w in enumerate(tuan)
    ]

    store = open_store()
    try:
        store.upsert(rows)
        print(
            f"Đã ghi {len(rows)} dòng ({len(tuan)} tuần × {len(config.brands)} thương hiệu). "
            f"Tổng trong kho: {store.count()} dòng."
        )
    finally:
        store.close()


def print_report(weeks: int = DEFAULT_WEEKS) -> None:
    """In bảng thị phần chú ý ra màn hình, không ghi kho — dùng để xem nhanh."""
    config = BenchmarkBrands.load()
    tuan, luot_xem, shares = _thu_thap(config, weeks)

    dau, cuoi = 0, len(tuan) - 1
    print(f"\nThị phần chú ý (lượt xem Wikipedia) · {tuan[dau]} → {tuan[cuoi]}\n")

    xep_hang = sorted(config.brands, key=lambda b: shares[b.key][cuoi], reverse=True)
    for thu_tu, brand in enumerate(xep_hang, start=1):
        hien_tai = shares[brand.key][cuoi]
        thay_doi = hien_tai - shares[brand.key][dau]
        danh_dau = "◆" if brand.is_us else " "
        print(
            f"{danh_dau} {thu_tu}. {brand.label[:44]:<44} "
            f"{hien_tai:5.2f}%  {thay_doi:+5.2f} điểm  "
            f"({luot_xem[brand.key][cuoi]:>5} lượt xem tuần cuối)"
        )

    print("\n◆ = Học viện. Thay đổi tính bằng ĐIỂM phần trăm so với tuần đầu kỳ.")
    print("Chỉ tính các tuần trọn vẹn 7 ngày mà cả nhóm đối sánh đều có dữ liệu.\n")
