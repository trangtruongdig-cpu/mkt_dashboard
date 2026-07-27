"""
Thị phần tìm kiếm (Share of Search) từ Google Trends.

Vì sao chỉ số này đứng đầu hàng đợi: nó lấy được hoàn toàn từ nguồn công khai, không
cần tài khoản quảng cáo, không cần dữ liệu nội bộ của Học viện, và nó biến động theo
TUẦN trong khi kết quả tuyển sinh mỗi năm mới công bố một lần. Đây là tín hiệu sớm
duy nhất mà nhiệm vụ có thể tự thu thập ngay từ đầu.

Ràng buộc kỹ thuật chi phối toàn bộ module này: Google Trends chỉ so sánh được TỐI ĐA
5 TỪ KHOÁ trong một lượt, và giá trị trả về là chỉ số tương đối 0–100 chuẩn hoá theo
riêng lượt đó. Nhóm đối sánh có 6 trường nên phải chia thành nhiều lượt, và các lượt
KHÔNG so sánh trực tiếp với nhau được. Cách xử lý: mỗi lượt đều chứa một thương hiệu
mốc, rồi quy các lượt về cùng thang bằng tỷ lệ của thương hiệu mốc đó.

Phần tính toán ở đây là hàm thuần, không chạm mạng — để test được mà không phụ thuộc
vào việc Google có trả lời hay không.
"""

from __future__ import annotations

import statistics
from dataclasses import dataclass
from datetime import date
from typing import Protocol

from .settings import BenchmarkBrands, ConfigError

# Trần cứng của Google Trends. Không phải tham số tuỳ chỉnh.
MAX_TERMS_PER_REQUEST = 5


class TrendsError(RuntimeError):
    """Dữ liệu Trends không dùng được — dừng thay vì ghi số sai vào kho."""


@dataclass(frozen=True)
class TrendsBatch:
    """Kết quả một lượt gọi Trends. `values` khoá theo TỪ KHOÁ, chưa phải khoá thương hiệu."""

    weeks: list[date]
    values: dict[str, list[float]]


class TrendsFetcher(Protocol):
    """Tầng mạng, tách riêng để phần tính toán test được mà không cần gọi Google."""

    def __call__(self, queries: list[str], geo: str, timeframe: str) -> TrendsBatch: ...


def build_batches(
    brand_keys: list[str],
    anchor: str,
    max_terms: int = MAX_TERMS_PER_REQUEST,
) -> list[list[str]]:
    """Chia nhóm thương hiệu thành các lượt gọi, mỗi lượt đều có thương hiệu mốc.

    Thương hiệu mốc luôn đứng đầu mỗi lượt để bước quy thang bên dưới tìm nó dễ dàng.
    """
    if anchor not in brand_keys:
        raise ConfigError(f"Thương hiệu mốc {anchor!r} không nằm trong nhóm đối sánh.")
    if max_terms < 2:
        raise ConfigError(
            "Mỗi lượt phải chứa được ít nhất thương hiệu mốc và một thương hiệu khác."
        )

    others = [k for k in brand_keys if k != anchor]
    if not others:
        return [[anchor]]

    kich_thuoc = max_terms - 1  # trừ một chỗ dành cho thương hiệu mốc
    return [[anchor, *others[i : i + kich_thuoc]] for i in range(0, len(others), kich_thuoc)]


def rescale_to_anchor(
    batches: list[dict[str, list[float]]],
    anchor: str,
) -> dict[str, list[float]]:
    """Quy các lượt về cùng một thang, lấy lượt đầu tiên làm chuẩn.

    Mỗi lượt được Google chuẩn hoá riêng: giá trị 100 ở lượt A và 100 ở lượt B không
    bằng nhau. Thương hiệu mốc xuất hiện ở mọi lượt nên tỷ lệ trung bình của nó giữa
    hai lượt chính là hệ số quy đổi.
    """
    if not batches:
        raise TrendsError("Không có lượt dữ liệu nào để quy thang.")

    for chi_so, batch in enumerate(batches):
        if anchor not in batch:
            raise TrendsError(f"Lượt {chi_so} thiếu thương hiệu mốc {anchor!r}.")

    chuan = statistics.fmean(batches[0][anchor])
    if chuan <= 0:
        raise TrendsError(
            f"Thương hiệu mốc {anchor!r} có mức quan tâm bằng 0 ở lượt chuẩn — "
            "không quy thang được. Chọn thương hiệu mốc có lượng tìm kiếm lớn hơn."
        )

    ket_qua: dict[str, list[float]] = {}
    for chi_so, batch in enumerate(batches):
        trung_binh = statistics.fmean(batch[anchor])
        if trung_binh <= 0:
            raise TrendsError(
                f"Thương hiệu mốc {anchor!r} có mức quan tâm bằng 0 ở lượt {chi_so} — "
                "lượt này không quy về cùng thang được."
            )
        he_so = chuan / trung_binh

        for khoa, chuoi in batch.items():
            # Thương hiệu mốc chỉ lấy từ lượt chuẩn, các lượt sau bỏ qua để tránh ghi đè.
            if khoa == anchor and chi_so > 0:
                continue
            ket_qua[khoa] = [v * he_so for v in chuoi]

    return ket_qua


def compute_shares(interest: dict[str, list[float]]) -> dict[str, list[float]]:
    """Đổi chuỗi mức quan tâm thành tỷ trọng %, mỗi tuần cộng lại bằng 100.

    Đây là bước biến "mức quan tâm tuyệt đối" — thứ dao động theo mùa tuyển sinh và
    không so sánh được giữa các năm — thành "thị phần", thứ nói lên vị thế cạnh tranh.
    """
    if not interest:
        raise TrendsError("Không có chuỗi nào để tính thị phần.")

    do_dai = {len(v) for v in interest.values()}
    if len(do_dai) != 1:
        raise TrendsError(f"Các chuỗi có độ dài khác nhau: {sorted(do_dai)}.")

    so_tuan = do_dai.pop()
    shares: dict[str, list[float]] = {khoa: [] for khoa in interest}

    for tuan in range(so_tuan):
        tong = sum(chuoi[tuan] for chuoi in interest.values())
        for khoa, chuoi in interest.items():
            shares[khoa].append(0.0 if tong <= 0 else round(chuoi[tuan] / tong * 100, 2))

    return shares


def collect(
    config: BenchmarkBrands,
    fetch: TrendsFetcher,
) -> tuple[list[date], dict[str, list[float]], dict[str, list[float]]]:
    """Gọi Trends theo từng lượt, quy về cùng thang, rồi tính thị phần.

    Trả về `(weeks, interest, shares)`. `interest` là số liệu thô đã quy thang — đây
    mới là thứ ghi xuống kho; `shares` chỉ để in ra xem ngay, còn phép chia tỷ trọng
    thật sự thuộc về tầng dbt.
    """
    keys = [b.key for b in config.brands]
    batches = build_batches(keys, config.anchor)

    weeks: list[date] | None = None
    theo_lo: list[dict[str, list[float]]] = []

    for lo in batches:
        queries = [config.by_key(k).query for k in lo]
        ket_qua = fetch(queries, config.geo, config.timeframe)

        thieu = [q for q in queries if q not in ket_qua.values]
        if thieu:
            raise TrendsError(
                f"Google Trends không trả về dữ liệu cho: {', '.join(thieu)}. "
                "Thường là do từ khoá quá hiếm — sửa 'query' trong benchmark-brands.json."
            )

        if weeks is None:
            weeks = ket_qua.weeks
        elif ket_qua.weeks != weeks:
            raise TrendsError(
                "Các lượt trả về mốc tuần khác nhau — không ghép được. "
                "Chạy lại toàn bộ trong một phiên thay vì ghép dữ liệu cũ với mới."
            )

        # Đổi khoá từ từ khoá tìm kiếm sang khoá thương hiệu ngay tại đây, để các bước
        # sau không phải biết gì về chuyện từ khoá được đặt thế nào.
        theo_lo.append({k: ket_qua.values[config.by_key(k).query] for k in lo})

    if weeks is None:
        raise TrendsError("Không lượt nào trả về dữ liệu.")

    interest = rescale_to_anchor(theo_lo, config.anchor)
    return weeks, interest, compute_shares(interest)
