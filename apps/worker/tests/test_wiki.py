"""Kiểm tra phần tính thị phần chú ý — chạy hoàn toàn ngoại tuyến, không gọi Wikimedia."""

from __future__ import annotations

from datetime import date, timedelta

import pytest

from ingest.settings import BenchmarkBrands, ConfigError
from ingest.wiki import (
    DailyViews,
    WikiError,
    align_weeks,
    compute_shares,
    to_weekly,
    week_start_of,
)

# 11/05/2026 là thứ Hai. Mọi mốc trong file này đếm từ đó.
THU_HAI = date(2026, 5, 11)


def _tuan_du(start: date, views_moi_ngay: int) -> list[DailyViews]:
    return [DailyViews(day=start + timedelta(days=i), views=views_moi_ngay) for i in range(7)]


def test_moc_dau_tuan_luon_la_thu_hai() -> None:
    assert week_start_of(THU_HAI) == THU_HAI
    assert week_start_of(THU_HAI + timedelta(days=3)) == THU_HAI
    assert week_start_of(THU_HAI + timedelta(days=6)) == THU_HAI, "Chủ nhật vẫn thuộc tuần đó"
    assert week_start_of(THU_HAI + timedelta(days=7)) == THU_HAI + timedelta(days=7)


def test_gop_ngay_thanh_tuan() -> None:
    daily = _tuan_du(THU_HAI, 10) + _tuan_du(THU_HAI + timedelta(days=7), 20)
    theo_tuan = to_weekly(daily)

    assert theo_tuan == {THU_HAI: 70, THU_HAI + timedelta(days=7): 140}


def test_bo_tuan_chua_tron_ven() -> None:
    """Tuần đang diễn ra luôn thiếu ngày; giữ lại sẽ tạo cú rơi giả ở cuối biểu đồ."""
    tuan_du = _tuan_du(THU_HAI, 10)
    tuan_thieu = [
        DailyViews(day=THU_HAI + timedelta(days=7 + i), views=100) for i in range(3)
    ]

    theo_tuan = to_weekly(tuan_du + tuan_thieu)

    assert list(theo_tuan) == [THU_HAI], "Tuần 3 ngày phải bị loại"
    assert theo_tuan[THU_HAI] == 70


def test_giu_tuan_chua_tron_ven_khi_duoc_yeu_cau() -> None:
    tuan_thieu = [DailyViews(day=THU_HAI + timedelta(days=i), views=5) for i in range(3)]
    assert to_weekly(tuan_thieu, drop_incomplete=False) == {THU_HAI: 15}


def test_can_tuan_chi_giu_tuan_ca_nhom_deu_co() -> None:
    """Thiếu một thương hiệu ở tuần nào thì cả nhóm bỏ tuần đó, không coi thiếu là 0."""
    t1, t2, t3 = THU_HAI, THU_HAI + timedelta(days=7), THU_HAI + timedelta(days=14)

    tuan, views = align_weeks(
        {
            "ptit": {t1: 100, t2: 110, t3: 120},
            "hust": {t2: 200, t3: 210},  # thiếu t1
        }
    )

    assert tuan == [t2, t3]
    assert views == {"ptit": [110, 120], "hust": [200, 210]}


def test_can_tuan_bao_loi_khi_khong_co_tuan_chung() -> None:
    with pytest.raises(WikiError, match="Không có tuần nào"):
        align_weeks({"a": {THU_HAI: 1}, "b": {THU_HAI + timedelta(days=7): 1}})


def test_ty_trong_moi_tuan_cong_lai_bang_tram() -> None:
    shares = compute_shares({"a": [25, 60], "b": [75, 40], "c": [100, 100]})

    for tuan in range(2):
        assert sum(chuoi[tuan] for chuoi in shares.values()) == pytest.approx(100.0, abs=0.01)

    assert shares["a"][0] == pytest.approx(12.5)


def test_ty_trong_khi_ca_nhom_deu_bang_khong() -> None:
    """Tuần không ai được xem: trả 0 chứ không chia cho 0."""
    assert compute_shares({"a": [0], "b": [0]}) == {"a": [0.0], "b": [0.0]}


def test_ty_trong_bao_loi_khi_chuoi_lech_do_dai() -> None:
    with pytest.raises(WikiError, match="độ dài"):
        compute_shares({"a": [1, 2], "b": [1]})


def test_moi_thuong_hieu_deu_khai_bai_wikipedia() -> None:
    config = BenchmarkBrands.load()
    brands = config.wikipedia_brands()

    assert len(brands) == len(config.brands)
    assert config.wikipedia_project == "vi.wikipedia.org"

    bai = [b.wikipedia_article for b in brands]
    assert len(set(bai)) == len(bai), "Hai thương hiệu trỏ về cùng một bài thì thị phần vô nghĩa"


def test_bao_loi_khi_thieu_bai_wikipedia(tmp_path: object) -> None:
    """Thiếu một thương hiệu là mẫu số lệch, mọi tỷ trọng đều sai — phải dừng hẳn."""
    import json
    from pathlib import Path

    duong_dan = Path(str(tmp_path)) / "brands.json"
    duong_dan.write_text(
        json.dumps(
            {
                "anchor": "a",
                "brands": [
                    {
                        "key": "a",
                        "label": "A",
                        "is_us": True,
                        "query": "a",
                        "wikipedia_article": "A",
                    },
                    {"key": "b", "label": "B", "is_us": False, "query": "b"},
                ],
            }
        ),
        encoding="utf-8",
    )

    config = BenchmarkBrands.load(duong_dan)
    with pytest.raises(ConfigError, match="wikipedia_article"):
        config.wikipedia_brands()
