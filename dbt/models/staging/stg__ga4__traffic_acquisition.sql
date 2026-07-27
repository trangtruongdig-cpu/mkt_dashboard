-- 1:1 với bảng thô. Chỉ ép kiểu và đổi tên cột sang snake_case, không tính toán gì.
select
    to_date("date", 'YYYYMMDD')                     as ngay,
    lower(nullif("sessionSource", ''))              as nguon_phien,
    lower(nullif("sessionMedium", ''))              as phuong_tien_phien,
    nullif("sessionDefaultChannelGroup", '')        as nhom_kenh,
    coalesce(sessions, 0)::bigint                   as so_phien,
    coalesce("engagedSessions", 0)::bigint          as so_phien_gan_ket,
    coalesce("totalUsers", 0)::bigint               as so_nguoi_dung,
    coalesce("newUsers", 0)::bigint                 as so_nguoi_dung_moi,
    coalesce("screenPageViews", 0)::bigint          as so_luot_xem,
    coalesce("averageSessionDuration", 0)::numeric  as thoi_luong_phien_tb
from {{ source('raw', 'ga4_traffic_acquisition_daily') }}
