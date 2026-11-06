-- CHIỀU GIÁ TRỊ của nhóm trường đối sánh — học phí và chi phí đào tạo.
--
-- Hợp đồng dữ liệu cho các chỉ số tầng kinh doanh thuộc nhóm giá trị. Khung IBMC đòi
-- sản lượng và giá trị luôn đi thành cặp; `mart__disclosure_benchmark` lo nửa sản
-- lượng (số nhập học, quy mô đào tạo), bảng này lo nửa giá trị.
--
-- HAI ĐƯỜNG VÀO, và cột `cach_lay` nói rõ dòng nào đi đường nào:
--
--   tu_dong  — bóc từ đề án tuyển sinh bằng `crawler de-an-boc-so`.
--   nhap_tay — người nhập từ `dbt/seeds/hoc_phi_doi_sanh.csv`, kèm `nguon_url`.
--
-- Vì sao phải có đường nhập tay: học phí của Bách khoa, Công nghệ (ĐHQGHN) và FPT nằm
-- trong bảng do JavaScript dựng — HTML tĩnh không có một thẻ <table> nào và không có
-- con số tiền nào, nên crawler HTTP không với tới. Của UIT thì nằm trong bảng nhiều
-- năm × nhiều lần đóng trong PDF, không phải một số trong câu. Dựng trình duyệt không
-- đầu để lấy SÁU con số đổi một lần mỗi năm là không tương xứng; nhập tay kèm đường
-- dẫn nguồn vừa rẻ hơn vừa kiểm chứng lại được.
--
-- Dòng seed để TRỐNG giá trị là hàng đợi công việc, không phải chỗ khuyết: nó mang
-- sẵn đường dẫn nguồn để người điền mở ra và chép đúng một con số.
--
-- KHÔNG quy đổi giữa các đơn vị học phí. Đổi đồng/tín chỉ sang đồng/năm cần số tín chỉ
-- một năm của từng chương trình — con số đó không có trong đề án, và đoán bừa 30–35
-- tín chỉ sẽ tạo ra chênh lệch lớn hơn chính khác biệt giữa các trường. Mỗi đơn vị
-- một cột; so sánh chỉ có nghĩa trong cùng một cột.
with tu_de_an as (
    select
        ma_truong,
        nam,
        he_dao_tao,
        don_vi_hoc_phi,
        hoc_phi_moi_tin_chi,
        hoc_phi_moi_nam,
        hoc_phi_moi_thang,
        hoc_phi_moi_hoc_ky,
        hoc_phi_can_tren,
        chi_phi_dao_tao_moi_sinh_vien,
        tong_nguon_thu,
        boc_sach,
        canh_bao,
        duong_dan_tai_lieu,
        'tu_dong' as cach_lay
    from {{ ref('stg__de_an__finance') }}
),

nhap_tay as (
    select
        ma_truong,
        nam,
        he_dao_tao,
        nullif(don_vi_hoc_phi, '')                                    as don_vi_hoc_phi,
        case when don_vi_hoc_phi = 'tin_chi' then hoc_phi end::bigint as hoc_phi_moi_tin_chi,
        case when don_vi_hoc_phi = 'nam'     then hoc_phi end::bigint as hoc_phi_moi_nam,
        case when don_vi_hoc_phi = 'thang'   then hoc_phi end::bigint as hoc_phi_moi_thang,
        case when don_vi_hoc_phi = 'hoc_ky'  then hoc_phi end::bigint as hoc_phi_moi_hoc_ky,
        hoc_phi_can_tren::bigint                                      as hoc_phi_can_tren,
        null::bigint                                                  as chi_phi_dao_tao_moi_sinh_vien,
        null::bigint                                                  as tong_nguon_thu,
        -- Người nhập thì không có bước bóc nào để mà sạch hay không; để `false` sẽ nói
        -- dối là bóc hỏng, nên dùng null và ghi lý do vào `canh_bao`.
        null::boolean                                                 as boc_sach,
        ghi_chu                                                       as canh_bao,
        nguon_url                                                     as duong_dan_tai_lieu,
        'nhap_tay'                                                    as cach_lay
    from {{ ref('hoc_phi_doi_sanh') }}
),

gop as (
    select * from tu_de_an
    union all
    select * from nhap_tay
)

select
    g.*,
    g.ma_truong = 'ptit' as la_hoc_vien,

    -- Phần học phí bù được chi phí đào tạo. Dưới 100% nghĩa là ngân sách nhà nước hoặc
    -- nguồn thu khác đang gánh phần còn lại — với trường công đó là bình thường, nhưng
    -- nó là mẫu số thật khi bàn tới dư địa tăng học phí.
    case
        when g.chi_phi_dao_tao_moi_sinh_vien > 0 and g.hoc_phi_moi_nam is not null
        then round(100.0 * g.hoc_phi_moi_nam / g.chi_phi_dao_tao_moi_sinh_vien, 1)
    end as hoc_phi_tren_chi_phi_pct,

    -- Cờ cho giao diện: dòng đã có số hay mới chỉ có đường dẫn chờ người điền.
    coalesce(
        g.hoc_phi_moi_tin_chi, g.hoc_phi_moi_nam, g.hoc_phi_moi_thang, g.hoc_phi_moi_hoc_ky
    ) is not null as da_co_hoc_phi
from gop as g
