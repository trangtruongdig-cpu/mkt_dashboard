# Ánh xạ IBMC sang bối cảnh Học viện

Khung [IBMC](ibmc-khung-dat-muc-tieu.md) sinh ra cho ngành hàng tiêu dùng nhanh. Dashboard
này dùng nó cho một **trường đại học công lập**. Tài liệu này ghi lại từng phép dịch, kèm
chỗ nào dịch được, chỗ nào chỉ có proxy, chỗ nào **không** dịch được.

Nguyên tắc tự áp: thà ghi "không ánh xạ được" còn hơn gán một chỉ số gần gần rồi để người
đọc tưởng đã đo được.

---

## 0. Trước mọi phép dịch: "ngành hàng" của Học viện là gì?

Bài 2.2 nói thẳng rằng **định nghĩa thị trường quyết định con số thị phần**. Với Học viện có
ba cách định nghĩa, cho ba con số hoàn toàn khác nhau:

| Mức | Định nghĩa | Độ lớn | Dùng cho |
|---|---|---|---|
| **Rộng** | toàn bộ tuyển sinh đại học chính quy cả nước | ~ hàng trăm nghìn/năm | bối cảnh, không dùng để đặt mục tiêu — thị phần ra con số nhỏ vô nghĩa |
| **Lĩnh vực** | thí sinh đăng ký lĩnh vực máy tính và công nghệ thông tin | 154.016 (mùa 2026) | **độ lớn tập cầu** và tăng trưởng ngành |
| **Nhóm đối sánh** | nhóm trường kỹ thuật – công nghệ cạnh tranh trực tiếp | 5 trường | **thị phần, share of voice, share of search** |

Quy tắc bắt buộc: **một chỉ số chỉ dùng một mức định nghĩa, và phải ghi rõ mức nào trên
nhãn.** Đặt cạnh nhau hai con số tính theo hai mức khác nhau là phép so sánh lệch nguồn —
đúng thứ ống kính F của [`tham-dinh.md`](../../.claude/hooks/tham-dinh.md) đi tìm.

---

## 1. Tầng B — mục tiêu kinh doanh

| Khái niệm gốc (FMCG) | Tương đương tại Học viện | Nguồn dữ liệu | Trạng thái |
|---|---|---|---|
| **Volume sale** — sản lượng | **Số người nhập học** trong mùa (người) | Biểu 18 (Thông tư 09/2024), đề án tuyển sinh | đo được |
| **Value sale** — doanh thu | **Doanh thu học phí** = nhập học × học phí/năm | Biểu 18 + quyết định học phí | đo được |
| *(không có trong FMCG)* | **Giá trị vòng đời một khoá** = học phí × số năm đào tạo | nội bộ | cần bổ sung — xem §1.1 |
| **Volume share** | Nhập học của Học viện / tổng nhập học nhóm đối sánh | đề án tuyển sinh các trường | đo được |
| **Value share** | Doanh thu học phí / tổng học phí nhóm đối sánh | Biểu 18 các trường | đo được |
| **Category size** | Tổng thí sinh đăng ký lĩnh vực máy tính & CNTT | công bố của Bộ GD&ĐT | đo được |
| **Category growth** | Tăng trưởng số thí sinh đăng ký lĩnh vực theo mùa | công bố của Bộ GD&ĐT | đo được |
| **Brand growth** | Tăng trưởng nhập học và doanh thu học phí của Học viện | Biểu 18 | đo được |
| **Marketing contribution** | (Học phí − chi phí đào tạo bình quân/người học) | dự toán nội bộ | chưa nối |
| **Trích lập quỹ marketing** | Ngân sách truyền thông tuyển sinh / doanh thu học phí | dự toán nhiệm vụ | chưa nối |
| **Cost per unit sold** | **Chi phí truyền thông trên mỗi người nhập học** | ngân sách + `mart__channel_performance` | khả thi, chưa làm |

### 1.1 Ba chỗ phép dịch bị lệch, phải biết trước khi dùng

**(a) Người học "mua" một lần, trả tiền nhiều năm.** Công thức gốc `doanh thu = sản lượng ×
giá` giả định mua–trả cùng kỳ. Với đào tạo, một khoá nhập học sinh ra dòng tiền trong 4–5
năm. Vì vậy phải tách rạch ròi hai con số, và **không được gọi cả hai là "doanh thu"**:

- *Doanh thu học phí trong năm* — gồm tất cả các khoá đang học, dùng cho báo cáo tài chính.
- *Giá trị một mùa tuyển sinh* — nhập học mùa đó × học phí × số năm, dùng cho đánh giá
  hiệu quả tuyển sinh. Đây mới là con số so được với chi phí truyền thông của mùa đó.

**(b) Chỉ tiêu không phải doanh số.** Chỉ tiêu tuyển sinh là **năng lực cung**, tương đương
*năng lực sản xuất* ở bài 2.1 — không phải sản lượng bán. Bài 2.1 nói rõ: bán hết hàng sản
xuất ra là một thành công, nhưng không phải là thoả mãn mục tiêu kinh doanh. Chỉ tiêu tăng
2,09 lần trong 4 năm là **mở rộng công suất**, kết quả phải đọc ở số nhập học thực và ở thị
phần. Lẫn hai thứ này là tự khen mình bằng con số đầu vào.

**(c) Trần học phí thay cho lạm phát.** Bài 2.3 buộc trừ lạm phát khỏi tăng trưởng giá trị.
Tại Học viện có hai mức chặn phải trừ: **trần tăng học phí theo quy định** (Nghị định
97/2023/NĐ-CP) và **CPI**. Doanh thu học phí tăng 10% trong năm học phí được phép tăng 15%
mà nhập học không tăng thì **không có tăng trưởng thật** — chỉ là trượt theo trần.

### 1.2 Bốn ô tăng trưởng, áp cho Học viện

Ma trận bài 2.3 giữ nguyên, chỉ đổi nội dung trục:

| | **Tăng nhanh hơn lĩnh vực CNTT** | **Tăng chậm hơn lĩnh vực CNTT** |
|---|---|---|
| **Nhập học tăng** | Được số, được thị phần | Được số nhưng **mất thị phần** cho trường khác — ô nguy hiểm nhất vì nhìn vào số tuyệt đối vẫn thấy đẹp |
| **Nhập học giảm** | Mất số nhưng **vẫn tăng thị phần** (toàn lĩnh vực giảm sâu hơn) | Mất cả hai |

Đây là biểu đồ **bắt buộc** của dashboard. Hiện chưa có — xem
[bản đối chiếu](ibmc-doi-chieu-cascade.md), điểm lệch số 4.

---

## 2. Tầng M — mục tiêu marketing

| Nguồn tăng trưởng | Tương đương tại Học viện | Đo bằng gì | Trạng thái |
|---|---|---|---|
| **Penetration** | Tỷ lệ thí sinh trong tập cầu đặt **ít nhất một nguyện vọng** vào Học viện; độ phủ địa bàn (số tỉnh/thành có thí sinh nhập học) | dữ liệu nguyện vọng của Bộ (không công khai theo trường) → proxy: thị phần tìm kiếm theo tỉnh, cơ cấu địa bàn nhập học | **proxy** |
| **Frequency** | Số lần một người học quay lại Học viện: đại học → sau đại học → đào tạo ngắn hạn | Biểu 18 (quy mô sau đại học / quy mô đại học) | đo thô được |
| **Consumption — volume** | Số tín chỉ/năm, học song ngành, học thêm chứng chỉ trong cùng một khoá | nội bộ, chưa có | **chưa ánh xạ** |
| **Consumption — value** | **Tỷ trọng nhập học hệ chất lượng cao / liên kết quốc tế** — đây đúng là phép *premiumisation* của bài 3.3 | đề án tuyển sinh | đo được |
| **Choice** | **Thứ hạng nguyện vọng** Học viện chiếm trong phiếu của thí sinh; **tỷ lệ nhập học trên trúng tuyển** | nội bộ + Biểu 18 | một phần |
| **Loyalty** | Tỷ lệ thôi học; tỷ lệ có việc làm sau 12 tháng; mức độ cựu người học nhắc lại Học viện | Biểu 18; `mart__social_mention` | một phần |

### 2.1 Phép dịch đẹp nhất: phiếu nguyện vọng chính là giỏ hàng

Bài 3.3 phân biệt dứt khoát market share (thị phần kênh **bán lẻ**) với loyalty (thị phần
trong **giỏ hàng** của người tiêu dùng). Phép dịch sang tuyển sinh khớp gần như một-một:

| Bài 3.3 | Tuyển sinh đại học |
|---|---|
| Giỏ hàng có 10 hộp sữa, 6 hộp Vinamilk → loyalty 60% | Phiếu đăng ký có N nguyện vọng, Học viện nằm ở nguyện vọng số mấy |
| Market share = thị phần kênh bán lẻ | Thị phần **nhập học** trong nhóm đối sánh |
| Trung thành không có nghĩa chỉ mua một nhãn | Thí sinh vẫn đặt nguyện vọng vào trường khác — chuyện bình thường |

Hệ quả đo lường: **thứ hạng nguyện vọng trung bình** là chỉ số choice đúng nghĩa nhất mà
tuyển sinh đại học có. Nó nằm trong dữ liệu nội bộ, chưa nối vào dashboard.

### 2.2 Luật dẫn đầu, áp cho Học viện — và đây là điều có hệ quả chiến lược

Bài 3.3 và 3.4: **chỉ thương hiệu dẫn đầu (hoặc top 2 cách biệt) mới nên đi giáo dục thị
trường để tăng tần suất / lượng dùng.** Đứng thứ ba trở xuống mà làm việc đó là bỏ tiền tăng
trưởng hộ đối thủ, vì người tiêu dùng chỉ nhớ nhãn đầu tiên trong tâm trí.

Trong lĩnh vực đào tạo công nghệ thông tin, Học viện **không** phải top-of-mind — vị trí đó
thuộc về nhóm trường kỹ thuật lâu năm hơn. Hai hệ quả bắt buộc:

1. **Không đặt mục tiêu kiểu "giáo dục thị trường về giá trị của việc học công nghệ thông
   tin".** Tập cầu 154.016 thí sinh đã có sẵn; mở rộng nó là tăng trưởng hộ trường dẫn đầu.
2. Mục tiêu phải là **choice và share lấy từ đối thủ cụ thể**, cộng với thâm nhập vào **phân
   khúc/địa bàn chưa ai sở hữu** — đúng ô "thâm nhập thấp, cạnh tranh cao" của ma trận bài
   3.4: vào bằng nhu cầu và lợi ích **thực sự khác biệt**, không lặp lại thông điệp của
   trường dẫn đầu.

Cây mục tiêu hiện tại đã đi đúng hướng này — lý do của `biz_penetration` viết: *"Đây là tập
cầu có sẵn, bài toán là giành phần trong đó chứ không phải tạo thêm nhu cầu."* Giữ nguyên
tinh thần đó khi mở rộng dashboard.

### 2.3 Ngành hàng của Học viện đang ở ô nào?

Theo bốn ô bài 2.4, lĩnh vực đào tạo công nghệ thông tin ở Việt Nam hiện **tăng cả sản lượng
lẫn giá trị**: số thí sinh đăng ký tăng, học phí tăng, và người học sẵn sàng trả cao hơn cho
hệ chất lượng cao. Đây là ô **ngành khoẻ mạnh** — điều kiện số 3 của bài 2.6 (chỉ đầu tư vào
ngành đang tăng trưởng) được thoả mãn.

Hệ quả: dư địa tăng trưởng của Học viện không bị chặn bởi ngành, mà bởi **vị thế cạnh tranh
trong ngành**. Đó là lý do cây mục tiêu đặt trọng tâm vào choice chứ không vào penetration.

---

## 3. Tầng C — mục tiêu truyền thông

| Khái niệm gốc | Tương đương tại Học viện | Đo bằng gì | Trạng thái |
|---|---|---|---|
| **Top of mind** | Trường đầu tiên thí sinh nhắc khi nghĩ tới học công nghệ thông tin | **cần khảo sát thí sinh** — không có nguồn thay thế | **không đo được** |
| **Spontaneous awareness** | Học viện có được nhắc tự nhiên trong tập cân nhắc | proxy: thị phần tìm kiếm (Google Trends), lượt tra cứu Wikipedia | **proxy** |
| **Aided awareness** | Nhận ra tên Học viện khi được nhắc | cần khảo sát | **không đo được** |
| **Key attributes** | Ba thuộc tính mục tiêu: *trọng điểm quốc gia*, *gắn với doanh nghiệp*, *ra trường có việc làm* | tỷ lệ tin bài/thảo luận gắn từng thuộc tính + sắc thái PhoBERT/ViSoBERT | **proxy, cần tách theo từng thuộc tính** |
| **Creative quality (link test)** | Nội dung tự giữ được người xem mà không chi tiền phân phối | cần quyền truy cập nghiên cứu của nền tảng | **không đo được** |
| **Message recall / brand recall / purchase intent** | — | cần khảo sát sau chiến dịch | **không đo được** |
| **Total brand communication awareness** | Nhận biết đến từ kênh nào trong một kỳ | `mart__share_of_voice` theo nguồn + `mart__channel_performance` | một phần |
| **Share of voice** | Tỷ trọng tin bài/thảo luận của Học viện trong nhóm đối sánh | `mart__share_of_voice` | đo được |
| **Share of spend** | Tỷ trọng ngân sách truyền thông so với nhóm đối sánh | không có tài khoản quảng cáo, không biết chi tiêu của trường khác | **không đo được** |

### 3.1 Nói đúng tên thứ đang đo

Bài 5.1 phân ba mức nhận biết bằng ba câu hỏi khảo sát khác nhau. Dashboard không có khảo
sát, nên **mọi chỉ số nhận biết trên màn hình đều là proxy hành vi tìm kiếm**, không phải
nhận biết đo bằng phỏng vấn. Cụ thể:

- **Thị phần tìm kiếm** đo người **đã nghĩ tới** Học viện và chủ động tra — gần với
  *spontaneous awareness* đã chuyển thành hành vi, **không phải** top-of-mind.
- **Lượt xem Wikipedia** đo mức độ **chú ý**, thấp hơn nữa trong phễu nhận thức.

Vì vậy nhãn trên giao diện phải là "thị phần tìm kiếm", "mức độ chú ý" — **không được** ghi
"top of mind" hay "nhận biết thương hiệu" trống không. Gọi sai tên là hứa một thứ chưa đo.

### 3.2 Quy tắc cặp tăng–giữ cho thuộc tính

Bài 5.1: tấn công một thuộc tính của đối thủ thì phải **tăng** điểm thuộc tính đó **trong khi
giữ** điểm thuộc tính mình đang mạnh. Áp cho Học viện: nếu muốn sở hữu *"ra trường có việc
làm"*, phải theo dõi đồng thời điểm *"trọng điểm quốc gia"* không tụt — nếu toàn bộ tin bài
chuyển sang nói việc làm và không còn nói vị thế, thương hiệu đổi chỗ chứ không mạnh thêm.

Yêu cầu kỹ thuật kéo theo: chuỗi thuộc tính phải **tách theo từng thuộc tính theo thời
gian**, không gộp thành một tỷ lệ "có gắn thuộc tính mục tiêu" duy nhất.

### 3.3 Khoảng trống không lấp bằng proxy

Bốn thứ sau **không** có đường đo bằng dữ liệu công khai: top-of-mind, aided awareness,
creative quality theo link test, share of spend. Chúng vẫn phải **nằm trong cây mục tiêu** với
trạng thái "chưa đo được" kèm điều kiện mở khoá (khảo sát thí sinh / quyền truy cập nền
tảng), vì cây mục tiêu là bản đồ **nhiệm vụ**, không phải bản đồ dữ liệu hiện có.

---

## 4. Bảng tra nhanh — chỉ số dashboard ↔ khái niệm gốc

| Chỉ số đang có | Khái niệm IBMC | Bài |
|---|---|---|
| `enrolment_vs_quota` — tỷ lệ nhập học trên chỉ tiêu | lấp đầy năng lực cung (≈ "bán hết hàng sản xuất ra") | 2.1 |
| `enrolment_share` — thị phần nhập học | **volume share** | 2.2 |
| `tuition_revenue` — doanh thu học phí | **value sale** | 2.1 |
| `high_value_mix` — tỷ trọng hệ giá trị cao | **consumption value** (premiumisation) | 3.3 |
| `score_premium` — chênh lệch điểm chuẩn | sức mạnh **choice** (cầu vượt cung so với đối sánh) | 3.3 |
| `postgrad_intake_share` — nhập học sau đại học / đại học | **frequency** | 3.3 |
| `dropout_rate`, `employment_rate` | **loyalty** (giữ chân) + bằng chứng cho **key attributes** | 3.3, 5.1 |
| `share_of_search` — thị phần tìm kiếm | proxy **spontaneous awareness** | 5.1 |
| `attention_share` — thị phần chú ý Wikipedia | proxy **awareness** mức thấp | 5.1 |
| `share_of_voice` — thị phần thảo luận báo chí | **share of voice** | 5.2 |
| `attribute_coverage` — tin bài gắn thuộc tính | **key attributes** (dạng gộp, cần tách) | 5.1 |
| `positive_sentiment_share`, `social_positive_sentiment_share` | chất lượng nhận thức — gần *brand image* | 5.1 |
| `publisher_breadth` — số đầu báo | proxy **hiệu quả kênh** (độ rộng thay cho tần suất tiếp cận) | 5.2 |
| `new_program_share`, `value_program_share` | hỗ trợ **penetration** phân khúc mới / **consumption value** | 3.2, 3.3 |
| `advocacy_mentions` | **loyalty** → lan toả | 3.3 |
| **chưa có** | **brand growth vs category growth** | 2.3 |
| **chưa có** | **profit / cost per enrolment** | 2.5 |
| **chưa có** | thứ hạng nguyện vọng (**choice** đúng nghĩa) | 3.3 |
