"""Quét trang công khai của nhóm trường đối sánh và ghi danh mục tài liệu vào kho.

Tách khỏi `edu_docs.py` để phần bóc tách và phân loại ở đó test được ngoại tuyến.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import requests

from .edu_docs import DiscoveredDocument, collect_documents
from .edu_docs_store import DocumentRow, now, open_store
from .extract import duoc_phep_tai
from .net import get
from .settings import CONFIG_DIR, CrawlerError

DISCLOSURE_SOURCES_PATH = CONFIG_DIR / "disclosure-sources.json"


@dataclass(frozen=True)
class Seed:
    kind: str
    url: str
    note: str = ""


@dataclass(frozen=True)
class School:
    key: str
    label: str
    seeds: list[Seed]
    note: str = ""


@dataclass(frozen=True)
class DisclosureSources:
    max_followed_pages_per_seed: int
    schools: list[School]

    @classmethod
    def load(cls, path: Path | None = None) -> DisclosureSources:
        duong_dan = path or DISCLOSURE_SOURCES_PATH
        if not duong_dan.exists():
            raise CrawlerError(f"Không tìm thấy {duong_dan}")

        try:
            du_lieu: dict[str, Any] = json.loads(duong_dan.read_text(encoding="utf-8"))
        except json.JSONDecodeError as loi:
            raise CrawlerError(f"{duong_dan} không phải JSON hợp lệ: {loi}") from loi

        schools = [
            School(
                key=str(m["key"]).strip(),
                label=str(m["label"]).strip(),
                note=str(m.get("note", "")).strip(),
                seeds=[
                    Seed(
                        kind=str(s.get("kind", "khac")).strip(),
                        url=str(s["url"]).strip(),
                        note=str(s.get("note", "")).strip(),
                    )
                    for s in m.get("seeds", [])
                ],
            )
            for m in du_lieu.get("schools", [])
        ]

        if not schools:
            raise CrawlerError(f"{duong_dan} không khai trường nào.")

        khoa = [s.key for s in schools]
        if len(set(khoa)) != len(khoa):
            raise CrawlerError(f"{duong_dan}: có trường bị trùng key.")

        return cls(
            max_followed_pages_per_seed=max(
                0, int(du_lieu.get("max_followed_pages_per_seed", 25))
            ),
            schools=schools,
        )


@dataclass
class CrawlStats:
    trang_da_tai: int = 0
    trang_bi_chan: int = 0
    trang_loi: int = 0
    tai_lieu: dict[str, list[DiscoveredDocument]] = field(default_factory=dict)
    truong_khong_co_nguon: list[str] = field(default_factory=list)


def _tai_trang(url: str) -> str | None:
    """Tải một trang HTML. Trả về None nếu bị robots.txt chặn hoặc lỗi mạng."""
    if not duoc_phep_tai(url):
        return None
    try:
        phan_hoi = get(url, accept="text/html,application/xhtml+xml")
        if phan_hoi.status_code != 200:
            return None
        return phan_hoi.text
    except requests.RequestException:
        return None


def quet(sources: DisclosureSources | None = None) -> CrawlStats:
    """Quét toàn bộ nguồn đã khai. Một trang hỏng không làm dừng cả mẻ."""
    sources = sources or DisclosureSources.load()
    stats = CrawlStats()

    for school in sources.schools:
        if not school.seeds:
            stats.truong_khong_co_nguon.append(school.key)
            continue

        tim_duoc: dict[str, DiscoveredDocument] = {}

        for seed in school.seeds:
            print(f"  {school.key} · {seed.url}")

            trang = _tai_trang(seed.url)
            if trang is None:
                stats.trang_loi += 1
                print("    ! không tải được trang gốc")
                continue
            stats.trang_da_tai += 1

            tai_lieu, dang_theo = collect_documents(school.key, seed.url, seed.url, trang)
            for doc in tai_lieu:
                tim_duoc[doc.url] = doc

            # Đi sâu đúng một tầng: trang danh mục của PTIT và UIT đặt tệp đính kèm
            # trong từng bài, không đặt ngay trên trang danh mục.
            da_theo = 0
            da_xem: set[str] = {seed.url}
            for link in dang_theo:
                if da_theo >= sources.max_followed_pages_per_seed:
                    print(
                        f"    ! đã chạm trần {sources.max_followed_pages_per_seed} trang con, "
                        f"còn {len(dang_theo) - da_theo} liên kết chưa mở"
                    )
                    break
                if link.url in da_xem:
                    continue
                da_xem.add(link.url)

                trang_con = _tai_trang(link.url)
                da_theo += 1
                if trang_con is None:
                    stats.trang_loi += 1
                    continue
                stats.trang_da_tai += 1

                sau, _ = collect_documents(school.key, seed.url, link.url, trang_con)
                for doc in sau:
                    tim_duoc[doc.url] = doc

            print(f"    → {len(tim_duoc)} tài liệu (đã mở {da_theo} trang con)")

        if tim_duoc:
            stats.tai_lieu[school.key] = list(tim_duoc.values())

    return stats


def run() -> None:
    sources = DisclosureSources.load()
    print(
        f"Quét tài liệu công khai · {len(sources.schools)} trường · "
        f"trần {sources.max_followed_pages_per_seed} trang con mỗi nguồn\n"
    )

    stats = quet(sources)
    thoi_diem = now()

    rows = [
        DocumentRow(
            doc_url=doc.url,
            school_key=doc.school_key,
            title=doc.title[:500],
            kind=doc.kind,
            year=doc.year,
            seed_url=doc.seed_url,
            first_seen_at=thoi_diem,
            last_seen_at=thoi_diem,
        )
        for danh_sach in stats.tai_lieu.values()
        for doc in danh_sach
    ]

    store = open_store()
    try:
        store.upsert(rows)
        tong = store.count()
    finally:
        store.close()

    print(f"\nĐã tải {stats.trang_da_tai} trang, {stats.trang_loi} trang lỗi hoặc bị chặn.")
    print(f"Ghi {len(rows)} tài liệu. Tổng trong kho: {tong}.")

    if stats.truong_khong_co_nguon:
        print(
            "\n! Chưa khai nguồn cho: "
            + ", ".join(stats.truong_khong_co_nguon)
            + " — mẫu số của mọi chỉ số thị phần đang thiếu các trường này."
        )


def in_thong_ke() -> None:
    store = open_store()
    try:
        tong = store.count()
        print(f"Tổng số tài liệu trong kho: {tong}")
        if tong == 0:
            print("Kho rỗng — chạy `uv run python -m crawler cong-khai` trước.")
            return

        from .edu_docs import DOCUMENT_KIND_LABELS

        print("\nTheo trường:")
        for khoa, so in store.group_count("school_key"):
            print(f"  {khoa:<10} {so:>4}")

        print("\nTheo loại tài liệu:")
        for khoa, so in store.group_count("kind"):
            print(f"  {DOCUMENT_KIND_LABELS.get(khoa, khoa):<45} {so:>4}")

        print("\nTheo năm:")
        for khoa, so in store.group_count("year"):
            print(f"  {khoa:<10} {so:>4}")
    finally:
        store.close()
