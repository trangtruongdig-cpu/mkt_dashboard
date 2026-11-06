# Đối chiếu cây mục tiêu đang cài với khung IBMC gốc

Soi [`kpi-cascade.ts`](../../packages/shared/src/schemas/kpi-cascade.ts) và
[`demo/cascade.ts`](../../packages/shared/src/demo/cascade.ts) theo
[khung lý thuyết gốc](ibmc-khung-dat-muc-tieu.md).

> **ĐÃ SỬA TRỌN BẢY ĐIỂM — 06/11/2026.** Người dùng duyệt làm cả phương án rẻ và phương án
> dựng lại nhãn ba tầng. Giữ lại toàn bộ phần phân tích bên dưới vì nó là *lý do* của thay
> đổi; mỗi điểm có một dòng **Đã sửa** ở cuối. Tình trạng sau khi sửa: §9.

Mỗi điểm lệch ghi: hiện trạng (có số dòng, theo bản TRƯỚC khi sửa) → lý thuyết nói gì → hệ
quả → đề xuất → đã sửa gì.

Tổng kết: **7 điểm lệch**, trong đó 2 điểm là lệch cấu trúc tầng (số 1, 2), 3 điểm là thiếu
nội dung lý thuyết đòi hỏi (số 4, 5, 6), 2 điểm là đặt tên và cách gộp số (số 3, 7).

Một quyết định thiết kế xuyên suốt khi sửa: **giữ nguyên mọi `kpiKey` đã có.** Bảng
`kpi_target_override` khoá theo `kpiKey`, nên đổi khoá chỉ số sẽ làm các mức cần đạt người
dùng từng chốt thành mồ côi — `findOrphanOverrides` chỉ ghi cảnh báo, không ngã, nên mục tiêu
sẽ mất hiệu lực âm thầm. Vì vậy chỉ các khoá **mục tiêu** được dựng lại; không khoá chỉ số
nào bị đổi tên hay xoá, và không cần bước di trú dữ liệu.

Phần đã khớp tốt, không cần sửa: cấu trúc ba tầng · ràng buộc không có chỉ số mồ côi · bắt
buộc `provenance` cho mọi chỉ số · `comparability.basis = admission_cycle` xử lý mùa vụ ·
`targetRationale` buộc ghi căn cứ khi chốt mức · trạng thái `baseline_pending` nói thật khi
chưa có gốc so sánh. Sáu thứ này đúng tinh thần bài 5.1 ("không có mục tiêu thì không có
KPI") và còn chặt hơn bài giảng.

---

## 1. Tầng kinh doanh đang mang nội dung của tầng marketing

**Hiện trạng.** Năm mục tiêu tầng `business` trong `demo/cascade.ts:137-199` được phân loại
bằng `growthSource`: `biz_choice` (dòng 140), `biz_penetration` (152), `biz_volume` (164),
`biz_loyalty` (175), `biz_frequency` (187). Chú thích tại `kpi-cascade.ts:42` gọi đây là
*"Năm nguồn tăng trưởng của **mục tiêu kinh doanh**"*.

**Lý thuyết.** Penetration / Frequency / Consumption / Choice–Loyalty là **mục tiêu
marketing** — bài 3.1 gọi đúng tên chúng là *sources of growth* và xếp ở tầng M. Tầng B chỉ
có bốn con số: **Sale · Share · Growth · Profit** (bài 2.6). Ranh giới hai tầng được bài 5.1
phát biểu dứt khoát: tầng B là *thay đổi về số liệu của công ty*, tầng M là *thay đổi về
hành vi người tiêu dùng*.

**Hệ quả.** Cây hiện tại dịch lên một tầng: nội dung tầng M nằm ở tầng B, nên tầng B không
còn chỗ cho Growth và Profit (điểm lệch 4 và 5), còn tầng M chỉ còn các mục tiêu truyền
thông trung gian (`mkt_consideration`, `mkt_new_segments`, `mkt_value_mix`, `mkt_advocacy` —
dòng 201-247) vốn gần tầng C hơn tầng M. Các chỉ số kinh doanh thật vì thế bị treo rải rác:
`enrolment_share` (volume share) nằm dưới `biz_penetration`, `tuition_revenue` (value sale)
nằm dưới `biz_volume` — hai mặt của cùng một mục tiêu Sale/Share bị tách sang hai nhánh,
không đặt cạnh nhau được, trái yêu cầu của bài 2.1 và 2.2.

**Đề xuất.** Giữ nguyên nội dung các mục tiêu đã viết — chúng là quyết định thật, có căn cứ
tốt — nhưng dựng lại nhãn tầng:

```
business      : sale · share · growth · profit
marketing     : penetration · frequency · consumption · choice-loyalty
communication : awareness · attributes · creative · effectiveness
```

Năm mục tiêu hiện ở tầng `business` chuyển xuống tầng `marketing` (chúng đúng là mục tiêu
marketing); bốn mục tiêu `mkt_*` hiện tại trở thành mục tiêu truyền thông hoặc nhập vào tầng
marketing tương ứng. `growthSource` khi đó là trường của tầng M, không phải tầng B — khớp
đúng ngữ nghĩa cái tên.

*Chi phí:* đổi khoá và quan hệ cha–con trong schema dùng chung → lan sang `api`, `web`,
`postgres-kpi.repository.ts`, các bản ghi đè mục tiêu đã lưu trong cơ sở dữ liệu. Không phải
thay đổi nhỏ. Cần quyết trước khi làm.

---

**Đã sửa.** Tầng `business` nay đúng bốn mục tiêu `biz_sale` · `biz_share` · `biz_growth` ·
`biz_profit`. Năm mục tiêu nguồn tăng trưởng chuyển xuống tầng `marketing` thành
`mkt_penetration` · `mkt_choice` · `mkt_consumption` · `mkt_frequency` · `mkt_loyalty`, giữ
nguyên nội dung và căn cứ đã viết. Bốn mục tiêu `mkt_*` cũ (consideration, new_segments,
value_mix, advocacy) được nhập vào các mục tiêu tương ứng, và chỉ số của chúng chuyển sang
tầng truyền thông vì chúng đo đầu ra truyền thông chứ không đo hành vi. `enrolment_share`
(volume share) và `tuition_revenue` (value sale) nay nằm cùng tầng kinh doanh nên đọc cạnh
nhau được. Ràng buộc trong `kpi-cascade.ts` cũng đảo theo: `growthSource` chỉ được khai ở
tầng marketing, và test `kpi-cascade-structure.spec.ts` chặn việc gắn lại vào tầng kinh doanh.

## 2. Bốn mục tiêu marketing bị biến thành năm

**Hiện trạng.** `GrowthSourceSchema` (`kpi-cascade.ts:47-58`) có năm giá trị, tách `choice`
(dòng 55) và `loyalty` (57) thành hai nguồn riêng.

**Lý thuyết.** Bài 3.3 coi **Choice / Loyalty là một** nguồn tăng trưởng duy nhất, định nghĩa
bằng *thị phần trong giỏ hàng người tiêu dùng*, và nhắc lại hai lần rằng nó khác market
share. Bài 6 tổng kết lại đúng bốn: penetration, frequency, consumption, choice–loyalty.

**Hệ quả.** Không sai về bản chất — và với giáo dục đại học, việc tách có lý do thật: *được
chọn lúc xét tuyển* và *giữ chân sau khi nhập học* là hai bài toán khác nhau, cách nhau 4–5
năm, dùng dữ liệu khác nhau. Vấn đề chỉ là nó đang là một **departure không được ghi lại**:
ai đọc cây mục tiêu rồi đọc khung gốc sẽ thấy lệch mà không biết là cố ý.

**Đề xuất.** Giữ năm giá trị, nhưng ghi rõ trong chú thích của `GrowthSourceSchema` rằng đây
là phép tách có chủ ý so với bài 3.3, kèm lý do. Một dòng chú thích là đủ; mất một dòng đó
thì sau này có người "sửa cho đúng lý thuyết" và làm hỏng phép dịch đã đúng.

---

**Đã sửa.** Giữ năm giá trị, và ghi thẳng vào chú thích của `GrowthSourceSchema` rằng phép
tách Choice / Loyalty là **cố ý**, kèm lý do (hai bài toán cách nhau 4–5 năm, dùng nguồn dữ
liệu khác nhau). Thêm một dòng cảnh báo đừng "sửa lại cho đúng lý thuyết" — mất dòng đó là
mất lý do.

## 3. `consumption` bị đổi tên thành `volume` — đặt tên này có rủi ro thật

**Hiện trạng.** `kpi-cascade.ts:52-53`: `"volume"` với nhãn *"Lượng sử dụng"*
(`GROWTH_SOURCE_LABELS`, dòng 64), chú giải *"giá trị vòng đời một người học (học phí × số
năm × dịch vụ kèm)"*.

**Lý thuyết.** Tên gốc là **consumption**, và trong khung IBMC từ **volume** đã bị dùng cho
một nghĩa khác hẳn, ở tầng khác: *volume sale*, *volume share*, *volume growth* — tức **sản
lượng**, đối lập với *value*. Bài 2.1 và 2.2 dựng toàn bộ tầng B trên cặp volume/value này.

**Hệ quả.** Hai nghĩa của cùng một từ nằm trong cùng một mô hình dữ liệu. Khi tầng B có thêm
chỉ số `volume_share` / `value_share` (điểm lệch 4), sẽ tồn tại song song `growthSource:
"volume"` nghĩa là *lượng tiêu dùng* và `volume_share` nghĩa là *thị phần sản lượng*. Người
đọc mã nguồn sau này gần như chắc chắn hiểu sai một trong hai.

Thêm nữa, chú giải hiện tại mô tả **giá trị vòng đời** — đó là *consumption **value***, nửa
sau của khái niệm. Nửa đầu, *consumption volume* (lượng dùng mỗi lần: số tín chỉ, học song
ngành), đang không có chỗ nào.

**Đề xuất.** Đổi `"volume"` → `"consumption"`, và tách hai nửa trong chú thích theo bài 3.3:
consumption volume (chưa ánh xạ được, cần dữ liệu nội bộ) và consumption value
(premiumisation — `high_value_mix` đang đo đúng nửa này).

---

**Đã sửa.** `"volume"` → `"consumption"`, nhãn thành "Lượng tiêu dùng". Chú thích tách rõ
hai nửa của khái niệm: *consumption volume* (lượng mỗi lần dùng) ghi nhận là **chưa ánh xạ
được** sang đào tạo vì cần dữ liệu nội bộ, còn *consumption value* (premiumisation) là nửa
đang đo bằng `high_value_mix`. Xung đột tên với `volume sale` / `volume share` ở tầng kinh
doanh không còn.

## 4. Thiếu mục tiêu Growth — và đây là lỗ hổng nặng nhất

**Hiện trạng.** Không có mục tiêu nào mang nghĩa *tăng trưởng*, và không có chỉ số nào đặt
tăng trưởng của Học viện cạnh tăng trưởng của lĩnh vực. Logic này **đã được dùng** trong lý
do của `biz_choice` (`demo/cascade.ts:146-148`: *"Chỉ tiêu đã tăng gấp 2,09 lần trong 4 năm
trong khi quy mô ngành chỉ tăng khoảng 6,5%/năm"*) — nhưng chỉ nằm trong một đoạn văn, không
thành chỉ số, không lên màn hình, không ai theo dõi được nó đổi theo mùa.

**Lý thuyết.** Đây là quy tắc chịu lực nhất của toàn khoá (bài 2.3, nhắc lại ở 2.4 và 2.6):
tăng trưởng của thương hiệu **chỉ có nghĩa khi đặt cạnh tăng trưởng của ngành**; tăng doanh
số mà chậm hơn ngành là **đang mất thị phần**. Bài tập gốc được thiết kế riêng để dạy điều
này: A tăng 10% sản lượng và 28% giá trị mà vẫn mất thị phần.

**Hệ quả.** Dashboard hiện có thể hiện ra một mùa nhập học tăng và mọi chỉ số đều xanh, trong
khi Học viện đang mất thị phần — đúng ô nguy hiểm nhất của ma trận bài 2.3. Một dashboard
dựng trên khung IBMC mà không có phép so sánh này thì thiếu đúng thứ khung đó tồn tại để nói.

**Đề xuất.** Thêm mục tiêu `biz_growth` ở tầng kinh doanh, với tối thiểu bốn chỉ số thành
cặp:

| Chỉ số | Nội dung | Nguồn |
|---|---|---|
| `enrolment_growth` | tăng trưởng nhập học của Học viện (%) | Biểu 18 |
| `category_enrolment_growth` | tăng trưởng thí sinh đăng ký lĩnh vực máy tính & CNTT (%) | công bố Bộ GD&ĐT |
| `tuition_value_growth` | tăng trưởng doanh thu học phí (%), **đã trừ trần tăng học phí và CPI** | Biểu 18 + Nghị định 97/2023 |
| `growth_vs_category_gap` | chênh lệch hai dòng đầu — dấu của nó là dấu của thị phần | tính toán |

Kèm một biểu đồ bốn ô (doanh số tăng/giảm × nhanh/chậm hơn ngành) trong
`components/charts/`. Trước khi vẽ: đọc skill `dataviz` theo CLAUDE.md mục 5.

---

**Đã sửa.** Thêm mục tiêu `biz_growth` với bốn chỉ số: `enrolment_growth`,
`category_enrolment_growth`, `growth_vs_category_gap`, `tuition_value_growth_real`. Ba điểm
đáng ghi lại:

- `category_enrolment_growth` **cố ý không có mức cần đạt** — đặt mục tiêu cho tốc độ tăng
  của cả lĩnh vực là nhận một việc không thuộc thẩm quyền Học viện.
- `growth_vs_category_gap` đặt mục tiêu **+1 điểm phần trăm**, không phải 0: mức 0 chỉ là
  ngưỡng giữ nguyên thị phần, và `completionRatio` không tính được khi mục tiêu bằng 0.
- `tuition_value_growth_real` trừ **cả trần tăng học phí lẫn CPI** — trượt theo trần không
  phải thành tích marketing.

Test `kpi-cascade-structure.spec.ts` khẳng định ba chỉ số đầu luôn cùng tồn tại, nên không ai
xoá được tăng trưởng ngành mà vẫn giữ tăng trưởng thương hiệu. Biểu đồ bốn ô chưa vẽ — phần
giao diện thuộc phiên khác.

## 5. Thiếu tầng Profit

**Hiện trạng.** Không có mục tiêu hay chỉ số nào về chi phí, hiệu quả đồng tiền, hay ngân
sách truyền thông.

**Lý thuyết.** Profit là con số thứ tư bắt buộc của tầng B (bài 2.5, 2.6). Lập luận của bài 1
nói thẳng vì sao nó không thể thiếu: *"bạn sẽ không thể xin được ngân sách marketing nếu bạn
không chứng minh được giá trị của hoạt động marketing"* — và *"mỗi đồng bạn chi ra cần phải
chứng tỏ được hiệu quả mà nó mang lại"*.

**Hệ quả.** Dashboard chứng minh được *hiện diện* (tin bài, tìm kiếm, thảo luận) nhưng không
chứng minh được *hiệu quả của đồng tiền*. Đây đúng là khoảng trống mà bài 1 cảnh báo, và với
một nhiệm vụ nghiên cứu có dự toán thì nó còn là câu hỏi hội đồng nghiệm thu sẽ hỏi.

**Đề xuất.** Thêm `biz_profit` với các chỉ số **đo được ngay từ dữ liệu đang có**:

| Chỉ số | Công thức | Nguồn |
|---|---|---|
| `cost_per_enrolment` | ngân sách truyền thông tuyển sinh / số nhập học | dự toán + Biểu 18 |
| `cost_per_consideration` | ngân sách / lượt xem trang quyết định chọn trường | dự toán + `mart__channel_performance` |
| `channel_cost_efficiency` | chi phí trên mỗi phiên có ý định, theo kênh | `mart__channel_performance` |

Hai chỉ số còn lại của bài 2.5 — marketing contribution và tỷ lệ trích lập quỹ — cần số liệu
dự toán nội bộ; để trạng thái "chưa nối" kèm điều kiện mở khoá, đừng bỏ khỏi cây.

Lưu ý khi dịch: trường công lập không tối đa hoá lợi nhuận, nên **không** bê nguyên ngưỡng
*marketing contribution ≥ 40%* của bài 2.5 vào. Thứ giữ lại được là **cấu trúc** — mọi đồng
chi ra phải quy về một đơn vị kết quả.

---

**Đã sửa.** Thêm mục tiêu `biz_profit` với `cost_per_enrolment`, `cost_per_consideration`
và `marketing_budget_ratio`. Hai chỉ số đầu chưa đặt mức cần đạt vì chưa có mùa nào làm gốc;
chỉ số thứ ba lấy biên dưới 5% của thông lệ 5–10% trong bài 2.5 làm mức tham chiếu, và nói rõ
trong căn cứ rằng đây là con số để tranh luận ngân sách, không phải cam kết chi tiêu. Ngưỡng
*marketing contribution ≥ 40%* của bài 2.5 **không** bê vào, vì trường công lập không tối đa
hoá lợi nhuận — thứ giữ lại là cấu trúc, không phải con số.

Thêm nguồn `SOURCE_INTERNAL_BUDGET`, nguồn duy nhất trong cascade không phải nguồn công khai,
kèm ghi chú không bao giờ được trộn vào phép so sánh với trường khác.

## 6. Bốn mục tiêu truyền thông đang bị gắn cứng vào từng nhánh marketing

**Hiện trạng.** `com_awareness` → `mkt_consideration`; `com_attributes` → `mkt_consideration`;
`com_effectiveness` → `mkt_new_segments` (`demo/cascade.ts:281`); `com_creative` →
`mkt_advocacy` (dòng 292).

**Lý thuyết.** Bốn nhóm mục tiêu truyền thông của bài 5.1–5.2 (awareness · key attributes ·
creative quality · hiệu quả kênh) là **bốn chiều đánh giá của mọi chiến dịch**, không phải
bốn mục tiêu con của bốn mục tiêu marketing khác nhau. Bài 5.2 tổng kết chúng thành năm câu
hỏi hỏi về *cùng một* chiến dịch.

**Hệ quả.** Cây đọc ra một ý không ai chủ ý: *chất lượng sáng tạo chỉ liên quan tới lan toả
của cựu người học*, *hiệu quả kênh chỉ liên quan tới nhóm ngành mới*. Ràng buộc một cha của
schema (`PARENT_TIER`, `kpi-cascade.ts:35-39`) buộc phải chọn một — nên đây là hạn chế của mô
hình dữ liệu, không phải lỗi của người điền.

**Đề xuất.** Hai đường, chọn một:

1. **Rẻ:** giữ cấu trúc một cha, nhưng ghi chú rằng `parentKey` của tầng C là *nhánh được ưu
   tiên phục vụ*, không phải *phạm vi áp dụng*. Sửa tài liệu, không sửa mã.
2. **Đúng hơn:** cho mỗi chiến dịch/mục tiêu marketing đều có thể mang cả bốn chiều — tức
   `communicationGoal` trở thành thuộc tính của **chỉ số**, không phải của mục tiêu. Thay đổi
   này chạm `KpiCascadeResponseSchema` và phần kiểm tính liền mạch ở `kpi-cascade.ts:384`.

Khuyến nghị đường 1 bây giờ, đường 2 khi đã có nhiều hơn một chiến dịch thật để theo dõi.

---

**Đã sửa theo đường 1**, như đã khuyến nghị. `CommunicationGoalSchema` và trường `parentKey`
nay ghi rõ: ở tầng truyền thông, `parentKey` là *nhánh chịu ảnh hưởng chính*, **không phải**
phạm vi áp dụng. Cấu trúc một cha giữ nguyên, nên không chạm `KpiCascadeResponseSchema`. Đường
2 (chuyển `communicationGoal` xuống cấp chỉ số) để lại cho lúc có nhiều hơn một chiến dịch
thật để theo dõi.

## 7. Thuộc tính thương hiệu bị gộp thành một tỷ lệ

**Hiện trạng.** `attribute_coverage` (`demo/cascade.ts:667-677`) — *"Tỷ lệ tin bài gắn thuộc
tính mục tiêu"*, một con số, mục tiêu 45%, gộp cả ba thuộc tính đã tuyên bố ở
`com_attributes` (dòng 262-271: trọng điểm quốc gia · gắn với doanh nghiệp · ra trường có
việc làm).

**Lý thuyết.** Bài 5.1: mục tiêu thuộc tính luôn là một **cặp tăng–giữ** — tăng điểm thuộc
tính đang tấn công **trong khi giữ** điểm thuộc tính mình đang mạnh. Ví dụ X-Men được giảng
riêng để dạy rằng chỉ khi *hai* điểm số cùng tăng thì mới kéo được người dùng của Clear sang.

**Hệ quả.** Một tỷ lệ gộp che mất đúng thứ cần thấy: tỷ lệ 45% giữ nguyên trong khi toàn bộ
tin bài chuyển từ *trọng điểm quốc gia* sang *việc làm* sẽ đọc ra là "đạt mục tiêu", trong
khi thực tế thương hiệu vừa đánh đổi một thuộc tính lấy một thuộc tính khác.

**Đề xuất.** Tách thành chuỗi theo **từng** thuộc tính theo thời gian (ba chỉ số, hoặc một
chỉ số có chiều `attribute`), và đặt mục tiêu dạng cặp: tăng cái đang nhắm, **không giảm**
các cái còn lại. Việc này cần bước trích thuộc tính trong `apps/worker/nlp/` — hiện `hint`
của chỉ số đã ghi nhận là còn thiếu.

---

**Đã sửa, nhưng theo cách khác đề xuất ban đầu.** Thay vì xoá `attribute_coverage`, giữ
nguyên khoá đó (để không làm mồ côi bản ghi đè) và **thêm ba chuỗi riêng**:
`attribute_national_key`, `attribute_industry_link`, `attribute_employability`. Nhãn của chỉ
số gộp đổi thành "...(số gộp)" và `hint` nói thẳng rằng nó **không phát hiện được việc đánh
đổi giữa các thuộc tính** — tỷ lệ gộp giữ nguyên trong khi tin bài chuyển hết từ thuộc tính
này sang thuộc tính khác.

Ba chỉ số mới cố ý **chưa có mức cần đạt**: theo quy tắc cặp tăng–giữ, mức của từng thuộc
tính phải đặt cùng lúc với hai thuộc tính kia, nên đặt lẻ một cái là mời gọi đúng cái đánh
đổi đang muốn tránh. Còn cần bước trích thuộc tính trong `apps/worker/nlp/`.

## 8. Một lưu ý về nhãn, không phải điểm lệch cấu trúc

`com_awareness` (dòng 250-259) phát biểu *"Nâng mức độ nhận biết chủ động"* và được đo bằng
thị phần tìm kiếm + lượt xem Wikipedia. Theo bài 5.1, nhận biết có **ba mức** đo bằng ba câu
hỏi khảo sát khác nhau, và dashboard không có khảo sát nào.

Cách phát biểu hiện tại (*"nhận biết chủ động"*) đã cẩn thận — nó không nói top-of-mind. Giữ
nguyên, và khi thêm chỉ số nhận biết mới thì tiếp tục neo vào mức tương ứng, đừng rút gọn
thành "nhận biết thương hiệu" trống không. Chi tiết ở
[ánh xạ §3.1](ibmc-anh-xa-ptit.md#31-nói-đúng-tên-thứ-đang-đo).

---

## 9. Tình trạng sau khi sửa

Cây mục tiêu, trước và sau:

| | Trước | Sau |
|---|---|---|
| Mục tiêu tầng kinh doanh | 5 (nội dung của tầng marketing) | **4** (Sale · Share · Growth · Profit) |
| Mục tiêu tầng marketing | 4 (gần tầng truyền thông hơn) | **5** (năm nguồn tăng trưởng) |
| Mục tiêu tầng truyền thông | 4 | **4** (giữ khoá, đổi `parentKey`) |
| Tổng chỉ số | 29 | **39** |
| Chỉ số đã có số thật | 11 | **11** (không chỉ số nào mất số) |
| Chỉ số bị đổi tên hoặc xoá | — | **0** |

Kiểm chứng đã chạy:

- `KpiCascadeResponseSchema.safeParse` trên cây mới: **0 vi phạm**.
- `apps/api/src/modules/kpi/kpi-cascade-structure.spec.ts`: **11 test mới**, khoá bảy phát
  biểu của khung vào test — gồm hai test lỗi khẳng định schema TỪ CHỐI cây sai khung.
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build`: xanh cả bốn; 30/30 test.

Phần còn lại, **không** thuộc bảy điểm lệch:

| Việc | Vì sao chưa làm |
|---|---|
| Biểu đồ bốn ô doanh số × tăng trưởng so với ngành | Thuộc `apps/web/src/components/charts/`, đang do một phiên khác dựng lại giao diện. Dữ liệu đã có chỗ đứng trong cascade |
| Bước trích thuộc tính trong `apps/worker/nlp/` | Việc của worker Python, độc lập với cascade |
| Lấp bốn chỗ thiếu đầu vào | Xem [`ibmc-dau-vao-dau-ra.md`](ibmc-dau-vao-dau-ra.md) §4 — hai chỗ cần Học viện quyết, không phải việc kỹ thuật |
