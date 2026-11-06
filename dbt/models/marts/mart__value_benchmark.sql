-- CHIỀU GIÁ TRỊ của nhóm trường đối sánh — học phí và chi phí đào tạo.
--
-- Hợp đồng dữ liệu cho các chỉ số tầng kinh doanh thuộc nhóm giá trị. Khung IBMC đòi
-- sản lượng và giá trị luôn đi thành cặp; `mart__disclosure_benchmark` lo nửa sản
-- lượng (số nhập học, quy mô đào tạo), bảng này lo nửa giá trị.
--
-- KHÔNG quy đổi giữa các đơn vị học phí. Đổi đồng/tín chỉ sang đồng/năm cần số tín chỉ
-- một năm của từng chương trình — con số đó không có trong đề án, và đoán bừa 30–35
-- tín chỉ sẽ tạo ra chênh lệch lớn hơn chính khác biệt giữa các trường. Mỗi đơn vị
-- một cột; so sánh chỉ có nghĩa trong cùng một cột.
select
    f.ma_truong,
    f.ma_truong = 'ptit'                 as la_hoc_vien,
    f.nam,
    -- Hệ đào tạo là một PHẦN CỦA KHOÁ: học phí hệ từ xa và hệ chính quy của cùng một
    -- trường chênh nhau nhiều lần, so lẫn hai hệ là so lệch nguồn.
    f.he_dao_tao,
    f.don_vi_hoc_phi,
    f.hoc_phi_moi_tin_chi,
    f.hoc_phi_moi_nam,
    f.hoc_phi_moi_thang,
    f.hoc_phi_moi_hoc_ky,
    f.hoc_phi_can_tren,
    f.chi_phi_dao_tao_moi_sinh_vien,
    f.tong_nguon_thu,

    -- Phần học phí bù được chi phí đào tạo. Dưới 100% nghĩa là ngân sách nhà nước hoặc
    -- nguồn thu khác đang gánh phần còn lại — với trường công đó là bình thường, nhưng
    -- nó là mẫu số thật khi bàn tới dư địa tăng học phí.
    case
        when f.chi_phi_dao_tao_moi_sinh_vien > 0 and f.hoc_phi_moi_nam is not null
        then round(100.0 * f.hoc_phi_moi_nam / f.chi_phi_dao_tao_moi_sinh_vien, 1)
    end                                   as hoc_phi_tren_chi_phi_pct,

    f.boc_sach,
    f.canh_bao,
    f.duong_dan_tai_lieu
from {{ ref('stg__de_an__finance') }} as f
