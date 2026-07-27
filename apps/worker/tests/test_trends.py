"""Kiểm tra phần tính thị phần tìm kiếm — chạy hoàn toàn ngoại tuyến, không gọi Google."""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path

import pytest

from ingest.settings import BenchmarkBrands, ConfigError
from ingest.trends import (
    TrendsBatch,
    TrendsError,
    build_batches,
    collect,
    compute_shares,
    rescale_to_anchor,
)

WEEKS = [date(2026, 5, 11), date(2026, 5, 18), date(2026, 5, 25)]

# Mức quan tâm "thật" giả định. Cố ý để fpt lớn hơn thương hiệu mốc hust: nhờ vậy
# hai lượt gọi được Google chuẩn hoá theo hai mức khác nhau, và bài kiểm tra mới
# thật sự kiểm được bước quy thang chứ không chỉ đi qua nó.
TRUE_INTEREST = {"ptit": 20.0, "hust": 30.0, "uet": 12.0, "uit": 13.0, "fpt": 45.0, "actvn": 6.0}


def test_chia_lo_gom_du_thuong_hieu_va_lo_nao_cung_co_moc() -> None:
    keys = ["hust", "ptit", "uet", "uit", "fpt", "actvn"]
    los = build_batches(keys, anchor="hust")

    assert all(len(lo) <= 5 for lo in los), "Google Trends chỉ so sánh được 5 từ khoá một lượt"
    assert all(lo[0] == "hust" for lo in los), "Thiếu mốc thì không quy thang được"

    khong_phai_moc = [k for lo in los for k in lo if k != "hust"]
    assert sorted(khong_phai_moc) == sorted(k for k in keys if k != "hust")
    assert len(khong_phai_moc) == len(set(khong_phai_moc)), "Có thương hiệu bị gọi hai lần"


def test_chia_lo_bao_loi_khi_moc_khong_thuoc_nhom() -> None:
    with pytest.raises(ConfigError):
        build_batches(["ptit", "hust"], anchor="khong-ton-tai")


def test_quy_thang_khoi_phuc_dung_ty_le_giua_hai_lo() -> None:
    """Hai lượt được chuẩn hoá khác nhau; sau khi quy thang phải so sánh được với nhau."""
    lo_dau = {"hust": [100.0, 50.0], "b": [80.0, 40.0]}
    lo_sau = {"hust": [50.0, 25.0], "c": [10.0, 5.0]}

    ket_qua = rescale_to_anchor([lo_dau, lo_sau], anchor="hust")

    assert ket_qua["hust"] == [100.0, 50.0], "Mốc phải giữ nguyên giá trị của lượt chuẩn"
    assert ket_qua["b"] == [80.0, 40.0]
    # Lượt sau bị Google thu nhỏ đúng một nửa nên phải nhân đôi lại.
    assert ket_qua["c"] == pytest.approx([20.0, 10.0])


def test_quy_thang_bao_loi_khi_moc_bang_khong() -> None:
    """Mốc không có lượt tìm kiếm nào thì không có gì để so — phải dừng, không ghi số sai."""
    with pytest.raises(TrendsError, match="mốc"):
        rescale_to_anchor([{"hust": [0.0, 0.0], "b": [10.0, 10.0]}], anchor="hust")


def test_quy_thang_bao_loi_khi_mot_lo_thieu_moc() -> None:
    with pytest.raises(TrendsError, match="thiếu thương hiệu mốc"):
        rescale_to_anchor([{"hust": [10.0]}, {"c": [5.0]}], anchor="hust")


def test_ty_trong_moi_tuan_cong_lai_bang_tram() -> None:
    shares = compute_shares({"a": [10.0, 30.0], "b": [30.0, 10.0], "c": [60.0, 60.0]})

    for tuan in range(2):
        tong = sum(chuoi[tuan] for chuoi in shares.values())
        assert tong == pytest.approx(100.0, abs=0.01)

    assert shares["a"] == pytest.approx([10.0, 30.0])


def test_ty_trong_khi_ca_nhom_deu_bang_khong() -> None:
    """Tuần không ai được tìm kiếm: trả 0 chứ không chia cho 0."""
    shares = compute_shares({"a": [0.0], "b": [0.0]})
    assert shares == {"a": [0.0], "b": [0.0]}


def test_ty_trong_bao_loi_khi_chuoi_lech_do_dai() -> None:
    with pytest.raises(TrendsError, match="độ dài"):
        compute_shares({"a": [1.0, 2.0], "b": [1.0]})


def _fake_fetch(queries: list[str], geo: str, timeframe: str) -> TrendsBatch:
    """Giả lập Google Trends: mỗi lượt được chuẩn hoá riêng về thang 0–100."""
    config = BenchmarkBrands.load()
    theo_tu_khoa = {config.by_key(k).query: v for k, v in TRUE_INTEREST.items()}

    lon_nhat = max(theo_tu_khoa[q] for q in queries)
    return TrendsBatch(
        weeks=list(WEEKS),
        values={q: [theo_tu_khoa[q] / lon_nhat * 100 for _ in WEEKS] for q in queries},
    )


def test_collect_khoi_phuc_dung_thi_phan_that() -> None:
    """Chạy trọn luồng với Trends giả lập: chia lô, quy thang, tính tỷ trọng."""
    config = BenchmarkBrands.load()
    weeks, interest, shares = collect(config, _fake_fetch)

    assert weeks == WEEKS
    assert set(shares) == {b.key for b in config.brands}

    tong_that = sum(TRUE_INTEREST.values())
    for khoa, mong_doi in TRUE_INTEREST.items():
        assert shares[khoa][0] == pytest.approx(mong_doi / tong_that * 100, abs=0.05), khoa

    # Chuỗi thô ghi xuống kho phải giữ đúng tỷ lệ giữa các thương hiệu.
    assert interest["ptit"][0] / interest["hust"][0] == pytest.approx(20 / 30, abs=0.001)


def test_cau_hinh_nhom_doi_sanh_hop_le() -> None:
    config = BenchmarkBrands.load()

    assert len(config.brands) >= 2
    assert sum(1 for b in config.brands if b.is_us) == 1
    assert config.anchor in {b.key for b in config.brands}
    assert all(b.query for b in config.brands), "Thiếu từ khoá thì không gọi Trends được"


def test_cau_hinh_bao_loi_khi_khong_danh_dau_hoc_vien(tmp_path: Path) -> None:
    """Không có thương hiệu nào là của ta thì mọi biểu đồ mất đường cần làm nổi."""
    duong_dan = tmp_path / "brands.json"
    duong_dan.write_text(
        json.dumps(
            {
                "anchor": "a",
                "brands": [
                    {"key": "a", "label": "A", "is_us": False, "query": "a"},
                    {"key": "b", "label": "B", "is_us": False, "query": "b"},
                ],
            }
        ),
        encoding="utf-8",
    )

    with pytest.raises(ConfigError, match="is_us"):
        BenchmarkBrands.load(duong_dan)


def test_cau_hinh_bao_loi_khi_moc_khong_thuoc_nhom(tmp_path: Path) -> None:
    duong_dan = tmp_path / "brands.json"
    duong_dan.write_text(
        json.dumps(
            {
                "anchor": "khong-co",
                "brands": [
                    {"key": "a", "label": "A", "is_us": True, "query": "a"},
                    {"key": "b", "label": "B", "is_us": False, "query": "b"},
                ],
            }
        ),
        encoding="utf-8",
    )

    with pytest.raises(ConfigError, match="anchor"):
        BenchmarkBrands.load(duong_dan)
