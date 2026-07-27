"use client";

import {
  buildUtmUrl,
  goiYTenChienDich,
  MEDIUM_HOP_LE,
  UTM_MEDIUM_LABELS,
  UTM_SOURCE_LABELS,
  UtmLinkSchema,
  UtmSourceSchema,
  type UtmMedium,
  type UtmSource,
} from "@ptit/shared";
import { useMemo, useState } from "react";

const TRANG_HAY_DUNG = [
  { nhan: "Trang tuyển sinh", url: "https://tuyensinh.ptit.edu.vn/" },
  { nhan: "Đề án tuyển sinh", url: "https://tuyensinh.ptit.edu.vn/de-an-tuyen-sinh/" },
  { nhan: "Danh mục ngành", url: "https://daotao.ptit.edu.vn/chuong-trinh-dao-tao/" },
  { nhan: "Trang chủ Học viện", url: "https://ptit.edu.vn/" },
];

/**
 * Tạo link có gắn thẻ UTM.
 *
 * Đây là cách duy nhất khiến quy ước được tuân thủ. Ban hành một văn bản rồi để mọi
 * người tự gõ tham số sẽ cho ra `Facebook` lẫn `facebook`, `TuyenSinh2026` lẫn
 * `tuyen_sinh_2026` — mỗi biến thể là một dòng riêng trong báo cáo.
 */
export function UtmBuilder() {
  const [baseUrl, setBaseUrl] = useState(TRANG_HAY_DUNG[0]!.url);
  const [source, setSource] = useState<UtmSource>("facebook");
  const [medium, setMedium] = useState<UtmMedium>("social_organic");
  const [campaign, setCampaign] = useState("");
  const [content, setContent] = useState("");
  const [daChep, setDaChep] = useState(false);

  const mediumChoPhep = MEDIUM_HOP_LE[source];

  const ketQua = useMemo(() => {
    const kiem_tra = UtmLinkSchema.safeParse({
      baseUrl,
      source,
      medium,
      campaign,
      content,
    });
    if (!kiem_tra.success) {
      return { link: null, loi: kiem_tra.error.issues[0]?.message ?? "Dữ liệu chưa hợp lệ" };
    }
    return { link: buildUtmUrl(kiem_tra.data), loi: null };
  }, [baseUrl, source, medium, campaign, content]);

  const doiNguon = (moi: UtmSource): void => {
    setSource(moi);
    // Phương tiện cũ có thể không dùng được với nguồn mới — chuyển sang lựa chọn đầu
    // tiên hợp lệ thay vì để người dùng ngồi nhìn một thông báo lỗi.
    if (!MEDIUM_HOP_LE[moi].includes(medium)) {
      setMedium(MEDIUM_HOP_LE[moi][0]!);
    }
  };

  const chep = async (): Promise<void> => {
    if (!ketQua.link) return;
    try {
      await navigator.clipboard.writeText(ketQua.link);
      setDaChep(true);
      setTimeout(() => setDaChep(false), 2000);
    } catch {
      /* Trình duyệt chặn clipboard — bôi đen chép tay vẫn được. */
    }
  };

  const o = "mt-1 w-full rounded-lg border border-hairline bg-plane px-3 py-2 text-sm text-ink outline-none focus:border-ink-muted";

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-hairline bg-surface p-5">
        <label className="block">
          <span className="text-xs text-ink-muted">Trang đích</span>
          <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className={o} />
        </label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {TRANG_HAY_DUNG.map((t) => (
            <button
              key={t.url}
              type="button"
              onClick={() => setBaseUrl(t.url)}
              className="rounded-md border border-hairline px-2 py-1 text-[11px] text-ink-secondary hover:text-ink"
            >
              {t.nhan}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs text-ink-muted">Đăng ở đâu</span>
            <select
              value={source}
              onChange={(e) => doiNguon(e.target.value as UtmSource)}
              className={o}
            >
              {UtmSourceSchema.options.map((s) => (
                <option key={s} value={s}>
                  {UTM_SOURCE_LABELS[s]}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs text-ink-muted">Hình thức</span>
            <select
              value={medium}
              onChange={(e) => setMedium(e.target.value as UtmMedium)}
              className={o}
            >
              {mediumChoPhep.map((m) => (
                <option key={m} value={m}>
                  {UTM_MEDIUM_LABELS[m]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="mt-3 block">
          <span className="text-xs text-ink-muted">
            Tên chiến dịch — chữ thường không dấu, có năm ở trong
          </span>
          <input
            value={campaign}
            onChange={(e) => setCampaign(e.target.value.trim())}
            placeholder="tuyensinh2026_dot1"
            spellCheck={false}
            className={`${o} font-mono`}
          />
        </label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {["Tuyển sinh", "Ngày hội tư vấn", "Điểm chuẩn"].map((chu_de) => {
            const goi_y = goiYTenChienDich(chu_de, 2026);
            return (
              <button
                key={goi_y}
                type="button"
                onClick={() => setCampaign(goi_y)}
                className="rounded-md border border-hairline px-2 py-1 font-mono text-[11px] text-ink-secondary hover:text-ink"
              >
                {goi_y}
              </button>
            );
          })}
        </div>

        <label className="mt-3 block">
          <span className="text-xs text-ink-muted">
            Bài đăng cụ thể — không bắt buộc, nhưng có thì so được bài nào hiệu quả
          </span>
          <input
            value={content}
            onChange={(e) => setContent(e.target.value.trim())}
            placeholder="post_20260415_video"
            spellCheck={false}
            className={`${o} font-mono`}
          />
        </label>
      </div>

      <div className="rounded-xl border border-hairline bg-surface p-5">
        <p className="text-xs text-ink-muted">Link để dán vào bài đăng</p>
        {ketQua.link ? (
          <>
            <p className="mt-2 font-mono text-xs leading-relaxed break-all text-ink">
              {ketQua.link}
            </p>
            <button
              type="button"
              onClick={() => void chep()}
              className="mt-3 rounded-lg px-4 py-2 text-sm font-medium text-white"
              style={{ background: "var(--series-1)" }}
            >
              {daChep ? "Đã chép" : "Chép link"}
            </button>
          </>
        ) : (
          <p className="mt-2 text-sm" style={{ color: "var(--status-warning)" }}>
            {ketQua.loi}
          </p>
        )}
      </div>
    </div>
  );
}
