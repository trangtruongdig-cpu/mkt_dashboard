-- Thảo luận của người ngoài về Học viện trên mạng xã hội và diễn đàn.
--
-- Khác với `stg__news__mention` (báo chí viết về Học viện): ở đây là tiếng nói của người
-- dùng thường — bình luận YouTube, bài đăng Reddit, chủ đề diễn đàn.
--
-- Tầng này chỉ ép kiểu và đổi tên cột, không lọc gì. Việc quyết định bản ghi nào được
-- tính vào số liệu dư luận nằm ở tầng intermediate — để nhìn được cả phần bị loại.
select
    mention_key                       as ma_thao_luan,
    platform                          as nen_tang,
    source_name                       as ten_nguon,
    content_type                      as hat_du_lieu,
    parent_key                        as ma_bai_cha,
    url                               as duong_dan,
    title                             as tieu_de,
    body_text                         as noi_dung,
    body_chars::int                   as so_ky_tu,
    author_ref                        as ma_tac_gia,
    author_is_hashed                  as tac_gia_da_an_danh,
    published_at                      as thoi_diem_dang,
    like_count::int                   as so_luot_thich,
    reply_count::int                  as so_phan_hoi,
    view_count::bigint                as so_luot_xem,
    -- Cờ này quyết định bản ghi có được tính là "người ngoài nói" hay không. Video do
    -- chính Học viện đăng và bình luận của chủ kênh dưới video của mình đều là owned —
    -- gộp chung vào số liệu dư luận là thổi phồng độ phủ.
    is_owned                          as la_kenh_cua_hoc_vien,
    discovered_via                    as cach_phat_hien,
    search_term                       as tu_khoa_tim,
    first_seen_at                     as lan_dau_thay,
    last_seen_at                      as lan_cuoi_thay
from {{ source('raw', 'raw_social_mention') }}
