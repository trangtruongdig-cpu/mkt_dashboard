"""Kiểm tra phần chấm sắc thái. Không nạp model, không gọi mạng.

Trọng tâm là chỗ dễ sai nhất và không có triệu chứng khi sai: quy đổi bảng nhãn của model.
Cả ViSoBERT lẫn PhoBERT-sentiment đều khai `{0: NEG, 1: POS, 2: NEU}` — POS ở giữa. Mã nào
giả định thứ tự âm→trung→dương sẽ đảo ngược kết quả mà mọi test khác vẫn xanh.
"""

from __future__ import annotations

from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from crawler.settings import StoreSettings
from nlp.model import NEGATIVE, NEUTRAL, POSITIVE, doc_bang_nhan
from nlp.settings import CORPUS, MODELS, SOCIAL, NlpError, corpus_theo_ma, model_theo_ma
from nlp.storage import DiemSacThai, DuckDbStore

THOI_DIEM = datetime(2026, 7, 28, 6, 0, tzinfo=UTC)
SAU_MOT_THANG = THOI_DIEM + timedelta(days=30)


# --- Quy đổi bảng nhãn --------------------------------------------------------


def test_doc_dung_thu_tu_nhan_that_cua_visobert() -> None:
    """Thứ tự thật của ViSoBERT: POS nằm ở chỉ số 1, NEU ở chỉ số 2."""
    assert doc_bang_nhan({0: "NEG", 1: "POS", 2: "NEU"}, "thu") == {
        0: NEGATIVE,
        1: POSITIVE,
        2: NEUTRAL,
    }


def test_khong_gia_dinh_thu_tu_am_trung_duong() -> None:
    """Model khác đặt thứ tự khác — bảng nhãn phải đi theo model, không theo quy ước."""
    assert doc_bang_nhan({0: "negative", 1: "neutral", 2: "positive"}, "thu") == {
        0: NEGATIVE,
        1: NEUTRAL,
        2: POSITIVE,
    }


def test_chap_nhan_nhan_viet_hoa_va_khoang_trang() -> None:
    assert doc_bang_nhan({0: " Neg ", 1: "POS", 2: "neu"}, "thu")[0] == NEGATIVE


def test_nhan_la_thi_dung_han_chu_khong_doan() -> None:
    """Đoán bừa một nhãn lạ là cách sinh ra báo cáo sai mà không ai phát hiện."""
    with pytest.raises(NlpError, match="nhãn lạ"):
        doc_bang_nhan({0: "NEG", 1: "POS", 2: "MIXED"}, "thu")


def test_thieu_mot_nhan_thi_dung() -> None:
    """Model hai lớp không dùng được cho báo cáo ba mức sắc thái."""
    with pytest.raises(NlpError, match="không đủ ba nhãn"):
        doc_bang_nhan({0: "NEG", 1: "POS"}, "thu")


# --- Cấu hình model -----------------------------------------------------------


def test_hai_model_cho_hai_loai_van_ban() -> None:
    """Bình luận mạng xã hội và tin bài báo chí dùng model khác nhau, có chủ đích."""
    assert set(MODELS) == {"visobert-social", "phobert-news"}
    assert MODELS["visobert-social"].repo != MODELS["phobert-news"].repo


def test_moi_kho_ghep_cung_voi_dung_model() -> None:
    """Ghép cứng kho với model để không ai lỡ tay chấm bình luận YouTube bằng PhoBERT:
    chọn nhầm không báo lỗi, chỉ cho ra điểm sai một cách im lặng."""
    assert CORPUS["social"].model.ma == "visobert-social"
    assert CORPUS["news"].model.ma == "phobert-news"


def test_hai_kho_ghi_vao_hai_bang_khac_nhau() -> None:
    """Chung bảng thì điểm của hai model đè lên nhau qua khoá (mention_key, model_version)
    chỉ khi trùng mention_key — mà hai kho dùng hai không gian khoá khác nhau."""
    assert CORPUS["social"].bang_diem != CORPUS["news"].bang_diem


def test_kho_la_thi_bao_loi_ro_rang() -> None:
    with pytest.raises(NlpError, match="Hiện có"):
        corpus_theo_ma("khong-co-kho-nay")


def test_ma_model_la_thi_bao_loi_ro_rang() -> None:
    with pytest.raises(NlpError, match="Hiện có"):
        model_theo_ma("khong-co-model-nay")


# --- Bảng điểm ----------------------------------------------------------------


@pytest.fixture
def store(tmp_path: Path) -> Iterator[DuckDbStore]:
    settings = StoreSettings(
        kind="duckdb",
        duckdb_path=tmp_path / "test.duckdb",
        postgres_host="",
        postgres_port=5432,
        postgres_db="",
        postgres_user="",
        postgres_password="",
        schema_name="social_raw",
    )
    kho = DuckDbStore(settings, SOCIAL)
    yield kho
    kho.close()


def diem(**ghi_de: object) -> DiemSacThai:
    mac_dinh: dict[str, object] = {
        "mention_key": "khoa-1",
        "model_version": "visobert@aaaaaaa",
        "label": "negative",
        "score_positive": 0.01,
        "score_neutral": 0.02,
        "score_negative": 0.97,
        "confidence": 0.97,
        "text_chars": 58,
        "truncated": False,
        "scored_at": THOI_DIEM,
    }
    return DiemSacThai(**{**mac_dinh, **ghi_de})  # type: ignore[arg-type]


def test_doi_model_thi_giu_ca_diem_cu_lan_diem_moi(store: DuckDbStore) -> None:
    """Mục 6 CLAUDE.md: phải truy được điểm nào do phiên bản model nào sinh ra.

    Khoá chính là CẶP (mention_key, model_version). Nếu chỉ khoá theo mention_key thì nâng
    cấp model là xoá sạch lịch sử điểm cũ, và không còn cách nào giải thích vì sao biểu đồ
    sắc thái đổi hình sau lần nâng cấp đó.
    """
    store.upsert([diem(model_version="visobert@cu", label="negative")])
    store.upsert([diem(model_version="visobert@moi", label="neutral")])

    assert store.count() == 2
    assert store.count("visobert@cu") == 1
    assert store.phan_bo("visobert@cu") == [("negative", 1)]
    assert store.phan_bo("visobert@moi") == [("neutral", 1)]


def test_cham_lai_cung_phien_ban_thi_ghi_de(store: DuckDbStore) -> None:
    """Mẻ trước chết giữa chừng thì chạy lại phải liền, không sinh dòng thứ hai."""
    store.upsert([diem(confidence=0.90)])
    store.upsert([diem(confidence=0.97, scored_at=SAU_MOT_THANG)])

    assert store.count() == 1
    kq = store._con.execute(f"SELECT confidence, scored_at FROM {SOCIAL.bang_diem}").fetchone()
    assert kq is not None
    assert kq[0] == pytest.approx(0.97)
    assert kq[1] == SAU_MOT_THANG


def test_giu_du_ba_diem_chu_khong_chi_nhan_thang(store: DuckDbStore) -> None:
    """Chỉ lưu nhãn thắng là mất thông tin: một câu 0.34/0.33/0.33 và một câu 0.99/0.01/0.00
    đều ra 'tích cực', nhưng mức độ chắc chắn khác hẳn nhau."""
    store.upsert([diem(score_positive=0.34, score_neutral=0.33, score_negative=0.33)])
    kq = store._con.execute(
        f"SELECT score_positive, score_neutral, score_negative FROM {SOCIAL.bang_diem}"
    ).fetchone()
    assert kq is not None
    assert sum(kq) == pytest.approx(1.0)


def test_danh_dau_ban_ghi_bi_cat(store: DuckDbStore) -> None:
    """`truncation=True` cắt lặng lẽ. Không đánh dấu thì về sau không biết điểm của một bài
    dài là chấm trên toàn bài hay chỉ trên đoạn đầu."""
    store.upsert([diem(truncated=True, text_chars=4200)])
    kq = store._con.execute(f"SELECT truncated, text_chars FROM {SOCIAL.bang_diem}").fetchone()
    assert kq == (True, 4200)


def test_kho_rong_thi_dem_ra_khong(store: DuckDbStore) -> None:
    assert store.count() == 0
    assert store.phan_bo("bat-ky") == []
