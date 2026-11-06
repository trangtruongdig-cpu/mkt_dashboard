---
name: ibmc
description: Khung lý thuyết gốc của dashboard — đặt mục tiêu thương hiệu theo ba tầng kinh doanh → marketing → truyền thông. Đọc TRƯỚC khi thêm/sửa bất kỳ chỉ số, mục tiêu, bảng mart, biểu đồ hay nhãn nào liên quan tới doanh số, thị phần, tăng trưởng, lợi nhuận, thâm nhập, tần suất, lượng tiêu dùng, lựa chọn, trung thành, nhận biết thương hiệu, thuộc tính thương hiệu, share of voice, share of search; hoặc khi cần trả lời "chỉ số này đo cái gì, thuộc tầng nào". Dùng cả khi người dùng chỉ nói "thêm KPI", "sửa cây mục tiêu", "vẽ biểu đồ tăng trưởng".
---

# IBMC — khung đặt mục tiêu cho thương hiệu

Lý thuyết gốc của dashboard này, lấy từ khoá **"IBMC — Đặt mục tiêu cho thương hiệu (V2025)"**
(16 bài, giảng viên Trương Đình Trang, marketing PTIT).

Khoá học là **bản tổng hợp**, không phải nguồn gốc của các lý thuyết thành phần — xuất xứ
từng khái niệm ở [`ibmc-xuat-xu-ly-thuyet.md`](../../../docs/ly-thuyet/ibmc-xuat-xu-ly-thuyet.md).

| Tài liệu | Dùng khi |
|---|---|
| [`ibmc-khung-dat-muc-tieu.md`](../../../docs/ly-thuyet/ibmc-khung-dat-muc-tieu.md) | cần toàn văn khung, công thức, ba ma trận 2×2 |
| [`ibmc-anh-xa-ptit.md`](../../../docs/ly-thuyet/ibmc-anh-xa-ptit.md) | cần biết một khái niệm FMCG tương đương gì ở Học viện |
| [`ibmc-dau-vao-dau-ra.md`](../../../docs/ly-thuyet/ibmc-dau-vao-dau-ra.md) | cần biết chỉ số phục vụ quyết định nào, cần nguồn nào, còn thiếu gì |
| [`ibmc-xuat-xu-ly-thuyet.md`](../../../docs/ly-thuyet/ibmc-xuat-xu-ly-thuyet.md) | cần dẫn tác giả gốc, hoặc cần biết lý thuyết gốc có chỗ nào phản bác bài giảng |
| [`ibmc-doi-chieu-cascade.md`](../../../docs/ly-thuyet/ibmc-doi-chieu-cascade.md) | trước khi đề xuất đổi cấu trúc cây mục tiêu |
| [`ibmc-nguon/`](../../../docs/ly-thuyet/ibmc-nguon/00-danh-muc-bai.md) | cần tra lại nguyên văn một câu trong bài giảng |

## Luật gốc

```
Mục tiêu kinh doanh   →   Mục tiêu marketing   →   Mục tiêu truyền thông
(số liệu công ty)         (hành vi người học)        (nhận thức người học)
```

Muốn đạt **số liệu**, phải thay đổi **hành vi**; muốn thay đổi hành vi, phải thay đổi **nhận
thức**. Suy diễn chỉ chạy theo một chiều đó.

**Không tồn tại chỉ số mồ côi.** Mỗi KPI trỏ về một mục tiêu; mỗi mục tiêu tầng dưới trỏ về
mục tiêu tầng trên. Ràng buộc này kiểm ở `packages/shared/src/schemas/kpi-cascade.ts`, không
phải ở giao diện.

## Từ vựng ba tầng

| Tầng | Mục tiêu | Chỉ số gốc |
|---|---|---|
| **B** kinh doanh | Sale · Share · Growth · Profit | volume/value sale, volume/value share, brand growth vs category growth, marketing contribution |
| **M** marketing | Penetration · Frequency · Consumption · Choice–Loyalty | % tham gia ngành hàng, số lần dùng/kỳ, lượng & giá trị mỗi lần, thị phần trong giỏ hàng |
| **C** truyền thông | Awareness · Key attributes · Creative quality · Hiệu quả kênh | top-of-mind / spontaneous / aided, điểm từng thuộc tính, link test (persuasion, branding index), share of spend vs share of voice |

## Bảy quy tắc bắt buộc khi thêm hoặc sửa chỉ số

1. **Gắn tầng và mục tiêu trước khi viết dòng mã đầu tiên.** Không trả lời được "chỉ số này
   phục vụ mục tiêu nào ở tầng nào" thì chưa được thêm.
2. **Volume và value luôn đi cặp.** Mọi chỉ số doanh số/thị phần phải có cả mặt sản lượng và
   mặt giá trị, và hai mặt phải đặt cạnh nhau được trên màn hình. Dẫn đầu mặt này không kéo
   theo mặt kia (bài 2.1, 2.2).
3. **Không bao giờ hiện tăng trưởng thương hiệu mà thiếu tăng trưởng ngành bên cạnh.** Tăng
   nhanh hơn ngành mới là tăng thị phần; tăng chậm hơn ngành là **đang mất thị phần** dù số
   tuyệt đối vẫn tăng (bài 2.3). Tăng trưởng giá trị phải trừ trần tăng học phí và CPI.
4. **Nói đúng mức nhận biết đang đo.** Thị phần tìm kiếm ≈ *spontaneous awareness* đã thành
   hành vi, **không** phải top-of-mind. Lượt xem Wikipedia là *mức độ chú ý*. Không rút gọn
   thành "nhận biết thương hiệu" trống không (bài 5.1).
5. **Thuộc tính thương hiệu xem theo từng thuộc tính, mục tiêu đặt dạng cặp tăng–giữ.** Tăng
   thuộc tính đang nhắm trong khi **không giảm** thuộc tính đang mạnh. Số gộp che mất đúng
   thứ cần thấy (bài 5.1).
6. **Chỉ số chưa đo được vẫn nằm trong cây,** với trạng thái và điều kiện mở khoá. Cây mục
   tiêu là bản đồ **nhiệm vụ**, không phải bản đồ dữ liệu đang có.
7. **Một chỉ số chỉ dùng một định nghĩa thị trường, và ghi rõ trên nhãn.** Nhóm 5 trường đối
   sánh, lĩnh vực máy tính & CNTT (154.016 thí sinh mùa 2026), hay toàn quốc — ba mức cho ba
   con số khác nhau. Đặt cạnh nhau hai con số khác mức là so sánh lệch nguồn (bài 2.2).

## Quy tắc chọn mục tiêu — đừng chọn sai chiến lược

**Luật dẫn đầu (bài 3.3, 3.4).** Chỉ thương hiệu dẫn đầu, hoặc top 2 cách biệt, mới nên đi
giáo dục thị trường để tăng tần suất / lượng dùng. Đứng thứ ba trở xuống làm việc đó là bỏ
tiền tăng trưởng hộ đối thủ, vì người tiêu dùng chỉ nhớ nhãn đầu tiên trong tâm trí.

**Áp cho Học viện:** không phải top-of-mind trong lĩnh vực công nghệ thông tin → **không** đặt
mục tiêu kiểu "giáo dục thị trường về giá trị của việc học CNTT". Tập cầu đã có sẵn; bài toán
là **giành phần trong đó** bằng choice/share lấy từ đối thủ cụ thể, và thâm nhập phân khúc
hoặc địa bàn chưa ai sở hữu — bằng lợi ích **thực sự khác biệt**, không lặp thông điệp của
trường dẫn đầu.

**Ma trận chọn mục tiêu marketing:** thâm nhập thấp/cao × cạnh tranh thấp/cao → bốn nước đi
khác nhau. **Ma trận đọc tăng trưởng:** doanh số tăng/giảm × nhanh/chậm hơn ngành → bốn chẩn
đoán thị phần. **Ma trận sức khoẻ ngành:** volume × value growth → bốn chẩn đoán ngành. Cả ba
ở [khung gốc §1.3, §1.4, §2.5](../../../docs/ly-thuyet/ibmc-khung-dat-muc-tieu.md).

## Ba cặp khái niệm không được lẫn

| | |
|---|---|
| **Market share** (thị phần kênh bán lẻ → *thị phần nhập học*) | **Loyalty/Choice** (thị phần trong giỏ hàng → *thứ hạng nguyện vọng trong phiếu*) |
| **Volume** ở tầng B = **sản lượng**, đối lập với *value* | **Consumption** ở tầng M = *lượng tiêu dùng* — hai nửa: consumption volume và consumption value |
| **Chỉ tiêu tuyển sinh** = năng lực cung (≈ năng lực sản xuất) | **Nhập học** = doanh số thật. Lẫn hai thứ là tự khen bằng con số đầu vào |

## Chỗ lý thuyết gốc phản bác bài giảng — biết trước khi đặt mục tiêu

**Ehrenberg-Bass / Byron Sharp (*How Brands Grow*, 2010) phản bác đòn "ngành bão hoà thì
chuyển sang tần suất và trung thành"** (bài 3.3). Theo Sharp, tăng trưởng đến **chủ yếu từ
thâm nhập**; thâm nhập dao động mạnh giữa các nhãn còn tần suất mua thì gần như không
(*double jeopardy*). Hệ quả cụ thể cho dashboard này: **nhánh `mkt_frequency` phải để kỳ
vọng thấp** — đại học → sau đại học → ngắn hạn là nhánh có trần thấp nhất. Cả hai trường
phái vẫn dẫn tới cùng một kết luận cho PTIT: đi lấy thâm nhập và lựa chọn trong tập cầu có
sẵn, không mở rộng ngành.

**DAGMAR (Colley, 1961) và Lavidge–Steiner (1961) phản bác câu "không bán được hàng thì
không hiệu quả"** (bài 1) ở cấp chiến dịch: doanh số tức thời là thước đo *không đầy đủ* của
truyền thông. Nên **không gán KPI doanh số cho một chiến dịch truyền thông** — quy trách
nhiệm doanh số cho một chiến dịch là đúng cái lỗi DAGMAR ra đời để chặn. Marketing chịu
trách nhiệm doanh số; một chiến dịch thì không.

**PIMS bị thách thức:** quan hệ thị phần → lợi nhuận không phải định luật (Wernerfelt;
Rumelt & Wensley). Đừng trình bày nó như nhân quả đã chứng minh.

## Những chỗ đã cố ý đi khác bài giảng — đừng "sửa cho đúng lý thuyết"

- `GrowthSourceSchema` tách `choice` và `loyalty` thành hai nguồn (bài 3.3 gộp làm một). Lý
  do: với đào tạo, *được chọn lúc xét tuyển* và *giữ chân sau nhập học* cách nhau 4–5 năm và
  dùng dữ liệu khác nhau.
- Ngưỡng *marketing contribution ≥ 40%* của bài 2.5 **không** áp cho trường công lập. Giữ lại
  cấu trúc — mọi đồng chi ra quy về một đơn vị kết quả — chứ không giữ con số.
- Bốn thứ không có đường đo bằng dữ liệu công khai: top-of-mind, aided awareness, creative
  quality theo link test, share of spend. Để trạng thái chưa đo được kèm điều kiện mở khoá.

## Trạng thái cây mục tiêu

Cây đã được dựng lại đúng khung ngày 06/11/2026 — **13 mục tiêu (4 kinh doanh · 5 marketing ·
4 truyền thông), 39 chỉ số**. Bảy điểm lệch so với khung gốc đã sửa trọn; lịch sử và lý do ở
[`ibmc-doi-chieu-cascade.md`](../../../docs/ly-thuyet/ibmc-doi-chieu-cascade.md). Đọc trước
khi đề xuất đổi cấu trúc, để không mở lại việc đã phân tích.

Hai bất biến phải giữ:

- **`kpiKey` bất biến.** Bảng `kpi_target_override` khoá theo `kpiKey`; đổi khoá làm mức cần
  đạt người dùng đã chốt thành mồ côi, và `findOrphanOverrides` chỉ ghi cảnh báo chứ không
  ngã — tức là mục tiêu mất hiệu lực âm thầm. Thêm chỉ số mới thì dùng khoá mới.
- **Khung ba tầng được khoá bằng test.** `apps/api/src/modules/kpi/kpi-cascade-structure.spec.ts`
  khẳng định tầng kinh doanh đúng bốn con số, `growthSource` chỉ ở tầng marketing, và tăng
  trưởng thương hiệu luôn có tăng trưởng ngành đặt cạnh. Test đỏ ở file đó nghĩa là thay đổi
  vừa rồi đã rời khỏi khung, không phải test sai.

Thêm/bớt chỉ số, đổi mục tiêu, đổi cách đo là **phạm vi nhiệm vụ nghiên cứu, không phải quyết
định kỹ thuật** — phải hỏi người dùng, theo `.claude/hooks/tham-dinh.md` nhóm cấm số 1.
