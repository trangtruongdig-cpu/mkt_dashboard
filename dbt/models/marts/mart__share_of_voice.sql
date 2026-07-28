-- THỊ PHẦN THẢO LUẬN theo tháng — hợp đồng dữ liệu cho chỉ số `share_of_voice`.
--
-- Chỉ đếm EARNED: bài do báo ngoài viết. Bài trên kênh của chính Học viện bị loại, nếu
-- không thì chỉ cần đăng thêm thông cáo là "thị phần" tự tăng — đo nỗ lực tự nói về
-- mình chứ không đo mức được người khác nhắc tới.
--
-- Điều kiện để con số này có nghĩa: mỗi trường phải được thu thập bằng CÙNG MỘT SỐ
-- LƯỢNG từ khoá tìm kiếm. Xem `_ghi_chu_can_bang` trong config/brand-keywords.json —
-- lúc chưa cân bằng, Học viện có 7 từ khoá còn đối thủ 1–2, và thị phần đo ra 52,3%
-- trong khi cân bằng lại chỉ còn 43,7%.
-- Ngưỡng số lần nhắc tối thiểu để tỷ trọng của một tháng có nghĩa. Không có ngưỡng thì
-- tháng chỉ có 1 bài cho ra "thị phần 100%" — đã gặp thật ở tháng 12/2026.
{% set nguong_du_mau = 20 %}

with earned as (
    select *
    from {{ ref('stg__news__brand_mention') }}
    where not la_kenh_cua_ta
      and thoi_diem_dang is not null
      -- Vài bài có ngày đăng ở tương lai do trang nguồn ghi sai. Giữ lại thì tháng
      -- gần nhất luôn là một tháng chưa tới, với đúng một bài trong đó.
      and ngay_dang <= current_date
),

theo_thang as (
    select
        date_trunc('month', ngay_dang)::date as thang,
        ma_truong,
        count(*)                             as so_lan_nhac,
        count(distinct bao)                  as so_dau_bao
    from earned
    group by 1, 2
),

tong_thang as (
    select thang, sum(so_lan_nhac) as tong_nhom
    from theo_thang
    group by thang
)

select
    t.thang,
    t.ma_truong,
    t.so_lan_nhac,
    t.so_dau_bao,
    u.tong_nhom,
    case
        when u.tong_nhom > 0
            then round(t.so_lan_nhac * 100.0 / u.tong_nhom, 2)
    end                                      as thi_phan_pct,
    -- Tầng đọc PHẢI lọc theo cột này trước khi lấy tháng gần nhất.
    (u.tong_nhom >= {{ nguong_du_mau }})     as du_mau,
    (t.ma_truong = 'ptit')                   as la_hoc_vien
from theo_thang as t
inner join tong_thang as u on t.thang = u.thang
