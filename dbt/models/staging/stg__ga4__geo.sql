-- Lưu ý khi dùng: từ khoảng giữa năm 2026 Google hạ độ phân giải địa lý, tỷ lệ
-- thành phố `(not set)` tăng vọt từ 1,7% lên 24,6%. Phần bị che dồn vào tỉnh nhỏ nên
-- KHÔNG so sánh tỷ trọng theo tỉnh giữa hai năm được — cột `thanh_pho_an_danh` để
-- model phía sau tự quyết định loại ra hay giữ lại.
select
    to_date("date", 'YYYYMMDD')         as ngay,
    nullif(country, '')                 as quoc_gia,
    nullif(city, '')                    as thanh_pho,
    (city = '(not set)')                as thanh_pho_an_danh,
    coalesce(sessions, 0)::bigint       as so_phien,
    coalesce("totalUsers", 0)::bigint   as so_nguoi_dung,
    coalesce("newUsers", 0)::bigint     as so_nguoi_dung_moi
from {{ source('raw', 'ga4_geo_daily') }}
