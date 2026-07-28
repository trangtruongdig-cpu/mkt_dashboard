-- Điểm sắc thái tin bài, do worker chấm bằng PhoBERT.
--
-- Model cắt ở 256 token, nên điểm của một bài dài thực chất là điểm của TIÊU ĐỀ + PHẦN
-- ĐẦU BÀI. Với tin tức đó là chấp nhận được — lập trường của bài nằm gần như trọn vẹn ở
-- tiêu đề và đoạn mở — nhưng cột `da_bi_cat` vẫn phải mang theo để nói rõ điều đó.
--
-- Như bảng sắc thái mạng xã hội: một bài có NHIỀU dòng ở đây nếu đã chấm bằng nhiều phiên
-- bản model. Không join thẳng vào bảng tin bài, sẽ nhân đôi số bài.
select
    mention_key                       as ma_tin_bai,
    model_version                     as phien_ban_model,
    label                             as sac_thai,
    score_positive::double precision  as diem_tich_cuc,
    score_neutral::double precision   as diem_trung_tinh,
    score_negative::double precision  as diem_tieu_cuc,
    confidence::double precision      as do_chac_chan,
    text_chars::int                   as so_ky_tu_da_cham,
    truncated                         as da_bi_cat,
    scored_at                         as thoi_diem_cham
from {{ source('raw', 'news_sentiment') }}
