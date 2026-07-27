"use client";

import {
  TARGET_BASIS_LABELS,
  TargetBasisSchema,
  type CascadeKpi,
  type KpiTargetOverride,
  type TargetBasis,
} from "@ptit/shared";
import { useState } from "react";

interface TargetEditorListProps {
  kpis: readonly CascadeKpi[];
  overrides: readonly KpiTargetOverride[];
  editable: boolean;
}

interface DangSua {
  target: string;
  basis: TargetBasis;
  note: string;
}

/**
 * Sửa mức cần đạt ngay trên giao diện.
 *
 * Hai ràng buộc được ép ở đây chứ không nhắc suông:
 *   - Không lưu được nếu chưa viết căn cứ. Sửa cam kết mà không nói vì sao thì người
 *     sau chỉ thấy con số, không tranh luận lại được.
 *   - Trạng thái đúng/chệch hướng KHÔNG sửa tay. Máy chủ tính lại từ giá trị và mức
 *     mới, nên không ai hạ mục tiêu xuống rồi vẫn giữ nhãn cũ.
 */
export function TargetEditorList({ kpis, overrides, editable }: TargetEditorListProps) {
  const [dangSua, setDangSua] = useState<Record<string, DangSua>>({});
  const [dangLuu, setDangLuu] = useState<string | null>(null);
  const [loi, setLoi] = useState<string | null>(null);

  const daSua = new Map(overrides.map((o) => [o.kpiKey, o]));

  const moForm = (kpi: CascadeKpi): void => {
    setLoi(null);
    setDangSua((truoc) => ({
      ...truoc,
      [kpi.key]: {
        target: kpi.target === null ? "" : String(kpi.target),
        basis: kpi.targetRationale?.basis ?? "pending_approval",
        note: kpi.targetRationale?.note ?? "",
      },
    }));
  };

  const dongForm = (key: string): void =>
    setDangSua((truoc) =>
      Object.fromEntries(Object.entries(truoc).filter(([k]) => k !== key)),
    );

  const luu = async (kpiKey: string): Promise<void> => {
    const form = dangSua[kpiKey];
    if (!form) return;

    setDangLuu(kpiKey);
    setLoi(null);
    try {
      const phan_hoi = await fetch("/api/muc-tieu/targets", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kpiKey,
          target: form.target.trim() === "" ? null : Number(form.target),
          targetRationale: { basis: form.basis, note: form.note.trim() },
        }),
      });

      if (!phan_hoi.ok) {
        const noi_dung: unknown = await phan_hoi.json().catch(() => null);
        const thong_diep =
          typeof noi_dung === "object" && noi_dung !== null && "message" in noi_dung
            ? String((noi_dung as { message: unknown }).message)
            : `Máy chủ trả về HTTP ${phan_hoi.status}`;
        setLoi(thong_diep);
        return;
      }

      // Tải lại trang để trạng thái đúng/chệch hướng được tính lại từ máy chủ.
      window.location.reload();
    } catch {
      setLoi("Không gọi được máy chủ. Kiểm tra pnpm dev còn chạy không.");
    } finally {
      setDangLuu(null);
    }
  };

  const khoiPhuc = async (kpiKey: string): Promise<void> => {
    setDangLuu(kpiKey);
    try {
      await fetch(`/api/muc-tieu/targets?kpiKey=${encodeURIComponent(kpiKey)}`, {
        method: "DELETE",
      });
      window.location.reload();
    } finally {
      setDangLuu(null);
    }
  };

  return (
    <div className="space-y-3">
      {loi ? (
        <p
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: "var(--status-bad)", color: "var(--status-bad)" }}
          role="alert"
        >
          {loi}
        </p>
      ) : null}

      {kpis.map((kpi) => {
        const form = dangSua[kpi.key];
        const ghi_de = daSua.get(kpi.key);

        return (
          <div
            key={kpi.key}
            className="rounded-xl border border-hairline bg-surface p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink">{kpi.label}</p>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Hiện tại {kpi.value ?? "—"} · cần đạt{" "}
                  <strong className="font-medium text-ink-secondary">
                    {kpi.target ?? "chưa chốt"}
                  </strong>
                  {ghi_de ? " · đã sửa từ giao diện" : null}
                </p>
                {kpi.targetRationale ? (
                  <p className="mt-1.5 text-xs leading-snug text-ink-secondary">
                    <span className="text-ink-muted">
                      {TARGET_BASIS_LABELS[kpi.targetRationale.basis]}:{" "}
                    </span>
                    {kpi.targetRationale.note}
                  </p>
                ) : null}
              </div>

              {editable && !form ? (
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => moForm(kpi)}
                    className="rounded-lg border border-hairline px-3 py-1.5 text-xs font-medium text-ink-secondary hover:text-ink"
                  >
                    Sửa
                  </button>
                  {ghi_de ? (
                    <button
                      type="button"
                      disabled={dangLuu === kpi.key}
                      onClick={() => void khoiPhuc(kpi.key)}
                      className="rounded-lg px-3 py-1.5 text-xs text-ink-muted hover:text-ink-secondary disabled:opacity-40"
                    >
                      Khôi phục mặc định
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            {form ? (
              <div className="mt-4 space-y-3 border-t border-hairline pt-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-xs text-ink-muted">
                      Mức cần đạt (để trống = chưa chốt)
                    </span>
                    <input
                      value={form.target}
                      inputMode="decimal"
                      onChange={(e) =>
                        setDangSua((t) => ({
                          ...t,
                          [kpi.key]: { ...form, target: e.target.value },
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-hairline bg-plane px-3 py-2 text-sm text-ink outline-none focus:border-ink-muted"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs text-ink-muted">Căn cứ</span>
                    <select
                      value={form.basis}
                      onChange={(e) =>
                        setDangSua((t) => ({
                          ...t,
                          [kpi.key]: { ...form, basis: e.target.value as TargetBasis },
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-hairline bg-plane px-3 py-2 text-sm text-ink outline-none focus:border-ink-muted"
                    >
                      {TargetBasisSchema.options.map((b) => (
                        <option key={b} value={b}>
                          {TARGET_BASIS_LABELS[b]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className="block">
                  <span className="text-xs text-ink-muted">
                    Diễn giải cách ra con số — bắt buộc
                  </span>
                  <textarea
                    value={form.note}
                    rows={2}
                    onChange={(e) =>
                      setDangSua((t) => ({
                        ...t,
                        [kpi.key]: { ...form, note: e.target.value },
                      }))
                    }
                    placeholder="Ví dụ: mức cao nhất đã đạt trong cùng cửa sổ năm 2025."
                    className="mt-1 w-full rounded-lg border border-hairline bg-plane px-3 py-2 text-sm text-ink outline-none focus:border-ink-muted"
                  />
                </label>

                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={form.note.trim().length === 0 || dangLuu === kpi.key}
                    onClick={() => void luu(kpi.key)}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
                    style={{ background: "var(--series-1)" }}
                  >
                    {dangLuu === kpi.key ? "Đang lưu…" : "Lưu"}
                  </button>
                  <button
                    type="button"
                    onClick={() => dongForm(kpi.key)}
                    className="rounded-lg border border-hairline px-4 py-2 text-sm text-ink-secondary"
                  >
                    Huỷ
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
