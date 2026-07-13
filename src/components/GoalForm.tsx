"use client";
import type { Mode } from "@/lib/agent/types";

interface GoalFormProps {
  goal: string;
  mode: Mode;
  busy: boolean;
  onGoalChange: (v: string) => void;
  onModeChange: (m: Mode) => void;
  onRun: () => void;
}

export default function GoalForm({
  goal,
  mode,
  busy,
  onGoalChange,
  onModeChange,
  onRun,
}: GoalFormProps) {
  return (
    <div className="card goal-form">
      <label className="goal-form-label" htmlFor="goal-input">
        Newsletter goal
      </label>
      <textarea
        id="goal-input"
        className="goal-textarea"
        value={goal}
        onChange={(e) => onGoalChange(e.target.value)}
        disabled={busy}
        rows={3}
        placeholder="e.g. Create a weekly newsletter on latest AI agent news and send it to our subscribers."
      />
      <div className="form-footer">
        {/* Mode toggle */}
        <div className="mode-toggle" role="group" aria-label="Agent mode">
          <button
            id="mode-autonomous"
            className={`mode-btn ${mode === "autonomous" ? "active" : ""}`}
            onClick={() => onModeChange("autonomous")}
            disabled={busy}
            title="Agent runs end-to-end without human review"
          >
            <span className="mode-icon">🤖</span>
            <span className="mode-label">Fully Autonomous</span>
          </button>
          <button
            id="mode-human"
            className={`mode-btn ${mode === "human" ? "active" : ""}`}
            onClick={() => onModeChange("human")}
            disabled={busy}
            title="Graph pauses for your approval before sending"
          >
            <span className="mode-icon">👤</span>
            <span className="mode-label">Human in the Loop</span>
          </button>
        </div>

        {/* Run button */}
        <button
          id="run-agent-btn"
          className="run-btn"
          onClick={onRun}
          disabled={busy}
        >
          {busy ? (
            <>
              <span className="run-btn-spinner" />
              Agent running…
            </>
          ) : (
            <>▶ Run newsletter agent</>
          )}
        </button>
      </div>

      {/* Mode description */}
      <p
        style={{
          fontSize: 12,
          color: "var(--text-3)",
          margin: "10px 0 0",
          lineHeight: 1.5,
        }}
      >
        {mode === "autonomous"
          ? "⚡ Autonomous mode: The LangGraph agent will plan, research, summarize, critique, and output the newsletter without pausing."
          : "⏸️ HITL mode: The graph will interrupt before simulated send. You can inspect and approve or reject."}
      </p>
    </div>
  );
}
