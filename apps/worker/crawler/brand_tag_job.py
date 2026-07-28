"""Gán nhãn thương hiệu cho tin bài đã có trong kho.

Chạy sau mỗi lần `thu-thap`. Tách thành bước riêng chứ không gắn vào lúc thu thập vì
hai lý do: đổi bộ từ khoá là phải gán lại TOÀN BỘ kho chứ không chỉ bài mới, và gán
nhãn không cần mạng nên chạy lại bao nhiêu lần cũng rẻ.

Cột `brands` là chuỗi JSON danh sách khoá thương hiệu. Một bài nhắc nhiều trường thì
có nhiều nhãn — dbt sẽ trải ra để tính thị phần.
"""

from __future__ import annotations

import json
from typing import Any

from .brands import BrandMatchers, tag_brands
from .settings import StoreSettings
from .storage import TABLE

# Thêm cột vào bảng đã tồn tại ở các máy chạy bản trước. DuckDB và PostgreSQL đều hiểu.
MIGRATION = "ALTER TABLE {table} ADD COLUMN IF NOT EXISTS brands TEXT"


def _mo_ket_noi() -> tuple[Any, str, str]:
    """Kết nối thẳng tới kho thay vì mượn `Store`.

    `Store` chỉ khai những thao tác mà bước thu thập cần; bước gán nhãn phải UPDATE
    theo từng dòng. Mở kết nối riêng ở đây đúng hơn là chọc vào thuộc tính nội bộ của
    lớp khác — và không phải sửa giao diện dùng chung chỉ vì một job.
    """
    settings = StoreSettings.from_env()
    if settings.kind != "duckdb":  # pragma: no cover — chỉ dùng khi đã dựng PostgreSQL
        import psycopg

        con: Any = psycopg.connect(
            host=settings.postgres_host,
            port=settings.postgres_port,
            dbname=settings.postgres_db,
            user=settings.postgres_user,
            password=settings.postgres_password,
        )
        return con, f"{settings.schema_name}.{TABLE}", "%s"

    import duckdb

    return duckdb.connect(str(settings.duckdb_path)), TABLE, "?"


def run() -> None:
    matchers = BrandMatchers.load()
    print(
        f"Gán nhãn theo {len(matchers.brands)} thương hiệu: "
        f"{', '.join(b.key for b in matchers.brands)}\n"
    )

    con, bang, ph = _mo_ket_noi()
    try:
        con.execute(MIGRATION.format(table=bang))

        dong = con.execute(f"SELECT mention_key, title, body_text FROM {bang}").fetchall()  # noqa: S608

        thong_ke: dict[str, int] = {b.key: 0 for b in matchers.brands}
        khong_nhan = 0

        for khoa, tieu_de, than_bai in dong:
            nhan = tag_brands(f"{tieu_de or ''}\n{than_bai or ''}", matchers)
            con.execute(
                f"UPDATE {bang} SET brands = {ph} WHERE mention_key = {ph}",  # noqa: S608
                [json.dumps(nhan, ensure_ascii=False), khoa],
            )
            if not nhan:
                khong_nhan += 1
            for k in nhan:
                thong_ke[k] += 1

        con.commit()
    finally:
        con.close()

    print(f"Đã gán nhãn {len(dong)} bài.\n")
    tong = sum(thong_ke.values())
    for brand in matchers.brands:
        so = thong_ke[brand.key]
        ty_le = f"{so / tong * 100:5.1f}%" if tong else "    —"
        danh_dau = "◆" if brand.key == "ptit" else " "
        print(f"  {danh_dau} {brand.label[:44]:<44} {so:>4} bài  {ty_le}")

    if khong_nhan:
        print(
            f"\n! {khong_nhan} bài không khớp thương hiệu nào — lọt vào kho qua từ khoá "
            "tìm kiếm nhưng nội dung không nhắc trường nào trong nhóm."
        )
    print(
        "\nLưu ý: tổng số nhãn lớn hơn số bài vì một bài so sánh có thể nhắc nhiều trường."
    )
