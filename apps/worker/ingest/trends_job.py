"""Ghép cấu hình, tầng mạng và kho cho job thị phần tìm kiếm.

Tách khỏi `trends.py` để phần tính toán ở đó không kéo theo phụ thuộc mạng nào.
"""

from __future__ import annotations

from .settings import BenchmarkBrands
from .trends import collect
from .trends_client import fetch
from .trends_storage import SearchInterestRow, now, open_store


def run_sync() -> None:
    """Hút chỉ số quan tâm tìm kiếm về kho. Chạy lại nhiều lần không sinh bản ghi trùng."""
    config = BenchmarkBrands.load()
    print(
        f"Nhóm đối sánh: {len(config.brands)} thương hiệu · "
        f"mốc quy thang: {config.anchor} · {config.geo} · {config.timeframe}"
    )

    weeks, interest, _ = collect(config, fetch)
    thoi_diem = now()

    rows = [
        SearchInterestRow(
            brand_key=brand.key,
            week_start=week,
            interest_index=round(interest[brand.key][chi_so], 4),
            query_term=brand.query,
            geo=config.geo,
            timeframe=config.timeframe,
            anchor_key=config.anchor,
            collected_at=thoi_diem,
        )
        for brand in config.brands
        for chi_so, week in enumerate(weeks)
    ]

    store = open_store()
    try:
        store.upsert(rows)
        print(
            f"Đã ghi {len(rows)} dòng ({len(weeks)} tuần × {len(config.brands)} thương hiệu). "
            f"Tổng trong kho: {store.count()} dòng."
        )
    finally:
        store.close()


def print_report() -> None:
    """In bảng thị phần tìm kiếm ra màn hình, không ghi kho — dùng để xem nhanh."""
    config = BenchmarkBrands.load()
    weeks, _, shares = collect(config, fetch)

    dau = 0
    cuoi = len(weeks) - 1
    print(f"\nThị phần tìm kiếm · {weeks[dau]} → {weeks[cuoi]} · {config.geo}\n")

    xep_hang = sorted(config.brands, key=lambda b: shares[b.key][cuoi], reverse=True)
    for thu_tu, brand in enumerate(xep_hang, start=1):
        hien_tai = shares[brand.key][cuoi]
        thay_doi = hien_tai - shares[brand.key][dau]
        danh_dau = "◆" if brand.is_us else " "
        print(
            f"{danh_dau} {thu_tu}. {brand.label[:44]:<44} "
            f"{hien_tai:5.2f}%  {thay_doi:+5.2f} điểm"
        )
    print("\n◆ = Học viện. Thay đổi tính bằng ĐIỂM phần trăm so với tuần đầu kỳ.\n")
