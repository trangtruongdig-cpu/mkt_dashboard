"""Cấu hình cho các job hút dữ liệu. Đọc từ biến môi trường, kiểm tra ngay khi nạp."""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

from dotenv import load_dotenv

WORKER_ROOT = Path(__file__).resolve().parent.parent
REPO_ROOT = WORKER_ROOT.parent.parent
CUSTOM_REPORTS_PATH = REPO_ROOT / "airbyte" / "config" / "ga4-custom-reports.json"
BENCHMARK_BRANDS_PATH = WORKER_ROOT / "config" / "benchmark-brands.json"

load_dotenv(WORKER_ROOT / ".env")


class ConfigError(RuntimeError):
    """Cấu hình thiếu hoặc sai — dừng ngay thay vì chạy tiếp với giá trị nửa vời."""


def _required(name: str, goi_y: str = "", cu: str = "") -> str:
    """Đọc biến bắt buộc. `cu` là tên cũ vẫn chấp nhận để .env sẵn có không gãy."""
    value = os.getenv(name, "").strip()
    if not value and cu:
        value = os.getenv(cu, "").strip()
    if not value:
        thong_diep = f"Thiếu biến môi trường {name}."
        if goi_y:
            thong_diep += f" {goi_y}"
        thong_diep += " Xem apps/worker/.env.example."
        raise ConfigError(thong_diep)
    return value


@dataclass(frozen=True)
class Ga4Settings:
    property_id: str
    client_id: str
    client_secret: str
    refresh_token: str
    start_date: str
    window_in_days: int

    @classmethod
    def load(cls) -> Ga4Settings:
        """Chỉ đọc từ biến môi trường.

        Trước đây ưu tiên file `.secrets/google.json` do API ghi ra. Bỏ hẳn đường đó:
        file nằm trong repo nên chỉ cần một lần gom cả thư mục là bí mật lọt vào commit.
        Giờ API và worker cùng đọc một bộ biến môi trường — vẫn là một nguồn sự thật,
        nhưng không có gì nằm trên đĩa trong repo.
        """
        return cls.from_env()

    @classmethod
    def from_env(cls) -> Ga4Settings:
        goi_y = (
            "Đặt trong .env của worker, cùng tên biến với API. "
            "Chạy luồng OAuth ở trang /ket-noi để lấy refresh token."
        )
        return cls(
            property_id=_required("GA4_PROPERTY_ID", goi_y),
            client_id=_required("GOOGLE_CLIENT_ID", goi_y, cu="GA4_CLIENT_ID"),
            client_secret=_required(
                "GOOGLE_CLIENT_SECRET", goi_y, cu="GA4_CLIENT_SECRET"
            ),
            refresh_token=_required(
                "GOOGLE_REFRESH_TOKEN", goi_y, cu="GA4_REFRESH_TOKEN"
            ),
            start_date=os.getenv("GA4_START_DATE", "2025-07-01").strip(),
            window_in_days=int(os.getenv("GA4_WINDOW_IN_DAYS", "30")),
        )


CacheKind = Literal["duckdb", "postgres"]


@dataclass(frozen=True)
class CacheSettings:
    kind: CacheKind
    duckdb_path: Path
    postgres_host: str
    postgres_port: int
    postgres_db: str
    postgres_user: str
    postgres_password: str
    schema_name: str

    @classmethod
    def from_env(cls) -> CacheSettings:
        kind = os.getenv("INGEST_CACHE", "duckdb").strip().lower()
        if kind not in ("duckdb", "postgres"):
            raise ConfigError(f"INGEST_CACHE phải là 'duckdb' hoặc 'postgres', nhận được: {kind!r}")

        duckdb_path = WORKER_ROOT / os.getenv("DUCKDB_PATH", ".data/ptit_ga4.duckdb")
        return cls(
            kind=kind,  # type: ignore[arg-type]
            duckdb_path=duckdb_path,
            postgres_host=os.getenv("POSTGRES_HOST", "localhost"),
            postgres_port=int(os.getenv("POSTGRES_PORT", "5432")),
            postgres_db=os.getenv("POSTGRES_DB", "ptit_dashboard"),
            postgres_user=os.getenv("POSTGRES_USER", "ptit"),
            postgres_password=os.getenv("POSTGRES_PASSWORD", ""),
            schema_name=os.getenv("POSTGRES_SCHEMA", "ga4_raw"),
        )


@dataclass(frozen=True)
class BenchmarkBrand:
    key: str
    label: str
    is_us: bool
    query: str
    """Tên bài Wikipedia. Rỗng nghĩa là thương hiệu này không đo được lượt xem trang."""
    wikipedia_article: str


@dataclass(frozen=True)
class BenchmarkBrands:
    """Nhóm trường đối sánh — mẫu số chung của mọi chỉ số thị phần."""

    geo: str
    timeframe: str
    anchor: str
    wikipedia_project: str
    brands: list[BenchmarkBrand]

    @classmethod
    def load(cls, path: Path | None = None) -> BenchmarkBrands:
        duong_dan = path or BENCHMARK_BRANDS_PATH
        if not duong_dan.exists():
            raise ConfigError(f"Không tìm thấy {duong_dan}")

        try:
            du_lieu: dict[str, Any] = json.loads(duong_dan.read_text(encoding="utf-8"))
        except json.JSONDecodeError as loi:
            raise ConfigError(f"{duong_dan} không phải JSON hợp lệ: {loi}") from loi

        brands = [
            BenchmarkBrand(
                key=str(m["key"]).strip(),
                label=str(m["label"]).strip(),
                is_us=bool(m.get("is_us", False)),
                query=str(m["query"]).strip(),
                wikipedia_article=str(m.get("wikipedia_article", "")).strip(),
            )
            for m in du_lieu.get("brands", [])
        ]

        if len(brands) < 2:
            raise ConfigError(f"{duong_dan}: cần ít nhất 2 thương hiệu để tính được thị phần.")

        khoa = [b.key for b in brands]
        if len(set(khoa)) != len(khoa):
            raise ConfigError(f"{duong_dan}: có thương hiệu bị trùng key.")

        # Đúng một thương hiệu là của Học viện. Không có thì mọi biểu đồ mất đường
        # cần làm nổi; nhiều hơn một thì không biết làm nổi đường nào.
        so_cua_ta = sum(1 for b in brands if b.is_us)
        if so_cua_ta != 1:
            raise ConfigError(
                f"{duong_dan}: phải có đúng một thương hiệu đặt is_us=true, đang có {so_cua_ta}."
            )

        anchor = str(du_lieu.get("anchor", "")).strip()
        if anchor not in khoa:
            raise ConfigError(
                f"{duong_dan}: anchor {anchor!r} không nằm trong danh sách thương hiệu."
            )

        return cls(
            geo=str(du_lieu.get("geo", "VN")).strip(),
            timeframe=str(du_lieu.get("timeframe", "today 12-m")).strip(),
            anchor=anchor,
            wikipedia_project=str(du_lieu.get("wikipedia_project", "vi.wikipedia.org")).strip(),
            brands=brands,
        )

    def by_key(self, key: str) -> BenchmarkBrand:
        for brand in self.brands:
            if brand.key == key:
                return brand
        raise ConfigError(f"Không có thương hiệu {key!r} trong nhóm đối sánh.")

    def wikipedia_brands(self) -> list[BenchmarkBrand]:
        """Các thương hiệu đo được lượt xem Wikipedia.

        Thiếu bài của một thương hiệu thì mẫu số bị lệch, mọi tỷ trọng đều sai — nên
        dừng hẳn thay vì lặng lẽ tính trên nhóm thiếu người.
        """
        thieu = [b.key for b in self.brands if not b.wikipedia_article]
        if thieu:
            raise ConfigError(
                f"Thiếu wikipedia_article cho: {', '.join(thieu)}. "
                "Thiếu một thương hiệu là mẫu số tính thị phần bị lệch."
            )
        return list(self.brands)


def load_custom_reports() -> list[dict[str, Any]]:
    """Nạp định nghĩa báo cáo tuỳ chỉnh — dùng chung với Airbyte OSS sau này."""
    if not CUSTOM_REPORTS_PATH.exists():
        raise ConfigError(f"Không tìm thấy {CUSTOM_REPORTS_PATH}")

    reports: list[dict[str, Any]] = json.loads(CUSTOM_REPORTS_PATH.read_text(encoding="utf-8"))

    ten = [r["name"] for r in reports]
    if len(set(ten)) != len(ten):
        raise ConfigError("Có tên báo cáo bị trùng trong ga4-custom-reports.json")

    for report in reports:
        if "date" not in report["dimensions"]:
            raise ConfigError(
                f"Báo cáo {report['name']} thiếu phương diện 'date' — "
                "không có nó thì không đồng bộ tăng dần được."
            )
    return reports
