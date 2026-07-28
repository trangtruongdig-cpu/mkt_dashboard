-- Điểm chuẩn trúng tuyển từng ngành, bóc từ trang công bố của mỗi trường.
--
-- Chỉ giữ điểm thang 30 (xét bằng kết quả thi tốt nghiệp). Điểm SAT, đánh giá năng lực
-- và các thang khác đã bị loại ngay ở bước bóc — trộn chúng vào là so hai thang khác nhau.
select
    school_key                  as ma_truong,
    year                        as nam,
    ma_nganh,
    ten_nganh,
    diem::numeric               as diem,
    page_url                    as duong_dan_nguon,
    collected_at                as thoi_diem_boc
from {{ source('raw', 'raw_admission_score') }}
