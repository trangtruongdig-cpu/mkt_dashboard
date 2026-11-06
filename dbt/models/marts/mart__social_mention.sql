-- Từng ý kiến một dòng, kèm sắc thái. Hợp đồng dữ liệu cho trang "Lắng nghe".
--
-- Vì sao cần mart này bên cạnh `mart__social_sentiment`: biểu đồ tỷ lệ trả lời câu hỏi
-- "dư luận đang tốt hay xấu", nhưng câu hỏi thật của người dùng là "họ nói GÌ". Một con
-- số 6% tiêu cực không cho ai biết phải sửa cái gì; sáu câu tiêu cực đọc được thì có.
--
-- Giữ nguyên văn nội dung, không cắt: cắt ở tầng dữ liệu là quyết định thay cho tầng
-- trình bày, mà tầng trình bày mới biết còn bao nhiêu chỗ trên màn hình.
--
-- Tác giả đã được ẩn danh từ lúc thu thập (`author_ref` là mã băm). Mart này không thêm
-- và cũng không gỡ lớp ẩn danh đó — nó không có gì để gỡ.
select
    c.ma_thao_luan,
    c.nen_tang,
    c.ten_nguon,
    c.hat_du_lieu,
    c.duong_dan,
    c.noi_dung,
    length(c.noi_dung)                          as so_ky_tu,
    c.thoi_diem,
    c.thoi_diem_la_uoc_luong,
    coalesce(c.so_luot_thich, 0)                as so_luot_thich,
    c.phien_ban_model,
    c.sac_thai,
    round(c.do_chac_chan::numeric, 3)           as do_chac_chan,
    c.da_bi_cat,
    -- Vết truy nguyên. Mang cả ba điểm và cách phát hiện lên tới giao diện để người xem
    -- mở được từ một câu trích dẫn ra đúng bản ghi thô đã sinh ra nó.
    --
    -- Chỉ hiện nhãn thắng là giấu mất thông tin: một câu 0,34/0,33/0,33 và một câu
    -- 0,99/0,01/0,00 đều ra "tích cực", nhưng mức độ chắc chắn khác hẳn nhau. Hội đồng
    -- nghiệm thu phải kiểm được điều đó mà không cần mở cơ sở dữ liệu.
    round(c.diem_tich_cuc::numeric, 4)          as diem_tich_cuc,
    round(c.diem_trung_tinh::numeric, 4)        as diem_trung_tinh,
    round(c.diem_tieu_cuc::numeric, 4)          as diem_tieu_cuc,
    c.ma_tac_gia,
    c.cach_phat_hien,
    c.tu_khoa_tim,
    c.lan_dau_thay,
    -- Thứ tự đọc mặc định: ý kiến tiêu cực trước, rồi tới ý kiến được nhiều người thích.
    -- Một dashboard sắp theo thời gian sẽ chôn lời phàn nàn quan trọng nhất xuống dưới
    -- mười lời khen vô thưởng vô phạt đăng sau nó.
    case c.sac_thai when 'negative' then 0 when 'neutral' then 1 else 2 end as thu_tu_uu_tien
from {{ ref('int__social_conversation') }} c
