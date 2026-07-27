-- Hiệu quả từng kênh theo ngày. Đây là hợp đồng dữ liệu với backend cho các chỉ số
-- thuộc tầng truyền thông.
--
-- Cột `la_direct` tách riêng vì phần lưu lượng rơi vào Direct chính là phần KHÔNG quy
-- được về kênh nào — đo được nó là đo được mức thất thoát quy kết.
select
    ngay,
    coalesce(nhom_kenh, 'Không xác định')            as nhom_kenh,
    (nhom_kenh = 'Direct')                           as la_direct,
    sum(so_phien)                                    as so_phien,
    sum(so_phien_gan_ket)                            as so_phien_gan_ket,
    sum(so_nguoi_dung)                               as so_nguoi_dung,
    sum(so_nguoi_dung_moi)                           as so_nguoi_dung_moi,
    sum(so_luot_xem)                                 as so_luot_xem,
    round(
        100.0 * sum(so_phien_gan_ket) / nullif(sum(so_phien), 0), 1
    )                                                as ty_le_gan_ket_pct
from {{ ref('stg__ga4__traffic_acquisition') }}
group by 1, 2, 3
