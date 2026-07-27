-- Mức tuân thủ quy ước gắn thẻ UTM, theo tháng.
--
-- Đây là thước đo để biết việc ban hành quy ước có ăn thua hay không. Trước khi ban
-- hành, `so_phien_co_utm` gần như bằng 0 — toàn bộ giá trị chiến dịch đều do GA4 tự
-- sinh: (organic), (direct), (referral), (not set).
--
-- Đọc kèm `mart__channel_performance`: tỷ trọng Direct giảm và tỷ lệ gắn thẻ tăng là
-- hai mặt của cùng một việc.
with theo_thang as (
    select
        date_trunc('month', ngay)::date         as thang,
        sum(so_phien)                           as so_phien,
        sum(so_phien) filter (where co_gan_utm) as so_phien_co_utm,
        count(distinct ten_chien_dich)
            filter (where co_gan_utm)           as so_chien_dich_dat_ten
    from {{ ref('stg__ga4__campaigns') }}
    group by 1
)

select
    thang,
    so_phien,
    so_phien_co_utm,
    so_chien_dich_dat_ten,
    round(100.0 * so_phien_co_utm / nullif(so_phien, 0), 2) as ty_le_gan_the_pct
from theo_thang
order by thang
