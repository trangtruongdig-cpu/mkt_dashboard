import {
  COMMUNICATION_GOAL_LABELS,
  DATA_READINESS_LABELS,
  GROWTH_SOURCE_LABELS,
  KPI_STATUS_LABELS,
  OBJECTIVE_TIER_LABELS,
  type CommunicationGoal,
  type DataReadiness,
  type GrowthSource,
  type KpiStatus,
  type Objective,
  type ObjectiveTier,
} from "@ptit/shared";
import type { ComponentType } from "react";
import {
  IconAlertTriangle,
  IconBroadcast,
  IconBuilding,
  IconCheckCircle,
  IconClock,
  IconCode,
  IconLock,
  IconMegaphone,
  IconMinusCircle,
  IconPlug,
  IconRepeat,
  IconSearch,
  IconShield,
  IconSparkles,
  IconTag,
  IconTarget,
  IconTrendingUp,
  IconUsers,
  IconWallet,
  IconXCircle,
  type IconProps,
} from "@/components/ui/icons";

/**
 * BẢN ĐỒ TỪ KHÁI NIỆM SANG HÌNH — một chỗ duy nhất.
 *
 * Bảng điều khiển thay chữ bằng hình để đọc nhanh, nhưng mỗi hình phải luôn đi kèm
 * nhãn chữ (`sr-only` hoặc `title`) và mỗi trạng thái phải có HÌNH RIÊNG chứ không
 * chỉ đổi màu — để đọc được khi mù màu và khi in đen trắng cho hồ sơ nghiệm thu.
 */

type Icon = ComponentType<IconProps>;

export interface Glyph {
  icon: Icon;
  color: string;
  label: string;
}

export const STATUS_GLYPH: Record<KpiStatus, Glyph> = {
  on_track: {
    icon: IconCheckCircle,
    color: "var(--status-good)",
    label: KPI_STATUS_LABELS.on_track,
  },
  at_risk: {
    icon: IconAlertTriangle,
    color: "var(--status-warning)",
    label: KPI_STATUS_LABELS.at_risk,
  },
  off_track: {
    icon: IconXCircle,
    color: "var(--status-bad)",
    label: KPI_STATUS_LABELS.off_track,
  },
  baseline_pending: {
    icon: IconClock,
    color: "var(--status-none)",
    label: KPI_STATUS_LABELS.baseline_pending,
  },
};

export const READINESS_GLYPH: Record<DataReadiness, Glyph> = {
  connected: {
    icon: IconPlug,
    color: "var(--status-good)",
    label: DATA_READINESS_LABELS.connected,
  },
  public_ready: {
    icon: IconClock,
    color: "var(--status-warning)",
    label: DATA_READINESS_LABELS.public_ready,
  },
  needs_build: {
    icon: IconCode,
    color: "var(--status-none)",
    label: DATA_READINESS_LABELS.needs_build,
  },
  needs_access: {
    icon: IconLock,
    color: "var(--status-bad)",
    label: DATA_READINESS_LABELS.needs_access,
  },
  not_planned: {
    icon: IconMinusCircle,
    color: "var(--status-none)",
    label: DATA_READINESS_LABELS.not_planned,
  },
};

export const TIER_ICON: Record<ObjectiveTier, Icon> = {
  business: IconBuilding,
  marketing: IconTrendingUp,
  communication: IconMegaphone,
};

const GROWTH_ICON: Record<GrowthSource, Icon> = {
  penetration: IconUsers,
  frequency: IconRepeat,
  volume: IconWallet,
  choice: IconTarget,
  loyalty: IconShield,
};

const GOAL_ICON: Record<CommunicationGoal, Icon> = {
  awareness: IconSearch,
  attributes: IconTag,
  effectiveness: IconBroadcast,
  creative: IconSparkles,
};

/**
 * Hình và nhãn phân loại của một mục tiêu: lấy theo nguồn tăng trưởng (tầng kinh
 * doanh) hoặc theo nhóm mục tiêu truyền thông. Tầng marketing không có phân loại
 * riêng nên dùng hình và nhãn của chính tầng.
 *
 * Trả về cả cụm thay vì trả thẳng component: nơi gọi lấy `glyph.icon` bằng phép truy
 * cập thuộc tính, không phải tạo component ngay trong lúc render.
 */
export function objectiveGlyph(objective: Objective): {
  icon: Icon;
  label: string;
} {
  if (objective.growthSource !== null) {
    return {
      icon: GROWTH_ICON[objective.growthSource],
      label: GROWTH_SOURCE_LABELS[objective.growthSource],
    };
  }
  if (objective.communicationGoal !== null) {
    return {
      icon: GOAL_ICON[objective.communicationGoal],
      label: COMMUNICATION_GOAL_LABELS[objective.communicationGoal],
    };
  }
  return {
    icon: TIER_ICON[objective.tier],
    label: OBJECTIVE_TIER_LABELS[objective.tier],
  };
}

interface GlyphIconProps {
  glyph: Glyph;
  className?: string;
}

/** Hình trạng thái kèm nhãn chữ ẩn — dùng trong hàng chỉ số chật chỗ. */
export function GlyphIcon({ glyph, className = "h-4 w-4" }: GlyphIconProps) {
  const Icon = glyph.icon;

  return (
    <span
      className="inline-flex shrink-0 items-center"
      style={{ color: glyph.color }}
      title={glyph.label}
    >
      <Icon className={className} />
      <span className="sr-only">{glyph.label}</span>
    </span>
  );
}

interface GlyphPillProps {
  glyph: Glyph;
  /** Số lượng đi kèm, dùng cho chú giải của biểu đồ phân bố. */
  count?: number;
}

/** Hình + nhãn chữ đầy đủ — dùng làm chú giải, nơi danh tính phải rõ ràng. */
export function GlyphPill({ glyph, count }: GlyphPillProps) {
  const Icon = glyph.icon;

  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-secondary">
      <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: glyph.color }} />
      <span>{glyph.label}</span>
      {count === undefined ? null : (
        <span className="font-semibold text-ink tabular-nums">{count}</span>
      )}
    </span>
  );
}
