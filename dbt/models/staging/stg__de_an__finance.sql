-- Số tài chính bóc từ đề án tuyển sinh.
--
-- Thông tư 08/2022/TT-BGDĐT Điều 11 buộc mọi trường công bố đề án tuyển sinh theo bộ
-- mục đánh số cố định. Ba mục được lấy ở đây không có ở bất kỳ nguồn công khai nào
-- khác: 1.10 học phí, 1.14.1 tổng nguồn thu, 1.14.2 chi phí đào tạo bình quân một
-- sinh viên một năm.
--
-- `hoc_phi` KHÔNG đứng một mình được. Nó luôn phải đi với `hoc_phi_don_vi`; vì vậy
-- model này tách sẵn thành hai cột theo đơn vị, để model phía sau không có đường vô
-- tình cộng đồng/tín chỉ với đồng/năm.
select
    doc_url                                      as duong_dan_tai_lieu,
    school_key                                   as ma_truong,
    year                                         as nam,
    hoc_phi_don_vi                               as don_vi_hoc_phi,
    he_dao_tao                                   as he_dao_tao,
    case when hoc_phi_don_vi = 'tin_chi' then hoc_phi::bigint end as hoc_phi_moi_tin_chi,
    case when hoc_phi_don_vi = 'nam'     then hoc_phi::bigint end as hoc_phi_moi_nam,
    case when hoc_phi_don_vi = 'thang'   then hoc_phi::bigint end as hoc_phi_moi_thang,
    case when hoc_phi_don_vi = 'hoc_ky'  then hoc_phi::bigint end as hoc_phi_moi_hoc_ky,
    -- Cận trên khi trường công bố theo khoảng tuỳ ngành. Null = công bố một mức duy nhất.
    hoc_phi_den::bigint                          as hoc_phi_can_tren,
    tong_nguon_thu::bigint                       as tong_nguon_thu,
    chi_phi_binh_quan::bigint                    as chi_phi_dao_tao_moi_sinh_vien,
    nullif(trim(warnings), '')                   as canh_bao,
    (nullif(trim(warnings), '') is null)         as boc_sach,
    extracted_at                                 as thoi_diem_boc
from {{ source('raw', 'raw_de_an_figure') }}
