"""
Chấm sắc thái tiếng Việt cho dữ liệu đã thu về.

    uv run python -m nlp model                      # model và kho đang cấu hình
    uv run python -m nlp cham                       # chấm cả hai kho
    uv run python -m nlp cham --kho social          # chỉ một kho
    uv run python -m nlp cham --gioi-han 20         # chạy thử 20 bản ghi
    uv run python -m nlp thu --text "câu cần thử"   # chấm một câu, không ghi kho
    uv run python -m nlp thong-ke                   # phân bố sắc thái trong kho

Hai kho, hai model, ghép cứng với nhau:

    social  ViSoBERT  bình luận và bài đăng mạng xã hội (teencode, không dấu, emoji)
    news    PhoBERT   tin bài báo chí, văn phong chuẩn

Chạy trên CPU, không cần GPU. Lần đầu sẽ tải model về (~1,4GB cho cả hai); các lần sau
đọc từ thư mục cache nên chạy được offline.
"""

from __future__ import annotations

import argparse
import sys

from crawler.settings import CrawlerError, StoreSettings

from .settings import (
    CHI_DUNG_FILE_CUC_BO,
    CORPUS,
    DO_DAI_TOI_THIEU,
    KICH_THUOC_LO,
    THU_MUC_MODEL,
    Corpus,
    corpus_theo_ma,
)


def _kho_can_chay(ten: str | None) -> list[Corpus]:
    return [corpus_theo_ma(ten)] if ten else [CORPUS[k] for k in sorted(CORPUS)]


def _in_model() -> None:
    print("Kho văn bản và model tương ứng:\n")
    for ma in sorted(CORPUS):
        c = CORPUS[ma]
        da_tai = "đã tải" if _da_tai(c.model.repo) else "CHƯA TẢI"
        print(f"  {ma:<8} → {c.model.ma:<16} {da_tai}")
        print(f"  {'':<8}   {c.mo_ta}")
        print(f"  {'':<8}   bảng thô {c.bang_tho} → bảng điểm {c.bang_diem}")
        print(f"  {'':<8}   {c.model.repo}, cắt ở {c.model.max_tokens} token\n")

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


def _thu_mot_cau(ma_kho: str, text: str) -> None:
    """Chấm một câu và in đủ ba điểm. Không ghi kho — dùng để kiểm tra model, hoặc để
    người duyệt hồ sơ nghiệm thu tự thử vài câu xem hệ thống chấm có hợp lý không."""
    from .model import BoChamSacThai

    corpus = corpus_theo_ma(ma_kho)
    bo_cham = BoChamSacThai(corpus.model)
    kq = bo_cham.cham([text])[0]

    nhan_viet = {"positive": "tích cực", "neutral": "trung tính", "negative": "tiêu cực"}
    print(f"Kho       : {corpus.ma} ({corpus.mo_ta})")
    print(f"Model     : {bo_cham.model_version}")
    print(f"Câu       : {text}")
    print(f"Kết luận  : {nhan_viet.get(kq.label, kq.label)} ({kq.confidence:.1%})")
    for ten, gia_tri in (
        ("tích cực", kq.positive),
        ("trung tính", kq.neutral),
        ("tiêu cực", kq.negative),
    ):
        print(f"  {ten:<11} {gia_tri:.4f}")
    if kq.truncated:
        print("  (câu bị cắt vì vượt giới hạn token)")


def _in_thong_ke(ten_kho: str | None) -> None:
    from .model import BoChamSacThai
    from .storage import open_store

    nhan_viet = {"positive": "tích cực", "neutral": "trung tính", "negative": "tiêu cực"}

    for corpus in _kho_can_chay(ten_kho):
        bo_cham = BoChamSacThai(corpus.model)
        store = open_store(corpus)
        try:
            tong = store.count(bo_cham.model_version)
            print(f"\nKho {corpus.ma} · {bo_cham.model_version}")
            print(f"  Số bản ghi đã chấm: {tong}")
            if tong == 0:
                print(f"  Chưa chấm gì — chạy `uv run python -m nlp cham --kho {corpus.ma}`.")
                continue
            for nhan, so in store.phan_bo(bo_cham.model_version):
                print(f"    {nhan_viet.get(nhan, nhan):<12} {so:>5}  {so / tong * 100:5.1f}%")
        finally:
            store.close()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="nlp", description="Chấm sắc thái tiếng Việt cho dữ liệu đã thu về"
    )
    parser.add_argument(
        "--kho",
        default=None,
        choices=sorted(CORPUS),
        help="Chỉ làm việc với một kho. Để trống thì làm cả hai.",
    )
    sub = parser.add_subparsers(dest="lenh", required=True)

    sub.add_parser("model", help="Liệt kê kho, model tương ứng và trạng thái tải")
    sub.add_parser("thong-ke", help="Phân bố sắc thái trong kho")

    p_cham = sub.add_parser("cham", help="Chấm phần chưa chấm và ghi vào kho")
    p_cham.add_argument(
        "--gioi-han",
        type=int,
        default=None,
        metavar="N",
        help="Chỉ chấm tối đa N bản ghi mỗi kho. Dùng để chạy thử.",
    )

    p_thu = sub.add_parser("thu", help="Chấm một câu, in đủ ba điểm, không ghi kho")
    p_thu.add_argument("--text", required=True, help="Câu cần chấm")

    args = parser.parse_args(argv)

    try:
        if args.lenh == "model":
            _in_model()
        elif args.lenh == "thong-ke":
            _in_thong_ke(args.kho)
        elif args.lenh == "thu":
            # Chấm thử một câu thì phải biết dùng model nào. Không đoán: mặc định là kho
            # mạng xã hội vì đó là loại văn bản người dùng hay dán vào để thử.
            _thu_mot_cau(args.kho or "social", args.text)
        elif args.lenh == "cham":
            from . import score

            for corpus in _kho_can_chay(args.kho):
                stats = score.run(corpus, gioi_han=args.gioi_han)
                score.in_tong_ket(stats)
    except CrawlerError as loi:
        print(f"Lỗi: {loi}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
