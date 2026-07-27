"use client";

import type { Ga4Property } from "@ptit/shared";
import { useEffect, useState } from "react";
import { connectApi } from "@/lib/api-client";

interface StepPropertyProps {
  onSelected: () => Promise<void>;
}

/** Danh sách property tự dò từ tài khoản đã đăng nhập — không phải chép ID bằng tay. */
export function StepProperty({ onSelected }: StepPropertyProps) {
  const [properties, setProperties] = useState<Ga4Property[] | null>(null);
  const [chon, setChon] = useState<string>("");
  const [loi, setLoi] = useState<string | null>(null);
  const [dangLuu, setDangLuu] = useState(false);

  useEffect(() => {
    let huy = false;

    connectApi
      .listProperties()
      .then((ket_qua) => {
        if (huy) return;
        setProperties(ket_qua.properties);
        setChon(ket_qua.properties[0]?.propertyId ?? "");
      })
      .catch((e: unknown) => {
        if (!huy) setLoi(e instanceof Error ? e.message : "Không lấy được danh sách property");
      });

    return () => {
      huy = true;
    };
  }, []);

  if (loi) {
    return <p className="text-sm" style={{ color: "var(--delta-bad)" }}>{loi}</p>;
  }

  if (properties === null) {
    return <p className="text-sm text-ink-muted">Đang dò các property bạn có quyền xem…</p>;
  }

  if (properties.length === 0) {
    return (
      <p className="text-sm text-ink-secondary">
        Tài khoản này không có quyền xem property GA4 nào. Kiểm tra lại xem đã đăng nhập
        đúng tài khoản được cấp quyền chưa.
      </p>
    );
  }

  const luu = async (): Promise<void> => {
    setDangLuu(true);
    setLoi(null);
    try {
      await connectApi.selectProperty(chon);
      await onSelected();
    } catch (e: unknown) {
      setLoi(e instanceof Error ? e.message : "Không lưu được lựa chọn");
    } finally {
      setDangLuu(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-secondary">
        Tìm thấy {properties.length} property. Chọn property của cổng thông tin Học viện:
      </p>

      <div className="space-y-2">
        {properties.map((property) => (
          <label
            key={property.propertyId}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-hairline bg-plane p-3 transition-colors has-checked:border-ink-muted"
          >
            <input
              type="radio"
              name="property"
              value={property.propertyId}
              checked={chon === property.propertyId}
              onChange={(e) => setChon(e.target.value)}
              className="mt-0.5"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">
                {property.displayName}
              </span>
              <span className="block text-xs text-ink-muted">
                {property.accountName} · ID {property.propertyId}
              </span>
            </span>
          </label>
        ))}
      </div>

      <button
        type="button"
        disabled={!chon || dangLuu}
        onClick={() => void luu()}
        className="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-opacity disabled:opacity-40"
        style={{ background: "var(--series-1)" }}
      >
        {dangLuu ? "Đang lưu…" : "Chọn property này"}
      </button>
    </div>
  );
}
