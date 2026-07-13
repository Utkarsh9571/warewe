"use client";
import type { Critique, Draft } from "@/lib/agent/types";

interface ApprovalCardProps {
  draft: Draft;
  critique?: Critique;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}

export default function ApprovalCard({
  draft,
  critique,
  busy,
  onApprove,
  onReject,
}: ApprovalCardProps) {
  return (
    <div className="card approval-card">
      <div className="approval-header">
        <p className="approval-eyebrow">⏸ LangGraph Interrupt</p>
        <h2>Approve simulated send?</h2>
        <p>
          The graph is paused at the human approval checkpoint. Review the
          newsletter below, then resume or cancel.
        </p>
      </div>

      <div className="approval-info">
        <div className="approval-stat">
          <div className="approval-stat-label">Subject</div>
          <div className="approval-stat-value" style={{ color: "var(--text)" }}>
            {draft.subject}
          </div>
        </div>
        <div className="approval-stat">
          <div className="approval-stat-label">Articles</div>
          <div className="approval-stat-value">{draft.items.length}</div>
        </div>
        {critique && (
          <div className="approval-stat">
            <div className="approval-stat-label">Quality score</div>
            <div
              className="approval-stat-value"
              style={{
                color:
                  critique.decision === "pass"
                    ? "var(--green)"
                    : "var(--amber)",
              }}
            >
              {critique.score}/100 · {critique.decision}
            </div>
          </div>
        )}
        <div className="approval-stat">
          <div className="approval-stat-label">Note</div>
          <div
            className="approval-stat-value"
            style={{ fontSize: 11, color: "var(--text-3)" }}
          >
            No actual email will be sent
          </div>
        </div>
      </div>

      <div className="approval-actions">
        <button
          id="approve-btn"
          className="approve-btn"
          onClick={onApprove}
          disabled={busy}
        >
          ✓ Approve &amp; resume
        </button>
        <button
          id="reject-btn"
          className="reject-btn"
          onClick={onReject}
          disabled={busy}
        >
          ✕ Reject
        </button>
      </div>
    </div>
  );
}
