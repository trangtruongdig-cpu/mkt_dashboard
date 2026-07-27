"""Bảng điểm sắc thái. Bảng RIÊNG, không đụng vào bảng thô.

Mục 6 CLAUDE.md: "Kết quả sentiment ghi vào bảng riêng kèm model_version và scored_at,
không ghi đè dữ liệu gốc. Phải truy vết được điểm số nào do phiên bản model nào sinh ra."

Khoá chính là CẶP (mention_key, model_version), không phải riêng mention_key. Hệ quả:
chấm lại cùng một bình luận bằng model mới sinh ra một DÒNG MỚI chứ không đè lên dòng cũ.
Nhờ đó đổi model rồi vẫn so được điểm cũ với điểm mới trên cùng tập dữ liệu — thứ hội đồng
sẽ hỏi khi thấy biểu đồ sắc thái đổi hình sau một lần nâng cấp.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, fields
from datetime import UTC, datetime
from typing import Any, Protocol

from crawler.settings import StoreSettings

from .settings import NlpError

TABLE = "social_sentiment"

DDL = """
CREATE TABLE IF NOT EXISTS {table} (
    mention_key   TEXT NOT NULL,
    model_version TEXT NOT NULL,
    label         TEXT NOT NULL,
    score_positive DOUBLE NOT NULL,
    score_neutral  DOUBLE NOT NULL,
    score_negative DOUBLE NOT NULL,
    confidence    DOUBLE NOT NULL,
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
SELECT m.mention_key, m.body_text
FROM {bang_tho} m
LEFT JOIN {bang_diem} s
       ON s.mention_key = m.mention_key AND s.model_version = {ph}
WHERE s.mention_key IS NULL
  AND m.content_type IN ({hat})
  AND length(m.body_text) >= {ph}
ORDER BY m.first_seen_at
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
    def can_cham(
        self, model_version: str, hat: tuple[str, ...], do_dai_toi_thieu: int
    ) -> list[tuple[str, str]]: ...
    def upsert(self, diem: list[DiemSacThai]) -> None: ...
    def count(self, model_version: str | None = None) -> int: ...
    def phan_bo(self, model_version: str) -> list[tuple[str, int]]: ...
    def close(self) -> None: ...


class _Chung:
    """Phần giống nhau giữa DuckDB và PostgreSQL: dựng câu lệnh, đổi ký hiệu ô giữ chỗ."""

    _ph = "?"

    def _bang_diem(self) -> str:
        return TABLE

    def _bang_tho(self) -> str:
        # Bảng thô do gói `social` dựng. Đọc chứ không tạo — nếu chưa có thì đó là lỗi
        # trình tự chạy job, phải báo rõ chứ không im lặng tạo bảng rỗng rồi chấm 0 dòng.
        from social.storage import TABLE as SOCIAL_TABLE

        return SOCIAL_TABLE

    def _cau_can_cham(self, hat: tuple[str, ...]) -> str:
        return CAN_CHAM.format(
            bang_tho=self._bang_tho(),
            bang_diem=self._bang_diem(),
            ph=self._ph,
            hat=", ".join([self._ph] * len(hat)),
        )


class DuckDbStore(_Chung):
    _ph = "?"

    def __init__(self, settings: StoreSettings) -> None:
        import duckdb

        settings.duckdb_path.parent.mkdir(parents=True, exist_ok=True)
        self._con = duckdb.connect(str(settings.duckdb_path))
        self._con.execute(DDL.format(table=TABLE))

    def can_cham(
        self, model_version: str, hat: tuple[str, ...], do_dai_toi_thieu: int
    ) -> list[tuple[str, str]]:
        dong = self._con.execute(
            self._cau_can_cham(hat), [model_version, *hat, do_dai_toi_thieu]
        ).fetchall()
        return [(str(k), str(t)) for k, t in dong]

    def upsert(self, diem: list[DiemSacThai]) -> None:
        if not diem:
            return
        self._con.executemany(
            UPSERT.format(table=TABLE, ph=_placeholders("?")), [d.as_row() for d in diem]
        )
        self._con.commit()

    def count(self, model_version: str | None = None) -> int:
        if model_version is None:
            kq = self._con.execute(f"SELECT count(*) FROM {TABLE}").fetchone()
        else:
            kq = self._con.execute(
                f"SELECT count(*) FROM {TABLE} WHERE model_version = ?", [model_version]
            ).fetchone()
        return int(kq[0]) if kq else 0

    def phan_bo(self, model_version: str) -> list[tuple[str, int]]:
        dong = self._con.execute(
            f"SELECT label, count(*) FROM {TABLE} WHERE model_version = ? "
            "GROUP BY 1 ORDER BY 2 DESC",
            [model_version],
        ).fetchall()
        return [(str(k), int(v)) for k, v in dong]

    def close(self) -> None:
        self._con.close()


class PostgresStore(_Chung):
    _ph = "%s"

    def __init__(self, settings: StoreSettings) -> None:
        try:
            import psycopg
        except ImportError as loi:  # pragma: no cover — chỉ xảy ra khi chưa dựng Docker
            raise NlpError(
                "Cần psycopg để ghi vào PostgreSQL: uv add psycopg[binary]. "
                "Hoặc đặt INGEST_CACHE=duckdb để chạy bằng file cục bộ."
            ) from loi

        self._schema = settings.schema_name
        self._con = psycopg.connect(
            host=settings.postgres_host,
            port=settings.postgres_port,
            dbname=settings.postgres_db,
            user=settings.postgres_user,
            password=settings.postgres_password,
        )
        with self._con.cursor() as cur:
            cur.execute(f"CREATE SCHEMA IF NOT EXISTS {self._schema}")
            cur.execute(DDL.format(table=self._bang_diem()))
        self._con.commit()

    def _bang_diem(self) -> str:
        return f"{self._schema}.{TABLE}"

    def _bang_tho(self) -> str:
        from social.storage import TABLE as SOCIAL_TABLE

        return f"{self._schema}.{SOCIAL_TABLE}"

    def can_cham(
        self, model_version: str, hat: tuple[str, ...], do_dai_toi_thieu: int
    ) -> list[tuple[str, str]]:
        with self._con.cursor() as cur:
            cur.execute(self._cau_can_cham(hat), [model_version, *hat, do_dai_toi_thieu])
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


def open_store(settings: StoreSettings | None = None) -> Store:
    settings = settings or StoreSettings.from_env()
    return DuckDbStore(settings) if settings.kind == "duckdb" else PostgresStore(settings)


def now() -> datetime:
    return datetime.now(UTC)
