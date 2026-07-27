-- THỊ PHẦN CHÚ Ý theo tuần — hợp đồng dữ liệu cho chỉ số `attention_share`.
--
-- Vì sao chia tỷ trọng ở đây chứ không ở worker: số đếm tuyệt đối dao động mạnh theo
-- mùa tuyển sinh, cả nhóm cùng lên cùng xuống. Đổi sang tỷ trọng thì phần mùa vụ triệt
-- tiêu và còn lại đúng thứ cần đo — vị thế cạnh tranh.
--
-- Mẫu số là TỔNG CỦA CẢ NHÓM trong chính tuần đó. Thêm hay bớt một trường trong
-- `benchmark-brands.json` là đổi mẫu số, và số liệu trước/sau khi đổi không so trực
-- tiếp với nhau được.
with luot_xem as (
    select * from {{ ref('stg__wiki__brand_pageviews') }}
),

tong_tuan as (
    select
        tuan,
        sum(so_luot_xem) as tong_nhom
    from luot_xem
    group by tuan
)

select
    l.tuan,
    l.ma_truong,
    l.so_luot_xem,
    t.tong_nhom,
    case
        when t.tong_nhom > 0
            then round(l.so_luot_xem * 100.0 / t.tong_nhom, 2)
    end                                             as thi_phan_pct,
    (l.ma_truong = 'ptit')                          as la_hoc_vien
from luot_xem as l
inner join tong_tuan as t on l.tuan = t.tuan
