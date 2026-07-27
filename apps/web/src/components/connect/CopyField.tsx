"use client";

import { useState } from "react";

interface CopyFieldProps {
  label: string;
  value: string;
}

export function CopyField({ label, value }: CopyFieldProps) {
  const [daChep, setDaChep] = useState(false);

  const chep = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(value);
      setDaChep(true);
      setTimeout(() => setDaChep(false), 2000);
    } catch {
      /* Trình duyệt chặn clipboard — người dùng bôi đen copy tay được. */
    }
  };

  return (
    <div className="rounded-lg border border-hairline bg-plane p-3">
      <p className="text-xs text-ink-muted">{label}</p>
      <div className="mt-1.5 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate font-mono text-xs text-ink">{value}</code>
        <button
          type="button"
          onClick={() => void chep()}
          className="shrink-0 rounded-md border border-hairline px-2.5 py-1 text-xs font-medium text-ink-secondary hover:text-ink"
        >
          {daChep ? "Đã chép" : "Chép"}
        </button>
      </div>
    </div>
  );
}
