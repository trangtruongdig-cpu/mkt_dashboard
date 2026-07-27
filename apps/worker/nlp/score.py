"""Luồng chạy chính: đọc bản ghi chưa chấm → chấm theo lô → ghi bảng điểm.

Hạt nào được chấm, và vì sao:

  comment · post · thread   CÓ. Đây là ý kiến của người thật về Học viện.
  video                     KHÔNG. Tiêu đề và mô tả video là lời giới thiệu của người làm
                            nội dung, không phải dư luận. Chấm chúng rồi gộp vào biểu đồ
                            sắc thái là trộn thông điệp truyền thông vào tiếng nói công chúng
                            — đúng lỗi mà cột `is_owned` sinh ra để tránh.

Bản ghi `is_owned` VẪN được chấm chứ không loại ở đây: "nội dung Học viện tự đăng đang mang
sắc thái gì" là câu hỏi có ích riêng của nó. Việc tách hai nhóm khi lên báo cáo là của dbt,
và dbt cần cả hai nhóm mới tách được.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from .model import BoChamSacThai
from .settings import DO_DAI_TOI_THIEU, KICH_THUOC_LO, ModelSacThai
from .storage import DiemSacThai, Store, now, open_store

# Hạt dữ liệu mang ý kiến của người ngoài. Xem phần đầu file.
HAT_Y_KIEN = ("comment", "post", "thread")


@dataclass
class Stats:
    """Số liệu một lần chạy."""

    model_version: str = ""
    can_cham: int = 0
    da_cham: int = 0
    phan_bo: dict[str, int] = field(default_factory=dict)
    bi_cat: int = 0
    tong_trong_kho: int = 0


def run(
    cau_hinh: ModelSacThai,
    gioi_han: int | None = None,
    store: Store | None = None,
    bo_cham: BoChamSacThai | None = None,
) -> Stats:
    """Chấm một mẻ.

    `gioi_han` để chạy thử trên vài chục bản ghi trước khi thả cả kho vào model.
    """
    bo_cham = bo_cham or BoChamSacThai(cau_hinh)
    stats = Stats(model_version=bo_cham.model_version)

    tu_dong: Store = store or open_store()
    try:
        can_cham = tu_dong.can_cham(bo_cham.model_version, HAT_Y_KIEN, DO_DAI_TOI_THIEU)
        if gioi_han is not None:
            can_cham = can_cham[:gioi_han]
        stats.can_cham = len(can_cham)

        if not can_cham:
            stats.tong_trong_kho = tu_dong.count(bo_cham.model_version)
            return stats

        print(f"Chấm {len(can_cham)} bản ghi bằng {bo_cham.model_version}")

        for dau in range(0, len(can_cham), KICH_THUOC_LO):
            lo = can_cham[dau : dau + KICH_THUOC_LO]
            ket_qua = bo_cham.cham([van_ban for _, van_ban in lo])
            thoi_diem = now()

            tu_dong.upsert(
                [
                    DiemSacThai(
                        mention_key=khoa,
                        model_version=bo_cham.model_version,
                        label=kq.label,
                        score_positive=kq.positive,
                        score_neutral=kq.neutral,
                        score_negative=kq.negative,
                        confidence=kq.confidence,
                        text_chars=len(van_ban),
                        truncated=kq.truncated,
                        scored_at=thoi_diem,
                    )
                    for (khoa, van_ban), kq in zip(lo, ket_qua, strict=True)
                ]
            )

            for kq in ket_qua:
                stats.phan_bo[kq.label] = stats.phan_bo.get(kq.label, 0) + 1
                stats.bi_cat += int(kq.truncated)
            stats.da_cham += len(lo)

            print(f"  {stats.da_cham:>5}/{len(can_cham)}", end="\r", flush=True)

        print()
        stats.tong_trong_kho = tu_dong.count(bo_cham.model_version)
    finally:
        if store is None:
            tu_dong.close()

    return stats


def in_tong_ket(stats: Stats) -> None:
    print("\n" + "─" * 70)
    print(f"Model            : {stats.model_version}")
    print(f"Cần chấm         : {stats.can_cham}")
    print(f"Đã chấm mẻ này   : {stats.da_cham}")

    if stats.da_cham:
        print("\nPhân bố sắc thái mẻ này:")
        nhan_viet = {"positive": "tích cực", "neutral": "trung tính", "negative": "tiêu cực"}
        for nhan, so in sorted(stats.phan_bo.items(), key=lambda x: -x[1]):
            ty_le = so / stats.da_cham * 100
            print(f"  {nhan_viet.get(nhan, nhan):<12} {so:>5}  {ty_le:5.1f}%")

    if stats.bi_cat:
        print(f"\nBị cắt vì quá dài: {stats.bi_cat} (cột `truncated` đánh dấu để kiểm chứng lại)")

    print(f"\nTổng đã chấm bằng model này: {stats.tong_trong_kho}")
    if stats.can_cham == 0:
        print("Không có gì mới để chấm — mọi bản ghi đã có điểm của phiên bản model này.")
