-- ĐỐI SÁNH SỐ LIỆU CÔNG KHAI theo trường và năm — hợp đồng dữ liệu cho các chỉ số
-- tầng kinh doanh: quy mô đào tạo, số tốt nghiệp, tỷ lệ có việc làm.
--
-- Một trường có thể công bố nhiều bản Biểu 18 cho cùng một năm (bản ký số, bản đăng
-- lại, bản tiếng Anh). Ở đây giữ đúng MỘT bản mỗi (trường, năm) và chọn bản đầy đủ
-- nhất — bản bóc sạch được ưu tiên trước bản có cảnh báo, rồi mới tới bản có nhiều
-- trường số liệu hơn. Không gộp trung bình các bản: chúng là cùng một sự thật được
-- đăng nhiều lần, không phải nhiều quan sát độc lập.
with da_boc as (
    select * from {{ ref('stg__disclosure__figure') }}
    where nam is not null
),

xep_hang as (
    select
        *,
        row_number() over (
            partition by ma_truong, nam
            order by
                boc_sach desc,
                (
                    (quy_mo_dao_tao is not null)::int
                    + (so_tot_nghiep is not null)::int
                    + (ty_le_viec_lam_pct is not null)::int
                ) desc,
                thoi_diem_boc desc
        ) as thu_tu
    from da_boc
)

select
    ma_truong,
    nam,
    quy_mo_dao_tao,
    so_dai_hoc_chinh_quy,
    so_tot_nghiep,
    ty_le_viec_lam_pct,
    boc_sach,
    canh_bao,
    duong_dan_tai_lieu,
    (ma_truong = 'ptit') as la_hoc_vien
from xep_hang
where thu_tu = 1
