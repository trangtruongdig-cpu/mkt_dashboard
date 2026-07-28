-- Tin bài đã gán nhãn thương hiệu, trải mỗi nhãn thành một dòng.
--
-- Một bài so sánh điểm chuẩn nhắc cả sáu trường thì sinh sáu dòng — đó là ĐÚNG, vì thị
-- phần thảo luận đếm số lần một trường được nhắc tới, không đếm số bài "thuộc về" ai.
--
-- Bài không khớp trường nào bị loại ở đây (hơn một nửa kho): chúng lọt vào qua từ khoá
-- tìm kiếm nhưng nội dung không nhắc trường nào trong nhóm đối sánh.
with da_gan_nhan as (
    select
        mention_key,
        canonical_url,
        publisher,
        published_at,
        is_owned,
        brands
    from {{ source('raw', 'raw_news_mention') }}
    where brands is not null and brands != '[]'
)

select
    m.mention_key,
    m.canonical_url                     as duong_dan,
    m.publisher                         as bao,
    m.published_at                      as thoi_diem_dang,
    m.published_at::date                as ngay_dang,
    m.is_owned                          as la_kenh_cua_ta,
    b.value #>> '{}'                    as ma_truong
from da_gan_nhan as m
cross join lateral jsonb_array_elements(m.brands::jsonb) as b(value)
