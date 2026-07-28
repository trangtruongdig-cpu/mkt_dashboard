# Bản yêu cầu thẩm định — dùng chung cho quan toà và hội đồng phản biện

Tài liệu này là nguồn sự thật cho nội dung hai hook thẩm định trong
`.claude/settings.json`. Sửa ở đây thì phải sửa sang đó, và ngược lại.

Tách ra thành file riêng vì hai lý do: prompt dài nhét vào JSON thì không ai đọc
được, và hội đồng nghiệm thu cần thấy tiêu chí thẩm định bằng văn bản chứ không
phải moi ra từ một chuỗi escape.

---

## Vì sao cần tầng này

Bộ gác cơ học (`guard.py`) khớp mẫu lệnh. Nó chặn được `rm -rf`, chặn được bí mật
lọt vào git, chặn được lệnh xoá việc của phiên khác. Nó **không** biết một hàm viết
sai, một kiểu dữ liệu khai trùng, hay một quyết định kiến trúc đi ngược cam kết
trong CLAUDE.md.

Muốn gác được cái đó thì phải có thứ đọc hiểu được diff. Đó là việc của hai tầng
dưới đây.

## Ba tầng, chặn ở ba mốc khác nhau

| Tầng | Mốc chặn | Cơ chế | Chi phí |
|---|---|---|---|
| 1 · Bộ gác | mọi lệnh Bash, mọi lần ghi file | khớp mẫu, không gọi LLM | ~0 |
| 2 · Quan toà | trước `git commit` | agent đọc diff staged | một lượt gọi model |
| 3 · Phản biện | trước `git push` | agent soát toàn bộ chênh lệch với origin | một lượt gọi model |

Mốc chặn đặt ở commit và push là có chủ đích: đó là hai chỗ công việc chuyển từ
"đang thử" sang "đã nhận". Chặn sớm hơn thì cản trở việc thử nghiệm; chặn muộn
hơn thì đã ra khỏi máy.

---

## Tiêu chí — quan toà (trước commit)

Bốn ống kính. Chỉ CHẶN khi vi phạm rõ ràng một điều ghi thành chữ trong CLAUDE.md;
nghi ngờ thì cho qua và ghi chú. Phiên chạy đêm mà bị chặn oan thì đứng im tới sáng.

### A · Ngăn xếp (mục 2)

- Có thêm dependency nào ngoài ngăn xếp đã chốt không?
- Có thư viện nào nằm trong danh sách "Không dùng" không: FastAPI, Django, Flask,
  Express trần, Prisma, TypeORM, Redux, styled-components, Chart.js, Recharts,
  Streamlit, Dash, Superset, Airflow, Dagster, MongoDB, Celery.
- Dependency mới có ghi giấy phép trong commit message không? Giấy phép có thuộc
  MIT / Apache-2.0 / BSD / GPL-tương thích không?

### B · Hợp đồng dữ liệu (mục 4, 5, 9)

Đây là ống kính quan trọng nhất — sai ở đây thì lỗi chỉ hiện ra lúc chạy thật.

- DTO có phải zod schema đặt ở `packages/shared` không? Có `interface` hay `type`
  nào mô tả response API nằm trong `apps/api` hoặc `apps/web` không? Có là sai.
- Sửa lược đồ dữ liệu có đồng bộ đủ **ba nơi** không: dbt model → `schema.yml` →
  zod schema ở `packages/shared`. Thiếu một nơi là thay đổi chưa hoàn thành.
- Bảng `mart__*` có bị khai thành Drizzle schema không? Không được — chỉ đọc bằng
  `db.execute(sql\`...\`)` trong repository.
- Có SQL nằm trong controller hay service không? Truy vấn phải ở repository.

### C · Chất lượng bắt buộc (mục 4, 5, 6)

- Có `any` hay `@ts-ignore` không? Cấm tuyệt đối.
- Endpoint mới có `@ApiOperation` mô tả tiếng Việt không?
- Endpoint mới có ít nhất một test happy path và một test lỗi không?
- Component biểu đồ có tự fetch dữ liệu không? Không được — nhận qua props.
- Có hardcode mã màu hex trong component không? Màu định nghĩa một chỗ trong
  Tailwind theme.
- Worker Python có thêm HTTP API không? Không được — nó là tiến trình chạy theo lịch.
- Job ghi dữ liệu có idempotent không (`ON CONFLICT`)? Chạy lại không được nhân đôi.

### D · Bí mật và dữ liệu thật (mục 4, 9)

- Diff có chứa token, client secret, refresh token, chuỗi kết nối không?
- Có file `.env` hay `.secrets/` nào bị đưa vào không?
- Có dữ liệu vận hành thật của Học viện bị đưa vào repo công khai không?

---

## Tiêu chí — hội đồng phản biện (trước push)

Chạy lại toàn bộ bốn ống kính trên cho **mọi commit chưa push**, cộng thêm:

### E · Tính dựng lại được (mục 3, 8)

- `docker compose up -d` còn dựng được toàn hệ thống không?
- Biến môi trường mới có mặt trong `.env.example` kèm chú thích tiếng Việt không?
- Có bước cấu hình thủ công nào không được ghi tài liệu không?

### F · Phản biện thật sự

Không chỉ soát tuân thủ. Nêu ra:

- Chỗ nào trong thay đổi này sẽ hỏng khi dữ liệu thật thay thế dữ liệu giả lập?
- Có phép so sánh nào lệch nguồn không — hai con số cạnh nhau nhưng đến từ hai
  nguồn khác nhau?
- Có con số nào hiển thị mà không truy được xuất xứ không?
- Nhãn trên giao diện có nói đúng thứ nó đang hiển thị không?

Ống kính F **không dùng để chặn**. Nó ghi vào lý do trả về để sáng hôm sau người
đọc nhật ký biết cần xem lại chỗ nào.

---

## Quy tắc ra quyết định

CHẶN khi và chỉ khi có ít nhất một vi phạm rõ ràng ở ống kính A, B, C hoặc D, và
vi phạm đó chỉ ra được bằng một dòng cụ thể trong diff.

Mọi trường hợp khác: cho qua.

Lý do trả về phải nêu đường dẫn file và số dòng. "Có vẻ chưa ổn" không phải lý do
chặn hợp lệ — người đọc nhật ký lúc 7 giờ sáng không có gì để làm với câu đó.

---

## Tiêu chí — trả lời thay khi phiên hỏi người dùng (tầng 4)

Khi một phiên gọi `AskUserQuestion`, người dùng đang ngủ. Để câu hỏi treo tới sáng
là mất trắng cả đêm. Quan toà trả lời thay, nhưng chỉ trong phạm vi dưới đây.

### Được quyết thay

Câu hỏi mà **CLAUDE.md đã trả lời sẵn**, hoặc mã nguồn hiện tại đã ngầm trả lời:

- Chọn thư viện, chọn cách đặt tên, chọn cấu trúc thư mục → mục 2, 3.
- Đặt DTO ở đâu, đọc bảng mart thế nào, viết migration ra sao → mục 4.
- Server component hay client component, fetch bằng gì, style bằng gì → mục 5.
- Đặt tên model dbt, tầng nào, test gì → mục 7.
- Câu hỏi kiểu "làm A hay B" mà một phương án vi phạm CLAUDE.md → chọn phương án
  còn lại.
- Câu hỏi kiểu "có nên thêm test / thêm chú thích / tách hàm không" → luôn là có.

Trả lời bằng cách nêu rõ phương án chọn VÀ điều khoản làm căn cứ.

### KHÔNG được quyết thay — phải để lại cho người dùng

Bốn nhóm này chạm tới thứ nằm ngoài mã nguồn. Đoán sai thì sáng ra không sửa lại
được bằng một commit:

1. **Phạm vi nhiệm vụ.** Thêm/bớt chỉ số, đổi mục tiêu, đổi cách đo. Đây là nội
   dung nhiệm vụ nghiên cứu đã được phê duyệt, không phải quyết định kỹ thuật.
2. **Ra ngoài.** Triển khai, publish, gửi dữ liệu đi đâu, mở quyền truy cập.
3. **Không hồi phục.** Xoá dữ liệu, viết lại lịch sử, đổi lược đồ đã có dữ liệu thật.
4. **Đối ngoại của Học viện.** Xin quyền truy cập nền tảng, liên hệ đơn vị bên
   ngoài, bất cứ thứ gì cần con dấu hay chữ ký.

Với bốn nhóm này: **không chọn phương án nào**. Trả lời rằng câu hỏi để lại cho
người dùng, rồi chỉ ra phần việc khác phiên đó có thể làm tiếp trong lúc chờ. Mục
tiêu là phiên không đứng im, chứ không phải ép ra một quyết định.

### Dạng trả lời

Dòng đầu: `QUYẾT THAY: <phương án>` hoặc `ĐỂ LẠI CHO NGƯỜI DÙNG`.
Dòng sau: căn cứ, ngắn gọn, có dẫn điều khoản.
Dòng cuối (chỉ khi để lại): `LÀM TIẾP: <việc khác không phụ thuộc câu trả lời>`.
