-- Phễu tuyển sinh đo bằng trang web, ba bậc.
--
-- Học viện KHÔNG có cổng nộp hồ sơ riêng — thí sinh nộp trên hệ thống của Bộ, nằm
-- ngoài tầm đo. Nên bậc sâu nhất đo được là trang thông báo nhập học. Các mẫu đường
-- dẫn dưới đây chọn bằng dữ liệu: so lượt xem trong đỉnh mùa với ngoài mùa, tỷ lệ từ
-- 13 lần tới vô cực, tức gần như không có nhiễu nền.
--
-- Xem apps/worker/config/funnel-pages.json để biết cách chọn và số đo cụ thể.
with trang as (
    select *
    from {{ ref('stg__ga4__pages') }}
    where ten_may_chu = 'tuyensinh.ptit.edu.vn'
),

phan_bac as (
    select
        ngay,
        duong_dan,
        so_luot_xem,
        so_phien,
        case
            when duong_dan ilike '%nhap-hoc%'
                then 'nhap_hoc'
            when duong_dan ilike '%mo-he-thong-dang-ky%'
              or duong_dan ilike '%dang-ky-nguyen-vong%'
              or duong_dan ilike '%huong-dan-dkxt%'
              or duong_dan ilike '%dieu-chinh-thoi-gian-dang-ky%'
                then 'y_dinh_dang_ky'
            when duong_dan ilike '%diem-chuan%'
              or duong_dan ilike '%diem-trung-tuyen%'
              or duong_dan ilike '%de-an-tuyen-sinh%'
              or duong_dan ilike '%phuong-thuc%'
                then 'can_nhac'
        end as bac
    from trang
)

select
    ngay,
    bac,
    case bac
        when 'can_nhac'       then 1
        when 'y_dinh_dang_ky' then 2
        when 'nhap_hoc'       then 3
    end                     as thu_tu_bac,
    case bac
        when 'can_nhac'       then 'Cân nhắc chọn trường'
        when 'y_dinh_dang_ky' then 'Ý định đăng ký xét tuyển'
        when 'nhap_hoc'       then 'Ý định nhập học'
    end                     as ten_bac,
    sum(so_luot_xem)        as so_luot_xem,
    sum(so_phien)           as so_phien
from phan_bac
where bac is not null
group by 1, 2, 3, 4
