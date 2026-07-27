"""Nạp model và chấm sắc thái. Đây là nơi duy nhất chạm vào torch/transformers.

Hai điều dễ sai và đã được chặn ở đây:

  1. THỨ TỰ NHÃN. ViSoBERT khai `{0: 'NEG', 1: 'POS', 2: 'NEU'}` — POS nằm giữa, không
     phải theo thứ tự âm→trung→dương như phần lớn model khác. Giả định thứ tự rồi lấy
     `logits[2]` làm điểm tích cực sẽ đảo ngược kết quả mà không hề báo lỗi: báo cáo vẫn
     ra số đẹp, chỉ là sai. Mã dưới đây LUÔN đọc `config.id2label`, không bao giờ đoán.
  2. KHÔNG TÁI LẬP ĐƯỢC. Chạy trên CPU và tắt gradient. Máy chủ Học viện không có GPU;
     dùng MPS trên máy dev Mac sẽ cho số lệch ở hàng thập phân so với lúc nghiệm thu.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .settings import (
    CHI_DUNG_FILE_CUC_BO,
    THU_MUC_MODEL,
    ModelSacThai,
    NlpError,
)

# Nhãn dùng trong kho và trên giao diện. Tiếng Anh để trùng với `SentimentBucketSchema`
# ở packages/shared — backend và frontend đọc chung một bộ tên, không dịch qua lại.
POSITIVE = "positive"
NEUTRAL = "neutral"
NEGATIVE = "negative"

# Model tiếng Việt đặt tên nhãn mỗi nơi một kiểu. Quy về một bộ chuẩn ngay khi nạp model,
# để phần còn lại của hệ thống không phải biết model nào dùng cách viết nào.
QUY_DOI_NHAN = {
    "neg": NEGATIVE,
    "negative": NEGATIVE,
    "tieu_cuc": NEGATIVE,
    "label_0": NEGATIVE,
    "neu": NEUTRAL,
    "neutral": NEUTRAL,
    "trung_tinh": NEUTRAL,
    "pos": POSITIVE,
    "positive": POSITIVE,
    "tich_cuc": POSITIVE,
}


@dataclass(frozen=True)
class KetQua:
    """Điểm sắc thái của một đoạn văn bản."""

    label: str
    positive: float
    neutral: float
    negative: float
    confidence: float
    truncated: bool


class BoChamSacThai:
    """Bọc một model HuggingFace. Nạp một lần, dùng cho cả mẻ.

    Nạp model tốn vài giây và vài trăm MB RAM — tuyệt đối không tạo lại cho từng bản ghi.
    """

    def __init__(self, cau_hinh: ModelSacThai) -> None:
        import torch
        from transformers import AutoModelForSequenceClassification, AutoTokenizer

        self._torch = torch
        self.cau_hinh = cau_hinh

        chung = {
            "cache_dir": str(THU_MUC_MODEL),
            "local_files_only": CHI_DUNG_FILE_CUC_BO,
        }
        try:
            self._tokenizer = AutoTokenizer.from_pretrained(cau_hinh.repo, **chung)
            self._model = AutoModelForSequenceClassification.from_pretrained(cau_hinh.repo, **chung)
        except Exception as loi:  # noqa: BLE001 — transformers ném đủ loại lỗi mạng và file
            raise NlpError(
                f"Không nạp được model {cau_hinh.repo!r}: {type(loi).__name__}: {loi}\n"
                "Tải sẵn về máy: uv run python scripts/download_models.py"
            ) from loi

        self._model.eval()
        self._nhan = self._doc_nhan()

    def _doc_nhan(self) -> dict[int, str]:
        """Đọc bảng nhãn từ chính model, và từ chối chạy nếu không hiểu được nhãn nào.

        Thà dừng còn hơn chấm ra một cột `positive` thật ra đang chứa điểm tiêu cực.
        """
        goc: dict[Any, Any] = dict(self._model.config.id2label)
        nhan: dict[int, str] = {}
        la: list[str] = []

        for i, ten in goc.items():
            chuan = QUY_DOI_NHAN.get(str(ten).strip().lower())
            if chuan is None:
                la.append(str(ten))
            else:
                nhan[int(i)] = chuan

        if la:
            raise NlpError(
                f"Model {self.cau_hinh.repo!r} có nhãn lạ: {', '.join(la)}. "
                "Thêm vào QUY_DOI_NHAN trong nlp/model.py rồi chạy lại — không đoán bừa."
            )
        if set(nhan.values()) != {POSITIVE, NEUTRAL, NEGATIVE}:
            raise NlpError(
                f"Model {self.cau_hinh.repo!r} không đủ ba nhãn: {sorted(set(nhan.values()))}."
            )
        return nhan

    @property
    def model_version(self) -> str:
        """Chuỗi truy vết ghi kèm mọi điểm số. Có bản băm commit thì gắn kèm.

        Cùng một repo trên HuggingFace có thể được tác giả cập nhật trọng số. Không ghi lại
        bản nào thì về sau không giải thích được vì sao điểm của cùng một câu lại đổi.
        """
        ban = getattr(self._model.config, "_commit_hash", None)
        return f"{self.cau_hinh.repo}@{str(ban)[:7]}" if ban else self.cau_hinh.repo

    def cham(self, texts: list[str]) -> list[KetQua]:
        """Chấm một lô văn bản. Trả về đúng thứ tự đã nhận."""
        if not texts:
            return []

        enc = self._tokenizer(
            texts,
            padding=True,
            truncation=True,
            max_length=self.cau_hinh.max_tokens,
            return_tensors="pt",
        )

        with self._torch.no_grad():
            xac_suat = self._torch.softmax(self._model(**enc).logits, dim=-1)

        # Đếm token thật của từng câu để biết câu nào bị cắt. `truncation=True` cắt lặng lẽ,
        # không có cách nào biết sau khi đã cắt.
        do_dai = [len(self._tokenizer.encode(t, truncation=False)) for t in texts]

        ket_qua: list[KetQua] = []
        for dong, so_token in zip(xac_suat, do_dai, strict=True):
            diem = {self._nhan[i]: float(dong[i]) for i in range(len(dong))}
            cao_nhat = max(diem, key=lambda k: diem[k])
            ket_qua.append(
                KetQua(
                    label=cao_nhat,
                    positive=diem[POSITIVE],
                    neutral=diem[NEUTRAL],
                    negative=diem[NEGATIVE],
                    confidence=diem[cao_nhat],
                    truncated=so_token > self.cau_hinh.max_tokens,
                )
            )
        return ket_qua
