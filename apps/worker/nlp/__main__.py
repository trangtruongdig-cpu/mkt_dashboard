"""
Chấm sắc thái tiếng Việt cho dữ liệu đã thu về.

    uv run python -m nlp model                    # model đang cấu hình
    uv run python -m nlp cham                     # chấm phần chưa chấm
    uv run python -m nlp cham --gioi-han 20       # chạy thử 20 bản ghi
    uv run python -m nlp thu --text "câu cần thử" # chấm một câu, không ghi kho
    uv run python -m nlp thong-ke                 # phân bố sắc thái trong kho

Chạy trên CPU, không cần GPU. Lần đầu sẽ tải model về (~500MB); các lần sau đọc từ
thư mục cache nên chạy được offline.
"""

from __future__ import annotations

import argparse
import sys

from crawler.settings import CrawlerError, StoreSettings

from .settings import (
    CHI_DUNG_FILE_CUC_BO,
    DO_DAI_TOI_THIEU,
    KICH_THUOC_LO,
    MODELS,
    THU_MUC_MODEL,
    VISOBERT,
    model_theo_ma,
)


def _in_model() -> None:
    print("Model chấm sắc thái đang khai báo:\n")
    for ma, m in MODELS.items():
        da_tai = "đã tải" if _da_tai(m.repo) else "chưa tải"
        print(f"  {ma:<18} {da_tai:<9} {m.repo}")
        print(f"  {'':<18} {'':<9} {m.mo_ta}")
        print(f"  {'':<18} {'':<9} cắt ở {m.max_tokens} token\n")

    print(f"Thư mục model     : {THU_MUC_MODEL}")
    print(f"Chỉ dùng file cục bộ: {'có (offline)' if CHI_DUNG_FILE_CUC_BO else 'không'}")
    print(f"Kích thước lô     : {KICH_THUOC_LO}")
    print(f"Bỏ qua văn bản ngắn hơn: {DO_DAI_TOI_THIEU} ký tự")

    store = StoreSettings.from_env()
    dich = (
        store.duckdb_path
        if store.kind == "duckdb"
        else f"{store.postgres_host}/{store.postgres_db}"
    )
    print(f"Kho               : {store.kind} → {dich}")


def _da_tai(repo: str) -> bool:
    """Trọng số đã nằm trong thư mục cache chưa. Đoán theo quy ước đặt tên của HuggingFace."""
    thu_muc = THU_MUC_MODEL / f"models--{repo.replace('/', '--')}"
    return thu_muc.exists()


def _thu_mot_cau(ma_model: str, text: str) -> None:
    """Chấm một câu và in đủ ba điểm. Không ghi kho — dùng để kiểm tra model, hoặc để
    người duyệt hồ sơ nghiệm thu tự thử vài câu xem hệ thống chấm có hợp lý không."""
    from .model import BoChamSacThai

    bo_cham = BoChamSacThai(model_theo_ma(ma_model))
    kq = bo_cham.cham([text])[0]

    nhan_viet = {"positive": "tích cực", "neutral": "trung tính", "negative": "tiêu cực"}
    print(f"Model     : {bo_cham.model_version}")
    print(f"Câu       : {text}")
    print(f"Kết luận  : {nhan_viet.get(kq.label, kq.label)} ({kq.confidence:.1%})")
    print(f"  tích cực  {kq.positive:.4f}")
    print(f"  trung tính{kq.neutral:.4f}")
    print(f"  tiêu cực  {kq.negative:.4f}")
    if kq.truncated:
        print("  (câu bị cắt vì vượt giới hạn token)")


def _in_thong_ke(ma_model: str) -> None:
    from .model import BoChamSacThai
    from .storage import open_store

    bo_cham = BoChamSacThai(model_theo_ma(ma_model))
    store = open_store()
    try:
        tong = store.count(bo_cham.model_version)
        print(f"Model: {bo_cham.model_version}")
        print(f"Số bản ghi đã chấm: {tong}")
        if tong == 0:
            print("Chưa chấm gì — chạy `uv run python -m nlp cham` trước.")
            return

        nhan_viet = {"positive": "tích cực", "neutral": "trung tính", "negative": "tiêu cực"}
        print("\nPhân bố sắc thái:")
        for nhan, so in store.phan_bo(bo_cham.model_version):
            print(f"  {nhan_viet.get(nhan, nhan):<12} {so:>5}  {so / tong * 100:5.1f}%")
    finally:
        store.close()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="nlp", description="Chấm sắc thái tiếng Việt cho dữ liệu đã thu về"
    )
    parser.add_argument(
        "--model",
        default=VISOBERT.ma,
        choices=sorted(MODELS),
        help=f"Model dùng để chấm. Mặc định {VISOBERT.ma} (bình luận mạng xã hội).",
    )
    sub = parser.add_subparsers(dest="lenh", required=True)

    sub.add_parser("model", help="Liệt kê model đang khai báo và trạng thái tải")
    sub.add_parser("thong-ke", help="Phân bố sắc thái trong kho")

    p_cham = sub.add_parser("cham", help="Chấm phần chưa chấm và ghi vào kho")
    p_cham.add_argument(
        "--gioi-han",
        type=int,
        default=None,
        metavar="N",
        help="Chỉ chấm tối đa N bản ghi. Dùng để chạy thử.",
    )

    p_thu = sub.add_parser("thu", help="Chấm một câu, in đủ ba điểm, không ghi kho")
    p_thu.add_argument("--text", required=True, help="Câu cần chấm")

    args = parser.parse_args(argv)

    try:
        if args.lenh == "model":
            _in_model()
        elif args.lenh == "thong-ke":
            _in_thong_ke(args.model)
        elif args.lenh == "thu":
            _thu_mot_cau(args.model, args.text)
        elif args.lenh == "cham":
            from . import score

            stats = score.run(model_theo_ma(args.model), gioi_han=args.gioi_han)
            score.in_tong_ket(stats)
    except CrawlerError as loi:
        print(f"Lỗi: {loi}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
