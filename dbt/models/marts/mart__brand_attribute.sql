-- THUỘC TÍNH THƯƠNG HIỆU theo tháng — hợp đồng dữ liệu cho mục tiêu `com_attributes`.
--
-- Mỗi thuộc tính MỘT DÒNG RIÊNG, không gộp thành một tỷ lệ. Bài 5.1 của khung IBMC đặt
-- mục tiêu thuộc tính dạng cặp tăng–giữ: tăng thuộc tính đang nhắm trong khi KHÔNG giảm
-- thuộc tính đang mạnh. Một tỷ lệ gộp đứng yên 45% trong khi toàn bộ tin bài chuyển từ
-- "trọng điểm quốc gia" sang "việc làm" sẽ đọc ra là đạt mục tiêu, còn thực tế thương
-- hiệu vừa đánh đổi thuộc tính này lấy thuộc tính kia.
--
-- MẪU SỐ là số bài CÓ TOÀN VĂN trong tháng, không phải toàn bộ kho. Cột `so_bai_xet`
-- luôn đi kèm `ty_le_pct` vì hai lý do: 87% tin bài trong kho không có URL lấy lại được
-- nên không bao giờ có toàn văn, và một tỷ lệ tính trên vài bài thì không nói xu hướng
-- nào. Giao diện phải hiện mẫu số cạnh tỷ lệ.
with bai_co_toan_van as (
    select
        mention_key,
        date_trunc('month', published_at)::date as thang
    from {{ source('raw', 'raw_news_mention') }}
    where body_text is not null
      and length(body_text) >= 200
      and published_at is not null
),

mau_so as (
    select thang, count(*) as so_bai_xet
    from bai_co_toan_van
    group by 1
),

dem as (
    select
        b.thang,
        a.ma_thuoc_tinh,
        count(distinct b.mention_key) as so_bai_gan
    from bai_co_toan_van as b
    join {{ ref('stg__news__attribute') }} as a using (mention_key)
    group by 1, 2
),

-- Tháng nào KHÔNG có bài nào gắn một thuộc tính vẫn phải có dòng với số 0: thiếu dòng
-- thì biểu đồ nối thẳng qua tháng đó và che mất quãng thuộc tính biến mất khỏi tin bài.
khung as (
    select m.thang, t.ma_thuoc_tinh
    from mau_so as m
    cross join (select unnest(array['national_key', 'industry_link', 'employability']) as ma_thuoc_tinh) as t
)

select
    k.thang,
    k.ma_thuoc_tinh,
    coalesce(d.so_bai_gan, 0)                                  as so_bai_gan,
    m.so_bai_xet,
    round(100.0 * coalesce(d.so_bai_gan, 0) / m.so_bai_xet, 1) as ty_le_pct,
    -- Dưới ngưỡng này thì tỷ lệ không nói xu hướng nào; giao diện làm mờ tháng đó.
    (m.so_bai_xet >= 10)                                       as du_mau
from khung as k
join mau_so as m using (thang)
left join dem as d on d.thang = k.thang and d.ma_thuoc_tinh = k.ma_thuoc_tinh
