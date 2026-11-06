-- Thuộc tính thương hiệu gán cho từng tin bài.
--
-- 1:1 với bảng thô, chỉ đổi tên cột sang tiếng Việt và tách chuỗi cụm đã khớp thành
-- mảng để tầng sau đếm được mà không phải tự tách chuỗi.
select
    mention_key                       as mention_key,
    attribute_key                     as ma_thuoc_tinh,
    matched                           as cum_da_khop,
    array_length(string_to_array(matched, ' | '), 1) as so_cum_khop,
    tagged_at                         as thoi_diem_gan
from {{ source('raw', 'news_attribute') }}
