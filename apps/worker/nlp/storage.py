"""Bảng điểm sắc thái. Bảng RIÊNG, không đụng vào bảng thô.

Mục 6 CLAUDE.md: "Kết quả sentiment ghi vào bảng riêng kèm model_version và scored_at,
không ghi đè dữ liệu gốc. Phải truy vết được điểm số nào do phiên bản model nào sinh ra."

Khoá chính là CẶP (mention_key, model_version), không phải riêng mention_key. Hệ quả:
chấm lại cùng một bản ghi bằng model mới sinh ra một DÒNG MỚI chứ không đè lên dòng cũ.
Nhờ đó đổi model rồi vẫn so được điểm cũ với điểm mới trên cùng tập dữ liệu — thứ hội đồng
sẽ hỏi khi thấy biểu đồ sắc thái đổi hình sau một lần nâng cấp.

Một lớp kho dùng cho MỌI corpus. Bảng thô nào, bảng điểm nào, lọc gì — tất cả lấy từ
`Corpus`, không hằng hoá trong file này: thêm kho thứ ba chỉ cần khai thêm một Corpus.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, fields
from datetime import UTC, datetime
from typing import Any, Protocol

from crawler.settings import StoreSettings

from .settings import Corpus, NlpError

DDL = """
CREATE TABLE IF NOT EXISTS {table} (
    mention_key   TEXT NOT NULL,
    model_version TEXT NOT NULL,
    label         TEXT NOT NULL,
    score_positive DOUBLE PRECISION NOT NULL,
    score_neutral  DOUBLE PRECISION NOT NULL,
    score_negative DOUBLE PRECISION NOT NULL,
    confidence    DOUBLE PRECISION NOT NULL,
    text_chars    INTEGER NOT NULL,
    truncated     BOOLEAN NOT NULL DEFAULT false,
    scored_at     TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (mention_key, model_version)
)
"""

# Chấm lại cùng một bản ghi bằng CÙNG một phiên bản model thì ghi đè — trường hợp này chỉ
# xảy ra khi mẻ trước chết giữa chừng, và kết quả phải giống hệt nhau nên ghi đè là an toàn.
UPSERT = """
INSERT INTO {table} (
    mention_key, model_version, label, score_positive, score_neutral, score_negative,
    confidence, text_chars, truncated, scored_at
) VALUES ({ph})
ON CONFLICT (mention_key, model_version) DO UPDATE SET
    label          = EXCLUDED.label,
    score_positive = EXCLUDED.score_positive,
    score_neutral  = EXCLUDED.score_neutral,
    score_negative = EXCLUDED.score_negative,
    confidence     = EXCLUDED.confidence,
    text_chars     = EXCLUDED.text_chars,
    truncated      = EXCLUDED.truncated,
    scored_at      = EXCLUDED.scored_at
"""

# Lấy các bản ghi CHƯA được model này chấm. Đây là chỗ làm nên tính idempotent: chạy lại
# job chỉ chấm phần mới, không tính lại từ đầu — chấm 200 bình luận mất vài giây, chấm lại
# toàn bộ kho sau vài tháng thì mất hàng giờ.
CAN_CHAM = """
SELECT m.{cot_khoa}, {bieu_thuc_van_ban}
FROM {bang_tho} m
LEFT JOIN {bang_diem} s
       ON s.mention_key = m.{cot_khoa} AND s.model_version = {ph}
WHERE s.mention_key IS NULL
  AND ({dieu_kien})
  AND length({bieu_thuc_van_ban}) >= {ph}
ORDER BY m.{cot_khoa}
"""


@dataclass
class DiemSacThai:
    """Một dòng của bảng điểm. Thứ tự trường khớp đúng thứ tự cột trong câu INSERT."""

    mention_key: str
    model_version: str
    label: str
    score_positive: float
    score_neutral: float
    score_negative: float
    confidence: float
    # Số ký tự của văn bản đã đưa vào model. Cùng với `truncated`, đây là thứ giải thích
    # được vì sao một bản ghi dài lại có điểm trông như của đoạn đầu.
    text_chars: int
    truncated: bool
    scored_at: datetime

    def as_row(self) -> tuple[Any, ...]:
        return tuple(asdict(self).values())


def _placeholders(ky_hieu: str) -> str:
    return ", ".join([ky_hieu] * len(fields(DiemSacThai)))


class Store(Protocol):
    def can_cham(self, model_version: str, do_dai_toi_thieu: int) -> list[tuple[str, str]]: ...
    def upsert(self, diem: list[DiemSacThai]) -> None: ...
    def count(self, model_version: str | None = None) -> int: ...
    def phan_bo(self, model_version: str) -> list[tuple[str, int]]: ...
    def close(self) -> None: ...


class _Chung:
    """Phần giống nhau giữa DuckDB và PostgreSQL: dựng câu lệnh từ Corpus.

    Mọi mảnh SQL cắm vào chuỗi ở đây — tên bảng, biểu thức văn bản, điều kiện lọc — đều là
    HẰNG khai trong `nlp/settings.py`, không bao giờ đến từ đầu vào người dùng.
    """

    _ph = "?"
    corpus: Corpus
    _luoc_do: str = ""

    def _ten(self, bang: str) -> str:
        return f"{self._luoc_do}.{bang}" if self._luoc_do else bang

    def _bang_diem(self) -> str:
        return self._ten(self.corpus.bang_diem)

    def _cau_can_cham(self) -> str:
        return CAN_CHAM.format(
            cot_khoa=self.corpus.cot_khoa,
            bieu_thuc_van_ban=self.corpus.bieu_thuc_van_ban,
            bang_tho=self._ten(self.corpus.bang_tho),
            bang_diem=self._bang_diem(),
            dieu_kien=self.corpus.dieu_kien,
            ph=self._ph,
        )


class DuckDbStore(_Chung):
    _ph = "?"

    def __init__(self, settings: StoreSettings, corpus: Corpus) -> None:
        import duckdb

        self.corpus = corpus
        settings.duckdb_path.parent.mkdir(parents=True, exist_ok=True)
        self._con = duckdb.connect(str(settings.duckdb_path))
        self._con.execute(DDL.format(table=corpus.bang_diem))

    def can_cham(self, model_version: str, do_dai_toi_thieu: int) -> list[tuple[str, str]]:
        dong = self._con.execute(self._cau_can_cham(), [model_version, do_dai_toi_thieu]).fetchall()
        return [(str(k), str(t)) for k, t in dong]

    def upsert(self, diem: list[DiemSacThai]) -> None:
        if not diem:
            return
        self._con.executemany(
            UPSERT.format(table=self.corpus.bang_diem, ph=_placeholders("?")),
            [d.as_row() for d in diem],
        )
        self._con.commit()

    def count(self, model_version: str | None = None) -> int:
        bang = self.corpus.bang_diem
        if model_version is None:
            kq = self._con.execute(f"SELECT count(*) FROM {bang}").fetchone()
        else:
            kq = self._con.execute(
                f"SELECT count(*) FROM {bang} WHERE model_version = ?", [model_version]
            ).fetchone()
        return int(kq[0]) if kq else 0

    def phan_bo(self, model_version: str) -> list[tuple[str, int]]:
        dong = self._con.execute(
            f"SELECT label, count(*) FROM {self.corpus.bang_diem} WHERE model_version = ? "
            "GROUP BY 1 ORDER BY 2 DESC",
            [model_version],
        ).fetchall()
        return [(str(k), int(v)) for k, v in dong]

    def close(self) -> None:
        self._con.close()


class PostgresStore(_Chung):
    _ph = "%s"

    def __init__(self, settings: StoreSettings, corpus: Corpus) -> None:
        try:
            import psycopg
        except ImportError as loi:  # pragma: no cover — chỉ xảy ra khi chưa dựng Docker
            raise NlpError(
                "Cần psycopg để ghi vào PostgreSQL: uv add psycopg[binary]. "
                "Hoặc đặt INGEST_CACHE=duckdb để chạy bằng file cục bộ."
            ) from loi

        self.corpus = corpus
        self._luoc_do = settings.schema_name
        self._con = psycopg.connect(
            host=settings.postgres_host,
            port=settings.postgres_port,
            dbname=settings.postgres_db,
            user=settings.postgres_user,
            password=settings.postgres_password,
        )
        with self._con.cursor() as cur:
            cur.execute(f"CREATE SCHEMA IF NOT EXISTS {self._luoc_do}")
            cur.execute(DDL.format(table=self._bang_diem()))
        self._con.commit()

    def can_cham(self, model_version: str, do_dai_toi_thieu: int) -> list[tuple[str, str]]:
        with self._con.cursor() as cur:
            cur.execute(self._cau_can_cham(), [model_version, do_dai_toi_thieu])
            dong = cur.fetchall()
        return [(str(k), str(t)) for k, t in dong]

    def upsert(self, diem: list[DiemSacThai]) -> None:
        if not diem:
            return
        with self._con.cursor() as cur:
            cur.executemany(
                UPSERT.format(table=self._bang_diem(), ph=_placeholders("%s")),
                [d.as_row() for d in diem],
            )
        self._con.commit()

    def count(self, model_version: str | None = None) -> int:
        with self._con.cursor() as cur:
            if model_version is None:
                cur.execute(f"SELECT count(*) FROM {self._bang_diem()}")
            else:
                cur.execute(
                    f"SELECT count(*) FROM {self._bang_diem()} WHERE model_version = %s",
                    [model_version],
                )
            kq = cur.fetchone()
        return int(kq[0]) if kq else 0

    def phan_bo(self, model_version: str) -> list[tuple[str, int]]:
        with self._con.cursor() as cur:
            cur.execute(
                f"SELECT label, count(*) FROM {self._bang_diem()} WHERE model_version = %s "
                "GROUP BY 1 ORDER BY 2 DESC",
                [model_version],
            )
            dong = cur.fetchall()
        return [(str(k), int(v)) for k, v in dong]

    def close(self) -> None:
        self._con.close()


def open_store(corpus: Corpus, settings: StoreSettings | None = None) -> Store:
    settings = settings or StoreSettings.from_env()
    if settings.kind == "duckdb":
        return DuckDbStore(settings, corpus)
    return PostgresStore(settings, corpus)


def now() -> datetime:
    return datetime.now(UTC)
