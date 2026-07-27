"""
Gọi thẳng Google Analytics Data API.

Vì sao không dùng connector Airbyte ở giai đoạn này: trên máy không có Docker,
PyAirbyte bị chặn cả hai đường.

  1. Chạy connector ở chế độ manifest (DeclarativeExecutor) thì khâu kiểm tra cấu
     hình báo thiếu `property_ids` ngay cả khi cấu hình có đủ — connector GA4 có
     thành phần Python riêng nên chạy manifest thuần là hỏng.
  2. Cài gói Python thật thì `pendulum` phải biên dịch từ nguồn và cần `distutils`,
     thứ đã bị gỡ khỏi Python 3.12; lùi về 3.11 cũng không có wheel cho arm64.

Năm báo cáo trong `airbyte/config/ga4-custom-reports.json` chính là năm lệnh
`runReport`, nên gọi thẳng API vừa ngắn vừa gỡ lỗi được. **Định nghĩa báo cáo vẫn
giữ nguyên ở file JSON đó**, nên khi Học viện dựng được Docker và chuyển sang
Airbyte OSS thì dán thẳng vào là chạy — phần chuyển đổi không mất.
"""

from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta
from typing import Any

from .settings import Ga4Settings, load_custom_reports

TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token"
DATA_API = "https://analyticsdata.googleapis.com/v1beta"

# GA4 trả tối đa 100.000 dòng mỗi lượt; lấy nhỏ hơn để mỗi lượt nhẹ và dễ theo dõi.
PAGE_SIZE = 50_000


class Ga4ApiError(RuntimeError):
    """Google từ chối hoặc trả về dữ liệu không dùng được."""


def _post_json(url: str, payload: dict[str, Any], token: str | None = None) -> dict[str, Any]:
    data = json.dumps(payload).encode("utf-8")
    headers = {"content-type": "application/json"}
    if token:
        headers["authorization"] = f"Bearer {token}"

    request = urllib.request.Request(url, data=data, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            ket_qua: dict[str, Any] = json.loads(response.read().decode("utf-8"))
            return ket_qua
    except urllib.error.HTTPError as loi:
        chi_tiet = loi.read().decode("utf-8", errors="replace")[:400]
        raise Ga4ApiError(f"HTTP {loi.code} khi gọi {url}\n{chi_tiet}") from loi
    except urllib.error.URLError as loi:
        raise Ga4ApiError(f"Không kết nối được tới Google: {loi.reason}") from loi


def get_access_token(settings: Ga4Settings) -> str:
    """Đổi refresh token lấy access token. Refresh token dùng được lâu dài."""
    body = urllib.parse.urlencode(
        {
            "client_id": settings.client_id,
            "client_secret": settings.client_secret,
            "refresh_token": settings.refresh_token,
            "grant_type": "refresh_token",
        }
    ).encode("utf-8")

    request = urllib.request.Request(
        TOKEN_ENDPOINT,
        data=body,
        headers={"content-type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            payload: dict[str, Any] = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as loi:
        chi_tiet = loi.read().decode("utf-8", errors="replace")[:300]
        raise Ga4ApiError(
            "Google từ chối làm mới phiên đăng nhập. Vào trang Kết nối dữ liệu, "
            f"bấm Ngắt kết nối rồi đăng nhập lại.\n{chi_tiet}"
        ) from loi

    token = payload.get("access_token")
    if not token:
        raise Ga4ApiError("Google không trả về access token.")
    return str(token)


def _to_number(text: str) -> float | int:
    try:
        if "." in text:
            return float(text)
        return int(text)
    except ValueError:
        return 0


def run_report(
    token: str,
    property_id: str,
    report: dict[str, Any],
    start_date: str,
    end_date: str,
) -> list[dict[str, Any]]:
    """Chạy một báo cáo, tự phân trang cho đến hết."""
    dimensions: list[str] = report["dimensions"]
    metrics: list[str] = report["metrics"]

    rows: list[dict[str, Any]] = []
    offset = 0

    while True:
        payload = {
            "dateRanges": [{"startDate": start_date, "endDate": end_date}],
            "dimensions": [{"name": d} for d in dimensions],
            "metrics": [{"name": m} for m in metrics],
            "limit": PAGE_SIZE,
            "offset": offset,
            "keepEmptyRows": False,
        }
        ket_qua = _post_json(
            f"{DATA_API}/properties/{property_id}:runReport", payload, token
        )

        for row in ket_qua.get("rows", []):
            ban_ghi: dict[str, Any] = {}
            for ten, o in zip(dimensions, row.get("dimensionValues", []), strict=False):
                ban_ghi[ten] = o.get("value", "")
            for ten, o in zip(metrics, row.get("metricValues", []), strict=False):
                ban_ghi[ten] = _to_number(o.get("value", "0"))
            rows.append(ban_ghi)

        tong = int(ket_qua.get("rowCount", 0))
        offset += PAGE_SIZE
        if offset >= tong or not ket_qua.get("rows"):
            break

    return rows


def _chunks(start: date, end: date, days: int) -> list[tuple[str, str]]:
    """Cắt khoảng ngày thành từng đoạn — tránh một lượt gọi quá nặng và bị lấy mẫu."""
    doan: list[tuple[str, str]] = []
    moc = start
    while moc <= end:
        het = min(moc + timedelta(days=days - 1), end)
        doan.append((moc.isoformat(), het.isoformat()))
        moc = het + timedelta(days=1)
    return doan


def fetch_all(settings: Ga4Settings) -> dict[str, list[dict[str, Any]]]:
    """Kéo toàn bộ báo cáo về dạng dữ liệu thuần Python."""
    token = get_access_token(settings)
    start = datetime.strptime(settings.start_date, "%Y-%m-%d").date()
    end = date.today()
    doan = _chunks(start, end, settings.window_in_days)

    ket_qua: dict[str, list[dict[str, Any]]] = {}
    for report in load_custom_reports():
        ten = report["name"]
        rows: list[dict[str, Any]] = []
        for tu_ngay, den_ngay in doan:
            rows.extend(
                run_report(token, settings.property_id, report, tu_ngay, den_ngay)
            )
        ket_qua[ten] = rows
        print(f"  {ten}: {len(rows):,} dòng", flush=True)

    return ket_qua


def check_access(settings: Ga4Settings) -> str:
    """Xác nhận token còn dùng được và có quyền đọc property. Trả về tên property."""
    token = get_access_token(settings)
    ket_qua = _post_json(
        f"{DATA_API}/properties/{settings.property_id}:runReport",
        {
            "dateRanges": [{"startDate": "7daysAgo", "endDate": "yesterday"}],
            "metrics": [{"name": "sessions"}],
            "limit": 1,
        },
        token,
    )
    so_phien = ket_qua.get("rows", [{}])
    tong = so_phien[0]["metricValues"][0]["value"] if so_phien else "0"
    return f"property {settings.property_id}, 7 ngày qua có {tong} phiên"
