-- ĐỐI SÁNH ĐIỂM CHUẨN theo trường và năm — hợp đồng dữ liệu cho `score_premium`.
--
-- Điểm chuẩn bình quân của một trường KHÔNG so trực tiếp với trường khác nếu cơ cấu
-- ngành khác nhau: trường nhiều ngành kỹ thuật mũi nhọn sẽ có bình quân cao hơn trường
-- đào tạo rộng, mà không nói lên trường nào được thí sinh chọn hơn.
--
-- Vì vậy mart giữ cả bình quân lẫn số ngành và độ trải, để tầng đọc và người xem biết
-- con số dựa trên bao nhiêu ngành. Cột `du_nganh` đánh dấu trường có đủ ngành để bình
-- quân có nghĩa.
{% set nguong_du_nganh = 10 %}

with diem as (
    select * from {{ ref('stg__scores__admission') }}
)

select
    ma_truong,
    nam,
    count(*)                                     as so_nganh,
    round(avg(diem), 2)                          as diem_binh_quan,
    round(min(diem), 2)                          as diem_thap_nhat,
    round(max(diem), 2)                          as diem_cao_nhat,
    (count(*) >= {{ nguong_du_nganh }})          as du_nganh,
    (ma_truong = 'ptit')                         as la_hoc_vien
from diem
group by ma_truong, nam
