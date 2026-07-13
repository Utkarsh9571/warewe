"use client";
import { useNewsletterStore } from "@/store/newsletter-store";
import { StatusBadge } from "./StatusBadge";
import GoalForm from "./GoalForm";
import RunTimeline from "./RunTimeline";
import CritiquePanel from "./CritiquePanel";
import ApprovalCard from "./ApprovalCard";
import NewsletterPreview from "./NewsletterPreview";

export default function Dashboard() {
  const {
    goal,
    mode,
    busy,
    view,
    setGoal,
    setMode,
    run,
    decide,
    download,
  } = useNewsletterStore();

  return (
    <div className="app-wrapper">
      {/* === App Header === */}
      <header className="app-header">
        <div className="app-header-left">
          <p className="app-eyebrow">LangGraph Operations Console</p>
          <h1 className="app-title">SignalBrief</h1>
          <p className="app-subtitle">
            An observable, bounded LangGraph JS agent that turns current AI-agent
            news into a grounded, critiqued newsletter.
          </p>
        </div>
        <div className="app-header-right">
          <StatusBadge status={view.status} />
          <span style={{ fontSize: 11, color: "var(--text-3)" }}>
            {view.events.length > 0
              ? `${view.events.length} events logged`
              : "No run active"}
          </span>
        </div>
      </header>

      {/* === Goal Form === */}
      <GoalForm
        goal={goal}
        mode={mode}
        busy={busy}
        onGoalChange={setGoal}
        onModeChange={setMode}
        onRun={run}
      />

      {/* === Main Two-Column Grid === */}
      <div className="main-grid">
        {/* Left: Execution Timeline */}
        <div>
          <RunTimeline events={view.events} errors={view.errors} />
        </div>

        {/* Right: Dynamic panels */}
        <div className="right-col">
          {/* Critique panel — shown once available */}
          {view.critique && (
            <CritiquePanel
              critique={view.critique}
              revised={view.revised}
            />
          )}

          {/* HITL Approval card — shown when graph is interrupted */}
          {view.awaiting && view.draft && (
            <ApprovalCard
              draft={view.draft}
              critique={view.critique}
              busy={busy}
              onApprove={() => decide(true)}
              onReject={() => decide(false)}
            />
          )}

          {/* Newsletter preview — shown once draft is available */}
          {view.draft && (
            <NewsletterPreview
              draft={view.draft}
              html={view.html}
              output={view.output}
              onDownload={download}
            />
          )}

          {/* Empty right column hint */}
          {!view.critique && !view.draft && view.events.length === 0 && (
            <div
              className="card"
              style={{
                padding: "40px 32px",
                textAlign: "center",
                color: "var(--text-3)",
                lineHeight: 1.7,
              }}
            >
              <div style={{ fontSize: 36, marginBottom: 12 }}>🤖</div>
              <p style={{ margin: 0, fontSize: 14 }}>
                Critique analysis, newsletter preview, and HITL approval will
                appear here as the agent progresses.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
