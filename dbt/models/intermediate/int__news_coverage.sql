-- Tin bài BÁO NGOÀI viết về Học viện, kèm sắc thái đã chấm.
--
-- Ba phép lọc, song song với `int__social_conversation` để hai chỉ số đọc được cạnh nhau:
--
--   1. Chỉ giữ bài có nhãn `ptit`. Kho tin bài phục vụ cả nhóm sáu trường đối sánh; không
--      lọc thì sắc thái của bài về HUST bị tính thành sắc thái về Học viện.
--   2. Bỏ bài `la_kenh_cua_ta`. Thông cáo Học viện tự đăng trên cổng thông tin lọt vào kho
--      qua Google News. Đếm chúng vào "báo chí nói gì về ta" là tự khen mình rồi tính thành
--      earned media.
--   3. Mỗi bài chỉ lấy điểm của MỘT phiên bản model — lần chấm gần nhất.
--
-- Bài chưa qua bước gán nhãn thương hiệu (`crawler gan-nhan`) không có mặt ở đây. Đó là
-- hành vi có chủ ý: thà thiếu bài còn hơn tính nhầm bài của trường khác vào Học viện.
with diem_moi_nhat as (
    -- Lấy lần chấm gần nhất. Không sắp theo tên phiên bản vì chuỗi phiên bản là mã băm
    -- commit, không có thứ tự thời gian.
    select distinct on (ma_tin_bai)
        ma_tin_bai,
        phien_ban_model,
        sac_thai,
        diem_tich_cuc,
        diem_trung_tinh,
        diem_tieu_cuc,
        do_chac_chan,
        da_bi_cat,
        thoi_diem_cham
    from {{ ref('stg__news__sentiment') }}
    order by ma_tin_bai, thoi_diem_cham desc, phien_ban_model
)

select
    b.mention_key                               as ma_tin_bai,
    b.bao,
    b.duong_dan,
    coalesce(b.thoi_diem_dang, d.thoi_diem_cham) as thoi_diem,
    (b.thoi_diem_dang is null)                   as thoi_diem_la_uoc_luong,
    d.phien_ban_model,
    d.sac_thai,
    d.diem_tich_cuc,
    d.diem_trung_tinh,
    d.diem_tieu_cuc,
    d.do_chac_chan,
    d.da_bi_cat
from {{ ref('stg__news__brand_mention') }} b
join diem_moi_nhat d on d.ma_tin_bai = b.mention_key
where b.ma_truong = 'ptit'
  and not b.la_kenh_cua_ta
