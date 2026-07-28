-- Phân bố sắc thái thảo luận về Học viện theo tháng. Hợp đồng dữ liệu với backend cho
-- chỉ số `social_positive_sentiment_share` ở tầng truyền thông.
--
-- Gộp theo THÁNG, và con số này đã được chọn bằng dữ liệu thật chứ không theo thói quen:
-- bản dựng theo tuần cho ra 28 tuần với phần lớn tuần chỉ 1–5 bản ghi, tức đường xu hướng
-- nhảy 100% → 0% → 100% liên tục trong khi thực chất chỉ là một người bình luận. Tháng là
-- đơn vị nhỏ nhất mà tỷ lệ còn đọc được với lượng dữ liệu hiện có.
--
-- Cột `so_thao_luan` phải luôn được hiển thị kèm `ty_le_tich_cuc_pct`. Một tháng có 2 bản
-- ghi và một tháng có 200 bản ghi cùng cho ra 100% tích cực, nhưng chỉ một trong hai là
-- thông tin. Bỏ mẫu số đi là biến dữ liệu thưa thành kết luận chắc nịch.
select
    date_trunc('month', thoi_diem)::date                    as thang,
    phien_ban_model,
    count(*)                                                as so_thao_luan,
    count(*) filter (where sac_thai = 'positive')           as so_tich_cuc,
    count(*) filter (where sac_thai = 'neutral')            as so_trung_tinh,
    count(*) filter (where sac_thai = 'negative')           as so_tieu_cuc,
    round(
        100.0 * count(*) filter (where sac_thai = 'positive') / nullif(count(*), 0), 1
    )                                                       as ty_le_tich_cuc_pct,
    round(
        100.0 * count(*) filter (where sac_thai = 'negative') / nullif(count(*), 0), 1
    )                                                       as ty_le_tieu_cuc_pct,
    -- Mức chắc chắn trung bình của model trên các bản ghi trong tuần. Tụt thấp là dấu
    -- hiệu model đang gặp loại văn bản nó không quen — cần xem lại trước khi tin số.
    round(avg(do_chac_chan)::numeric, 3)                    as do_chac_chan_tb,
    -- Bao nhiêu bản ghi trong tuần bị cắt vì quá dài, và bao nhiêu phải ước lượng ngày
    -- đăng. Hai cột này là phần "chất lượng dữ liệu" mà báo cáo phải nói ra.
    count(*) filter (where da_bi_cat)                       as so_bi_cat,
    count(*) filter (where thoi_diem_la_uoc_luong)          as so_uoc_luong_ngay
from {{ ref('int__social_conversation') }}
group by 1, 2
