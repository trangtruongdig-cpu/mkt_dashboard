-- Sắc thái tin bài báo ngoài viết về Học viện, theo tháng. Hợp đồng dữ liệu với backend
-- cho chỉ số `positive_sentiment_share` ở tầng truyền thông.
--
-- Cùng khuôn với `mart__social_sentiment` để hai chỉ số đọc được cạnh nhau. Khác nhau ở
-- chỗ đây là BÁO CHÍ nói (earned media), còn kia là NGƯỜI DÙNG THƯỜNG nói (dư luận) —
-- hai thứ không gộp được vào một con số.
select
    date_trunc('month', thoi_diem)::date                    as thang,
    phien_ban_model,
    count(*)                                                as so_tin_bai,
    count(*) filter (where sac_thai = 'positive')           as so_tich_cuc,
    count(*) filter (where sac_thai = 'neutral')            as so_trung_tinh,
    count(*) filter (where sac_thai = 'negative')           as so_tieu_cuc,
    count(distinct bao)                                     as so_dau_bao,
    round(
        100.0 * count(*) filter (where sac_thai = 'positive') / nullif(count(*), 0), 1
    )                                                       as ty_le_tich_cuc_pct,
    round(
        100.0 * count(*) filter (where sac_thai = 'negative') / nullif(count(*), 0), 1
    )                                                       as ty_le_tieu_cuc_pct,
    round(avg(do_chac_chan)::numeric, 3)                    as do_chac_chan_tb,
    -- Bài dài bị cắt ở 256 token: điểm là của tiêu đề và phần đầu bài. Với tin tức thì
    -- lập trường thường nằm ở đó, nhưng con số này phải hiện ra để người đọc tự đánh giá.
    count(*) filter (where da_bi_cat)                       as so_bi_cat,
    count(*) filter (where thoi_diem_la_uoc_luong)          as so_uoc_luong_ngay
from {{ ref('int__news_coverage') }}
group by 1, 2
