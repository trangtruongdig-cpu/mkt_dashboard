-- Phân biệt chiến dịch do người đặt tên với giá trị GA4 tự sinh.
--
-- Đây là chỗ đo được mức độ tuân thủ quy ước UTM: `co_gan_utm = false` nghĩa là lưu
-- lượng đó không quy được về chiến dịch nào cả.
select
    to_date("date", 'YYYYMMDD')                 as ngay,
    nullif("sessionCampaignName", '')           as ten_chien_dich,
    lower(nullif("sessionSource", ''))          as nguon_phien,
    lower(nullif("sessionMedium", ''))          as phuong_tien_phien,
    -- GA4 tự điền (organic), (direct), (referral), (not set) khi không có utm_campaign.
    ("sessionCampaignName" not like '(%)'
        and "sessionCampaignName" is not null
        and "sessionCampaignName" <> '')        as co_gan_utm,
    coalesce(sessions, 0)::bigint               as so_phien,
    coalesce("engagedSessions", 0)::bigint      as so_phien_gan_ket,
    coalesce("totalUsers", 0)::bigint           as so_nguoi_dung,
    coalesce("newUsers", 0)::bigint             as so_nguoi_dung_moi
from {{ source('raw', 'ga4_campaigns_daily') }}
