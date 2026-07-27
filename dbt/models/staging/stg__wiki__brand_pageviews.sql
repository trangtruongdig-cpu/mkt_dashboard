-- Lượt xem trang Wikipedia của nhóm trường đối sánh, theo tuần.
--
-- Job thu thập chỉ ghi những tuần TRỌN VẸN 7 ngày mà cả sáu trường đều có dữ liệu, nên
-- ở đây không phải lọc tuần dở dang nữa. Cột `interest_index` bên Trends là thang tương
-- đối 0–100, còn cột này là SỐ ĐẾM TUYỆT ĐỐI — so sánh trực tiếp giữa các trường và
-- giữa các năm được, đó là lý do nó thay được Google Trends đang bị chặn.
select
    brand_key                       as ma_truong,
    week_start::date                as tuan,
    coalesce(views, 0)::bigint      as so_luot_xem,
    article                         as ten_bai,
    project                         as du_an_wikipedia,
    collected_at                    as thoi_diem_thu_thap
from {{ source('raw', 'raw_brand_pageviews') }}
