"""Kiểm tra định nghĩa báo cáo GA4 — chạy được mà không cần thông tin đăng nhập."""

from __future__ import annotations

import pytest

from ingest.ga4 import build_source_config
from ingest.settings import Ga4Settings, load_custom_reports

# Giới hạn của GA4 Data API cho một yêu cầu báo cáo.
MAX_DIMENSIONS = 9
MAX_METRICS = 10


def test_nap_duoc_bao_cao() -> None:
    reports = load_custom_reports()
    assert len(reports) >= 1


def test_moi_bao_cao_deu_hop_le() -> None:
    for report in load_custom_reports():
        assert report["name"].startswith("ga4_"), report["name"]
        assert report["dimensions"], f"{report['name']} không có phương diện nào"
        assert report["metrics"], f"{report['name']} không có chỉ số nào"
        assert len(report["dimensions"]) <= MAX_DIMENSIONS, report["name"]
        assert len(report["metrics"]) <= MAX_METRICS, report["name"]


def test_bao_cao_nao_cung_co_phuong_dien_date() -> None:
    """Thiếu 'date' thì không đồng bộ tăng dần được, mỗi lần chạy phải kéo lại từ đầu."""
    for report in load_custom_reports():
        assert "date" in report["dimensions"], report["name"]


def test_ten_bao_cao_khong_trung() -> None:
    ten = [r["name"] for r in load_custom_reports()]
    assert len(set(ten)) == len(ten)


def test_co_bao_cao_boc_tach_multisite() -> None:
    """Property phủ toàn bộ ptit.edu.vn nên bắt buộc phải tách được theo tên máy chủ."""
    tat_ca_phuong_dien = {d for r in load_custom_reports() for d in r["dimensions"]}
    assert "hostName" in tat_ca_phuong_dien


def test_co_bao_cao_do_that_thoat_quy_ket() -> None:
    """Cần nguồn/phương tiện phiên để đo tỷ lệ (direct)/(none)."""
    tat_ca_phuong_dien = {d for r in load_custom_reports() for d in r["dimensions"]}
    assert {"sessionSource", "sessionMedium"} <= tat_ca_phuong_dien


def test_config_khong_lam_ro_bi_mat_khi_in() -> None:
    settings = Ga4Settings(
        property_id="464491273",
        client_id="id-gia-lap",
        client_secret="secret-gia-lap",
        refresh_token="token-gia-lap",
        start_date="2025-07-01",
        window_in_days=30,
    )
    config = build_source_config(settings)

    assert config["property_ids"] == ["464491273"]
    assert config["credentials"]["auth_type"] == "Client"
    assert len(config["custom_reports_array"]) == len(load_custom_reports())


def test_thieu_bien_moi_truong_thi_bao_loi_ro_rang(monkeypatch: pytest.MonkeyPatch) -> None:
    for bien in ("GA4_PROPERTY_ID", "GA4_CLIENT_ID", "GA4_CLIENT_SECRET", "GA4_REFRESH_TOKEN"):
        monkeypatch.setenv(bien, "")

    with pytest.raises(Exception) as loi:
        Ga4Settings.from_env()

    assert "GA4_PROPERTY_ID" in str(loi.value)
