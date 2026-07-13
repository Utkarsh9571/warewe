"use client";
import type { AgentEventStatus } from "@/lib/agent/types";
import type { StoreStatus } from "@/store/newsletter-store";

// ─── Status Badge ─────────────────────────────────────────────────────────────

interface StatusBadgeProps {
  status: StoreStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const label: Record<StoreStatus, string> = {
    idle: "ready",
    running: "running",
    awaiting_approval: "awaiting approval",
    completed: "completed",
    cancelled: "cancelled",
    failed: "failed",
  };
  return (
    <div className={`status-badge ${status}`}>
      <span className="dot" />
      {label[status] || status}
    </div>
  );
}

// ─── Timeline Dot ─────────────────────────────────────────────────────────────

interface TimelineDotProps {
  status: AgentEventStatus;
  node: string;
}

const NODE_ICONS: Record<string, string> = {
  plan:          "📋",
  plan_node:     "📋",
  search:        "🔍",
  search_node:   "🔍",
  select:        "⚡",
  select_node:   "⚡",
  collect:       "📰",
  collect_node:  "📰",
  summarize:     "✍️",
  summarize_node:"✍️",
  broaden:       "🔄",
  broaden_node:  "🔄",
  draft:         "📝",
  draft_node:    "📝",
  critique:      "🔬",
  critique_node: "🔬",
  revise:        "✏️",
  revise_node:   "✏️",
  approval:      "⏸️",
  approval_node: "⏸️",
  send:          "📬",
  send_node:     "📬",
};

export function TimelineDot({ status, node }: TimelineDotProps) {
  const icon = NODE_ICONS[node] || "◉";
  return (
    <div className={`timeline-dot ${status}`} title={status}>
      {icon}
    </div>
  );
}
