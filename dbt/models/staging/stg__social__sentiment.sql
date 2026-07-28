-- Điểm sắc thái do worker chấm. Một bản ghi có thể có NHIỀU dòng ở đây, mỗi dòng là
-- điểm của một phiên bản model — đó là chủ ý, không phải trùng lặp.
--
-- Vì vậy KHÔNG được join thẳng bảng này vào bảng thảo luận: sẽ nhân đôi số lượt nhắc đến
-- mỗi lần nâng cấp model. Việc chọn ra đúng một phiên bản làm chuẩn nằm ở
-- `int__social_conversation`.
select
    mention_key                       as ma_thao_luan,
    model_version                     as phien_ban_model,
    label                             as sac_thai,
    score_positive::double precision  as diem_tich_cuc,
    score_neutral::double precision   as diem_trung_tinh,
    score_negative::double precision  as diem_tieu_cuc,
    confidence::double precision      as do_chac_chan,
    text_chars::int                   as so_ky_tu_da_cham,
    -- Bản ghi dài hơn giới hạn token bị cắt trước khi đưa vào model. Điểm của nó là điểm
    -- của phần đầu, không phải của toàn bài — cột này để về sau còn kiểm chứng lại được.
    truncated                         as da_bi_cat,
    scored_at                         as thoi_diem_cham
from {{ source('raw', 'social_sentiment') }}
