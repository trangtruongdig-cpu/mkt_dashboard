-- 1:1 với bảng thô, thêm đúng một việc: chuẩn hoá đường dẫn.
--
-- Vì sao phải chuẩn hoá ở tầng này: mỗi mùa tuyển sinh Học viện tạo trang mới cho
-- cùng một ngành với hậu tố năm (`nganh-cong-nghe-thong-tin-2025/`). Không gộp thì
-- ngành bị chia đôi và thứ hạng đảo ngược. Xử lý ở đây một lần để mọi model phía sau
-- khỏi phải nhớ.
select
    to_date("date", 'YYYYMMDD')             as ngay,
    lower("hostName")                       as ten_may_chu,
    "pagePath"                              as duong_dan,
    -- Bỏ hậu tố năm và dấu / cuối để gộp các phiên bản của cùng một trang.
    regexp_replace(
        regexp_replace("pagePath", '-20[0-9]{2}/?$', ''),
        '/$', ''
    )                                       as duong_dan_gop,
    coalesce("screenPageViews", 0)::bigint  as so_luot_xem,
    coalesce(sessions, 0)::bigint           as so_phien,
    coalesce("totalUsers", 0)::bigint       as so_nguoi_dung,
    coalesce("userEngagementDuration", 0)::bigint as giay_gan_ket
from {{ source('raw', 'ga4_pages_daily') }}
