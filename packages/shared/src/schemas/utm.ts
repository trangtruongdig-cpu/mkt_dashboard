import { z } from "zod";

/**
 * QUY ƯỚC GẮN THẺ UTM CỦA HỌC VIỆN.
 *
 * Vì sao cần: 26,0% phiên truy cập năm 2026 rơi vào nhóm "Direct" — tức là không quy
 * được về kênh nào, tăng từ 17,7% của năm 2025. Phần lớn trong đó là lưu lượng thật
 * từ Facebook và Zalo, nhưng trình duyệt trong ứng dụng của hai nền tảng này làm mất
 * thông tin nguồn. Chỉ có tham số UTM trên đường dẫn mới giữ được.
 *
 * Quy ước này là **nguồn sự thật duy nhất**: trang tạo link đọc từ đây, và kiểm tra
 * tuân thủ cũng đối chiếu với đây. Không ai gõ tay tham số nữa.
 */

/**
 * Nguồn — nền tảng cụ thể nơi người dùng bấm vào link.
 *
 * Viết thường, không dấu. `Facebook` và `facebook` là hai kênh khác nhau trong báo
 * cáo, nên danh sách đóng chứ không cho nhập tự do.
 */
export const UtmSourceSchema = z.enum([
  "facebook",
  "zalo",
  "youtube",
  "tiktok",
  "email",
  "qr",
  "sms",
  "website",
]);
export type UtmSource = z.infer<typeof UtmSourceSchema>;

export const UTM_SOURCE_LABELS: Record<UtmSource, string> = {
  facebook: "Facebook (fanpage, group)",
  zalo: "Zalo OA, Zalo nhóm",
  youtube: "YouTube",
  tiktok: "TikTok",
  email: "Thư điện tử",
  qr: "Mã QR trên ấn phẩm in",
  sms: "Tin nhắn SMS",
  website: "Website đối tác, báo chí",
};

/**
 * Phương tiện — cách nội dung tới được người dùng, KHÔNG phải nơi đăng.
 *
 * Phân biệt hữu cơ với trả phí ở đây là điều quan trọng nhất: nếu gộp làm một thì
 * không bao giờ tính được hiệu quả của tiền quảng cáo.
 */
export const UtmMediumSchema = z.enum([
  "social_organic",
  "social_paid",
  "cpc",
  "email",
  "qr",
  "referral",
  "banner",
]);
export type UtmMedium = z.infer<typeof UtmMediumSchema>;

export const UTM_MEDIUM_LABELS: Record<UtmMedium, string> = {
  social_organic: "Đăng thường trên mạng xã hội, không trả phí",
  social_paid: "Bài đăng có trả phí quảng bá",
  cpc: "Quảng cáo tính theo lượt bấm",
  email: "Chiến dịch thư điện tử",
  qr: "Quét mã QR",
  referral: "Liên kết từ trang khác",
  banner: "Biểu ngữ đặt trên trang khác",
};

/** Cặp nguồn – phương tiện nào hợp lệ. Gắn `qr` với `social_organic` là vô nghĩa. */
export const MEDIUM_HOP_LE: Record<UtmSource, readonly UtmMedium[]> = {
  facebook: ["social_organic", "social_paid", "cpc"],
  zalo: ["social_organic", "social_paid"],
  youtube: ["social_organic", "social_paid", "cpc"],
  tiktok: ["social_organic", "social_paid", "cpc"],
  email: ["email"],
  qr: ["qr"],
  sms: ["referral"],
  website: ["referral", "banner", "cpc"],
};

/**
 * Tên chiến dịch: chữ thường, không dấu, chỉ chữ số và gạch dưới.
 *
 * Đặt tên theo mẫu `<chủ_đề><năm>_<đợt>` — ví dụ `tuyensinh2026_dot1`,
 * `ngayhoi2026_hanoi`. Có năm trong tên thì sang mùa sau không bị lẫn.
 */
export const UtmCampaignSchema = z
  .string()
  .min(3, "Tên chiến dịch quá ngắn")
  .max(60, "Tên chiến dịch quá dài")
  .regex(
    /^[a-z0-9]+(_[a-z0-9]+)*$/,
    "Chỉ dùng chữ thường không dấu, chữ số và gạch dưới. Ví dụ: tuyensinh2026_dot1",
  );

/** Nhận diện bài đăng hoặc mẫu nội dung cụ thể. Không bắt buộc nhưng nên có. */
export const UtmContentSchema = z
  .string()
  .max(80)
  .regex(
    /^[a-z0-9]+(_[a-z0-9]+)*$/,
    "Chỉ dùng chữ thường không dấu, chữ số và gạch dưới.",
  )
  .optional()
  .or(z.literal(""));

export const UtmLinkSchema = z
  .object({
    baseUrl: z.url("Địa chỉ đích không hợp lệ"),
    source: UtmSourceSchema,
    medium: UtmMediumSchema,
    campaign: UtmCampaignSchema,
    content: UtmContentSchema,
  })
  .refine((v) => MEDIUM_HOP_LE[v.source].includes(v.medium), {
    path: ["medium"],
    message: "Phương tiện này không dùng được với nguồn đã chọn",
  });
export type UtmLink = z.infer<typeof UtmLinkSchema>;

/**
 * Dựng đường dẫn có gắn thẻ.
 *
 * Giữ nguyên các tham số sẵn có trên đường dẫn gốc và chỉ ghi đè phần `utm_*`, để
 * không làm hỏng những link vốn đã mang tham số riêng.
 */
export function buildUtmUrl(input: UtmLink): string {
  const url = new URL(input.baseUrl);
  url.searchParams.set("utm_source", input.source);
  url.searchParams.set("utm_medium", input.medium);
  url.searchParams.set("utm_campaign", input.campaign);

  if (input.content && input.content.length > 0) {
    url.searchParams.set("utm_content", input.content);
  } else {
    url.searchParams.delete("utm_content");
  }

  return url.toString();
}

/** Gợi ý tên chiến dịch từ chủ đề và năm, để người dùng khỏi tự nghĩ cách viết. */
export function goiYTenChienDich(chu_de: string, nam: number): string {
  const khong_dau = chu_de
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return `${khong_dau}${nam}`;
}
