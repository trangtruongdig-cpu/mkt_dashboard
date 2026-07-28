-- Dư luận về Học viện: mỗi dòng là MỘT ý kiến của người ngoài, kèm sắc thái đã chấm.
--
-- Ba phép lọc, mỗi phép chặn một cách thổi phồng số liệu khác nhau:
--
--   1. Bỏ bản ghi `la_kenh_cua_hoc_vien`. Video tuyển sinh do Học viện tự đăng và bình
--      luận của chủ kênh dưới video của mình là owned media. Tính chúng vào "dư luận"
--      thì Học viện đang tự khen mình rồi đếm thành tiếng nói công chúng.
--   2. Chỉ giữ hạt mang ý kiến. Tiêu đề và mô tả video là lời giới thiệu của người làm
--      nội dung, không phải nhận xét về Học viện.
--   3. Mỗi thảo luận chỉ lấy ĐIỂM CỦA MỘT PHIÊN BẢN MODEL. Bảng điểm cố ý giữ cả điểm
--      cũ lẫn điểm mới để truy vết được; join thẳng sẽ nhân đôi số lượt nhắc đến mỗi
--      lần nâng cấp model.
with diem_moi_nhat as (
    -- Lấy lần chấm gần nhất. Không lấy theo tên phiên bản vì chuỗi phiên bản là mã băm
    -- commit, không sắp xếp được theo thứ tự thời gian.
    select distinct on (ma_thao_luan)
        ma_thao_luan,
        phien_ban_model,
        sac_thai,
        diem_tich_cuc,
        diem_trung_tinh,
        diem_tieu_cuc,
        do_chac_chan,
        da_bi_cat,
        thoi_diem_cham
    from {{ ref('stg__social__sentiment') }}
    order by ma_thao_luan, thoi_diem_cham desc, phien_ban_model
)

select
    m.ma_thao_luan,
    m.nen_tang,
    m.ten_nguon,
    m.hat_du_lieu,
    m.duong_dan,
    m.noi_dung,
    m.so_luot_thich,
    -- Thời điểm đăng là mốc đúng để dựng biểu đồ theo thời gian. Nguồn nào không cho
    -- biết ngày đăng (một số chủ đề diễn đàn) thì lùi về lần đầu hệ thống nhìn thấy —
    -- muộn hơn thực tế, nhưng không bao giờ sớm hơn.
    coalesce(m.thoi_diem_dang, m.lan_dau_thay)  as thoi_diem,
    (m.thoi_diem_dang is null)                  as thoi_diem_la_uoc_luong,
    d.phien_ban_model,
    d.sac_thai,
    d.diem_tich_cuc,
    d.diem_trung_tinh,
    d.diem_tieu_cuc,
    d.do_chac_chan,
    d.da_bi_cat
from {{ ref('stg__social__mention') }} m
join diem_moi_nhat d on d.ma_thao_luan = m.ma_thao_luan
where not m.la_kenh_cua_hoc_vien
  and m.hat_du_lieu in ('comment', 'post', 'thread')
