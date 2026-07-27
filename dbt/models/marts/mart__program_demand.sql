-- Nhu cầu theo ngành đào tạo, đo bằng lượt xem trang chương trình.
--
-- Hai điều quyết định số có đúng hay không:
--
--   1. Chỉ lấy trên `daotao.ptit.edu.vn` — đây mới là nơi chứa danh mục ngành
--      (278.439 lượt xem, so với 894 trên ptit.edu.vn). Gộp nhiều tên máy chủ sẽ
--      kéo theo nội dung dành cho sinh viên đang học và làm lệch kết quả.
--   2. Dùng `duong_dan_gop` đã bỏ hậu tố năm ở tầng staging. Không gộp thì Công nghệ
--      thông tin bị chia đôi và tụt xuống dưới Công nghệ đa phương tiện.
with trang_nganh as (
    select
        ngay,
        -- Lấy phần khoá ngành từ đường dẫn đã gộp.
        regexp_replace(duong_dan_gop, '^.*/nganh-', '') as khoa_nganh,
        so_luot_xem,
        so_phien
    from {{ ref('stg__ga4__pages') }}
    where ten_may_chu = 'daotao.ptit.edu.vn'
      and duong_dan_gop like '%/nganh-%'
)

select
    t.ngay,
    t.khoa_nganh,
    n.ten_nganh,
    n.nhom,
    n.ten_nhom,
    n.thuoc_loi,
    n.he_gia_tri_cao,
    sum(t.so_luot_xem)  as so_luot_xem,
    sum(t.so_phien)     as so_phien
from trang_nganh t
-- inner join: đường dẫn không khớp ngành nào trong danh mục thì bỏ, thay vì lẳng lặng
-- gộp vào một nhóm "khác" mà không ai để ý. Ngành mới mở phải khai vào seed.
inner join {{ ref('nhom_nganh_dao_tao') }} n
    on n.khoa_nganh = t.khoa_nganh
group by 1, 2, 3, 4, 5, 6, 7
