-- Số liệu bóc từ Biểu mẫu 18 "Công khai thông tin chất lượng đào tạo thực tế".
--
-- Nguồn là tài liệu MỌI trường buộc phải công khai theo Thông tư 09/2024/TT-BGDĐT, nên
-- đây là chỗ duy nhất lấy được số nhập học, quy mô đào tạo và tỷ lệ có việc làm của cả
-- nhóm đối sánh mà không cần xin dữ liệu nội bộ của ai.
--
-- Cột `canh_bao` giữ nguyên từ bước bóc: biểu mẫu đổi bố cục qua từng năm và từng
-- trường, có bản chỉ ra được số bậc đại học. Model phía sau PHẢI đọc cột này trước khi
-- so sánh chéo — bỏ qua nó là so con số toàn trường với con số một bậc học.
select
    doc_url                                    as duong_dan_tai_lieu,
    school_key                                 as ma_truong,
    year                                       as nam,
    doctoral::bigint                           as so_tien_si,
    masters::bigint                            as so_thac_si,
    undergrad_regular::bigint                  as so_dai_hoc_chinh_quy,
    undergrad_second::bigint                   as so_van_bang_hai,
    undergrad_part_time::bigint                as so_vua_lam_vua_hoc,
    total_students::bigint                     as quy_mo_dao_tao,
    graduates::bigint                          as so_tot_nghiep,
    employment_rate_pct::numeric               as ty_le_viec_lam_pct,
    nullif(trim(warnings), '')                 as canh_bao,
    (nullif(trim(warnings), '') is null)       as boc_sach,
    extracted_at                               as thoi_diem_boc
from {{ source('raw', 'raw_disclosure_figure') }}
