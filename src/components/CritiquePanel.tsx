"use client";
import type { Critique } from "@/lib/agent/types";

interface CritiquePanelProps {
  critique: Critique;
  revised: boolean;
}

export default function CritiquePanel({ critique, revised }: CritiquePanelProps) {
  const isPass = critique.decision === "pass";
  const pct = Math.min(100, Math.max(0, critique.score));

  return (
    <div className="card critique-card">
      <div className="critique-header">
        <h2>Self-Critique</h2>
        <div className="critique-score-badge">
          <span className={`critique-score-num ${critique.decision}`}>
            {critique.score}
          </span>
          <span style={{ color: "var(--text-3)", fontSize: 12 }}>/100</span>
          <span className={`critique-decision ${critique.decision}`}>
            {critique.decision}
          </span>
        </div>
      </div>

      <div className="critique-body">
        {/* Score bar */}
        <div className="critique-score-bar">
          <div
            className={`critique-score-fill ${critique.decision}`}
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Issues */}
        {critique.issues.length > 0 && (
          <div className="critique-section">
            <div className="critique-section-title">Issues identified</div>
            <ul className="critique-issue-list">
              {critique.issues.map((issue, i) => (
                <li key={i}>{issue}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Revision instructions */}
        {critique.revisionInstructions.length > 0 && (
          <div className="critique-section">
            <div className="critique-section-title">Revision instructions</div>
            <ul className="critique-instruction-list">
              {critique.revisionInstructions.map((inst, i) => (
                <li key={i}>{inst}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Revised chip */}
        {revised && (
          <div className="revised-chip">
            ✓ One revision pass applied
          </div>
        )}

        {/* Pass with no issues */}
        {isPass && critique.issues.length === 0 && (
          <p style={{ fontSize: 12, color: "var(--green)", margin: 0 }}>
            ✓ Newsletter passed all quality checks.
          </p>
        )}
      </div>
    </div>
  );
}
