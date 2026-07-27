-- Chạy đúng MỘT LẦN, lúc khởi tạo volume dữ liệu lần đầu.
-- Sửa file này sau đó sẽ không có tác dụng; muốn áp dụng lại phải xoá volume pgdata.

-- Metabase giữ dashboard, câu truy vấn và tài khoản của nó ở cơ sở dữ liệu riêng.
-- Tách ra để sao lưu kho phân tích không kéo theo dữ liệu nội bộ của Metabase, và
-- để xoá làm lại Metabase không đụng gì tới dữ liệu marketing.
CREATE DATABASE metabase;

\connect ptit_dashboard

-- Ba lược đồ, ranh giới sở hữu rõ ràng:
--   raw   — worker Python đổ vào, KHÔNG ai được sửa tay
--   stg   — dbt: ép kiểu, đổi tên cột, 1:1 với bảng thô
--   mart  — dbt: bảng phục vụ dashboard, đây là hợp đồng dữ liệu với backend
CREATE SCHEMA IF NOT EXISTS raw;
CREATE SCHEMA IF NOT EXISTS stg;
CREATE SCHEMA IF NOT EXISTS mart;

COMMENT ON SCHEMA raw IS 'Dữ liệu thô do worker hút về. Chỉ ghi bằng job, không sửa tay.';
COMMENT ON SCHEMA stg IS 'Tầng chuẩn hoá của dbt. Không dùng trực tiếp cho báo cáo.';
COMMENT ON SCHEMA mart IS 'Bảng phục vụ dashboard. Backend chỉ được đọc ở đây.';
