# Đầu vào và đầu ra của dự án, đọc theo khung IBMC

Tài liệu này trả lời câu hỏi mà một dự án dashboard rất dễ bỏ qua: **hệ thống này nhận
vào cái gì, và đẩy ra cái gì.** Không trả lời được hai câu đó thì dashboard trở thành một
bộ sưu tập biểu đồ — đúng thứ [khung IBMC](ibmc-khung-dat-muc-tieu.md) tồn tại để ngăn.

Nguyên tắc sắp xếp: **đầu ra định nghĩa đầu vào.** Bắt đầu từ quyết định cần hỗ trợ, đi
ngược về dữ liệu phải có. Làm ngược lại — thu được gì thì vẽ cái đó — là cách sinh ra chỉ
số mồ côi.

---

## 1. Đầu ra: ba quyết định, không phải ba màn hình

Mỗi tầng của cascade phục vụ **một loại quyết định, của một người khác nhau, theo một nhịp
khác nhau.** Đây là đầu ra thật của hệ thống; biểu đồ chỉ là hình thức trình bày.

| Tầng | Câu hỏi quyết định | Ai quyết | Nhịp | Sản phẩm đẩy ra |
|---|---|---|---|---|
| **Kinh doanh** | Mùa tới đặt chỉ tiêu bao nhiêu, ở hệ nào, và xin bao nhiêu ngân sách? | Ban Giám đốc, Hội đồng Học viện | mỗi mùa tuyển sinh | Báo cáo mục tiêu mùa: nhập học · doanh thu học phí · thị phần · tăng trưởng so với lĩnh vực · chi phí trên mỗi người nhập học |
| **Marketing** | Mùa tới lấy tăng trưởng từ nguồn nào — thâm nhập, lựa chọn, hay giá trị? | Phòng tuyển sinh, phòng truyền thông | mỗi mùa, soát giữa mùa | Quyết định chọn nguồn tăng trưởng, kèm địa bàn và nhóm ngành ưu tiên |
| **Truyền thông** | Tuần này nói gì, trên kênh nào, và chiến dịch vừa rồi có hiệu lực không? | Người làm nội dung, người điều phối kênh | hằng tuần | Bản tin tuần: nhận biết · thuộc tính nào đang lên xuống · độ phủ báo chí · nội dung nào giữ được người xem |

**Đầu ra thứ tư, không nằm trong cascade:** hồ sơ nghiệm thu của nhiệm vụ. Nó cần chứng
minh được hệ thống *dựng lại được* và *mọi con số truy được xuất xứ* — nên provenance và
`docs/` là sản phẩm, không phải phụ kiện.

### Quy tắc phân nhịp, suy từ lý thuyết

Ba tầng **không cùng nhịp**, và trộn nhịp là một lỗi có thật:

- Tầng kinh doanh chỉ đổi **mỗi năm một lần** (số nhập học công bố một lần/mùa). Dựng
  biểu đồ tuần cho nó là vẽ nhiễu.
- Tầng truyền thông đổi **hằng ngày**. Đọc nó theo nhịp năm là mất hết khả năng can thiệp.
- Vì vậy không tồn tại MỘT kỳ báo cáo chung cho cả bảng — đúng như nhãn kỳ mà
  `PostgresKpiRepository` đang đặt: *"mỗi chỉ số theo nhịp riêng"*.

---

## 2. Đầu vào: bốn nhóm nguồn, theo mức sẵn sàng

| Nhóm | Nguồn cụ thể | Nuôi tầng nào | Trạng thái |
|---|---|---|---|
| **Công khai bắt buộc** | Biểu 18 (Thông tư 09/2024), đề án tuyển sinh, thông báo điểm chuẩn của Học viện và 5 trường đối sánh | kinh doanh, marketing | một phần — Biểu 18 cho quy mô đào tạo, KHÔNG cho số nhập học mới |
| **Hành vi trên tài sản của Học viện** | GA4 trên `tuyensinh.ptit.edu.vn`, Matomo tự dựng | marketing, truyền thông | **đã chảy thật** — nguồn duy nhất đang cấp số đều |
| **Quan sát từ bên ngoài** | news-please quét báo Việt + PhoBERT; YouTube, Reddit + ViSoBERT; lượt xem Wikipedia | truyền thông | đã chảy thật |
| **Chưa có đường vào** | thống kê nguyện vọng theo lĩnh vực của Bộ GD&ĐT; dự toán truyền thông nội bộ; khảo sát thí sinh; dữ liệu nguyện vọng theo trường | kinh doanh (growth, profit), truyền thông (nhận biết thật) | chưa — xem §4 |

### Chuỗi biến đổi, từ nguồn tới quyết định

```
nguồn  →  Airbyte / worker Python  →  PostgreSQL thô  →  dbt stg__ → int__ → mart__
                                                                              ↓
         quyết định  ←  cascade ba tầng  ←  zod schema (packages/shared)  ←  NestJS đọc mart
```

Hai ràng buộc giữ chuỗi này không trôi:

1. **`packages/shared` là nguồn sự thật duy nhất của hình dạng dữ liệu.** Backend và
   frontend dùng chung một bộ zod schema, nên lệch kiểu trở thành lỗi biên dịch.
2. **Mỗi chỉ số bắt buộc có `provenance` và `requirement`.** Chỉ số chưa có nguồn vẫn hiện
   trên màn hình kèm việc còn phải làm — khoảng trống trở thành hàng đợi công việc.

---

## 3. Bảng đối chiếu: mỗi đầu ra cần đầu vào nào

Đọc theo chiều *muốn ra quyết định này thì phải có dữ liệu kia*.

| Quyết định cần hỗ trợ | Chỉ số bắt buộc | Nguồn | Có chưa |
|---|---|---|---|
| Đặt chỉ tiêu mùa tới | `enrolment_vs_quota`, `admission_quota` | đề án tuyển sinh | một phần |
| Biết mình đang lớn hay nhỏ lại | `enrolment_share` | Biểu 18 + đề án của 6 trường | chưa đủ mẫu số |
| **Biết tăng trưởng có khoẻ hay không** | `enrolment_growth` **cạnh** `category_enrolment_growth`, và `growth_vs_category_gap` | Biểu 18 + thống kê Bộ GD&ĐT | **chưa — xem §4.1** |
| Xin ngân sách mùa sau | `cost_per_enrolment`, `marketing_budget_ratio` | dự toán nội bộ | **chưa — xem §4.2** |
| Chọn nguồn tăng trưởng | `high_value_mix`, `postgrad_intake_share`, `score_premium` | đề án + Biểu 18 | một phần |
| Biết mình có trong tập cân nhắc | `share_of_search`, `attention_share` | Google Trends, Wikipedia | **Trends đã bị chặn — §4.3** |
| Biết nói gì tuần này | ba chuỗi `attribute_*` | kho tin bài + bước trích thuộc tính | chưa có bước trích |
| Biết nội dung có hiệu lực | `social_engagement_rate`, `creative_hold_rate` | GA4; API nghiên cứu nền tảng | một phần |

---

## 4. Bốn chỗ thiếu đầu vào, và cái giá của từng chỗ

Xếp theo mức thiệt hại nếu không lấp.

### 4.1 Thống kê nguyện vọng theo lĩnh vực của Bộ GD&ĐT — thiếu nghiêm trọng nhất

Không có nó thì **không tính được tăng trưởng ngành**, và theo bài 2.3 thì tăng trưởng
thương hiệu đứng một mình là con số gây hiểu sai. Đây là lý do tầng `biz_growth` hiện có
bốn chỉ số mà chưa chỉ số nào có số.

*Đường lấy:* số liệu được Bộ công bố rải trong các bản tin và họp báo tuyển sinh, không có
bảng ổn định theo năm. Việc cần làm là bóc tay một lần cho các mùa đã qua, lưu thành chuỗi,
rồi cập nhật mỗi mùa. Không cần xin phép ai.

### 4.2 Dự toán truyền thông tuyển sinh nội bộ

Không có nó thì toàn bộ tầng `biz_profit` trống, và dashboard chứng minh được *hiện diện*
nhưng không chứng minh được *hiệu quả đồng tiền* — đúng khoảng trống bài 1 cảnh báo.

*Đường lấy:* cần Học viện đồng ý cung cấp. Đây là **việc đối ngoại nội bộ, không phải việc
kỹ thuật**: không có nguồn công khai nào thay thế. Mẫu số đã có sẵn (`admission_consideration_views`
từ GA4), chỉ thiếu tử số.

### 4.3 Thị phần tìm kiếm — chỉ số lý thuyết mạnh nhất, hiện không lấy được

Đây là nghịch lý đáng ghi lại: theo Les Binet (IPA, 2020), *share of search* đi cùng thị
phần và **báo trước thay đổi thị phần vài tháng, có khi tới một năm** — tức là tín hiệu sớm
tốt nhất mà một thương hiệu có thể lấy miễn phí. Nhưng Google đã chặn truy cập Trends, nên
`share_of_search` hiện không có số liệu.

*Đường lấy:* chưa có đường sạch. Hai hướng còn lại, cả hai đều yếu hơn: lượt xem Wikipedia
(`attention_share`, đang chạy) và dữ liệu Search Console của chính Học viện (chỉ cho truy vấn
dẫn tới website mình, không cho so sánh với trường khác).

### 4.4 Tình báo đối thủ — chỗ thiếu âm thầm nhất

Khung IBMC **không chạy được mà không có số liệu đối thủ**: thị phần cần mẫu số, tăng trưởng
cần mốc ngành, premiumisation cần biết đối thủ định giá thế nào. Đo thực tế trong kho ngày
06/11/2026 cho thấy mẫu số đang rất mỏng:

| Dữ liệu đối thủ | Thực có trong kho |
|---|---|
| Nhập học theo mùa | chỉ `hust` (5 năm) và `ptit` (3 năm). `uet` bóc ra 4 dòng nhưng **0 dòng có sản lượng**. `uit`, `fpt`, `actvn`: không dòng nào |
| Điểm chuẩn | chỉ `ptit` (28 ngành) và `uet` (20 ngành), riêng năm 2025 |
| Học phí | **không có bước bóc tách nào trong toàn bộ repo** |

Hệ quả phải nói thẳng: `biz_share`, `biz_growth` và các chỉ số giá trị sẽ ở trạng thái chưa
có số trong thời gian tới **không phải vì thiếu mã, mà vì thiếu dữ liệu đối thủ**. Với 2 trong
6 trường có sản lượng, mọi con số thị phần tính ra lúc này đều sai mẫu số.

*Đường lấy:* Biểu 18 và đề án tuyển sinh của cả 6 trường đều là tài liệu **buộc công khai**
— nên đây là việc lập trình, không cần xin phép. Khó ở chỗ mỗi trường đăng một định dạng
khác nhau (có trường dựng bảng bằng JavaScript, có trường chỉ đăng danh sách trúng tuyển,
có trường xét học bạ nên không có thang điểm 30).

### 4.5 Khảo sát thí sinh

Không có nó thì **ba mức nhận biết của bài 5.1 không đo được** — top of mind, aided
awareness, message recall, purchase intent đều cần phỏng vấn. Mọi chỉ số nhận biết hiện tại
là proxy hành vi tìm kiếm, và nhãn trên giao diện phải nói đúng điều đó.

*Đường lấy:* một đợt khảo sát thí sinh mỗi mùa, có thể làm cùng khâu nhập học. Rẻ nếu gắn
vào quy trình đã có, đắt nếu làm riêng.

---

## 5. Hiện trạng: cây mục tiêu đo được tới đâu

Số liệu tính từ cây mục tiêu sau khi dựng lại theo khung (06/11/2026):

| Tầng | Mục tiêu | Chỉ số | Đã có số |
|---|---|---|---|
| Kinh doanh | 4 | 11 | 2 |
| Marketing | 5 | 10 | 5 |
| Truyền thông | 4 | 18 | 4 |
| **Tổng** | **13** | **39** | **11** |

Đọc con số 11/39 cho đúng: đây **không** phải mức hoàn thành 28%. Cây mục tiêu là bản đồ
nhiệm vụ, nên phần lớn ô trống là *việc chưa làm*, và ba trong bốn chỗ thiếu ở §4 là chỗ
cần người quyết chứ không cần thêm mã.

Phân bố nghiêng về tầng truyền thông (18 chỉ số, 4 đã có số) phản ánh đúng thực tế của dự
án: quan sát từ bên ngoài thì rẻ và làm được ngay, còn số liệu nội bộ của Học viện mới là
phần khó. Nghiêng như vậy là tình trạng cần biết, không phải thiết kế mong muốn — vì tầng
truyền thông là tầng xa quyết định kinh doanh nhất.

---

## 6. Việc tiếp theo, theo thứ tự giá trị trên công sức

| | Việc | Mở khoá được gì | Cần ai |
|---|---|---|---|
| 1 | Bóc bảng kết quả tuyển sinh trong đề án của **cả 6 trường** | mẫu số của `enrolment_share`, và số thật cho `enrolment_growth`. Hiện chỉ 2/6 trường có sản lượng nên mọi con số thị phần đều sai mẫu số | chỉ cần lập trình |
| 2 | Bóc thống kê nguyện vọng theo lĩnh vực của Bộ GD&ĐT | mốc ngành cho cả tầng `biz_growth` — quy tắc chịu lực nhất của khung | chỉ cần lập trình |
| 3 | Bước trích thuộc tính trong `apps/worker/nlp` | ba chuỗi `attribute_*`, tức quy tắc cặp tăng–giữ | chỉ cần lập trình |
| 4 | Bóc học phí công bố của 6 trường | value share và các chỉ số giá trị; hiện repo không có bước nào đọc học phí | chỉ cần lập trình |
| 5 | Xin dự toán truyền thông tuyển sinh | cả tầng `biz_profit` | **Học viện quyết** |
| 6 | Gắn khảo sát thí sinh vào khâu nhập học | ba mức nhận biết thật, thay cho proxy | **Học viện quyết** |

Bốn việc đầu không cần xin phép ai — tài liệu nguồn đều là tài liệu buộc công khai. Hai việc
cuối cần Học viện quyết, và đó là lý do chúng nằm cuối danh sách chứ không phải vì ít giá trị.
