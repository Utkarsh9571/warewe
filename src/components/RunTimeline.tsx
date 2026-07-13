"use client";
import type { Event } from "@/lib/agent/types";
import { TimelineDot } from "./StatusBadge";

interface RunTimelineProps {
  events: Event[];
  errors: string[];
}

export default function RunTimeline({ events, errors }: RunTimelineProps) {
  return (
    <div className="card timeline-card">
      <div className="timeline-header">
        <h2>Execution Timeline</h2>
        <span className="timeline-count">{events.length} events</span>
      </div>

      {events.length === 0 && errors.length === 0 ? (
        <div className="timeline-empty">
          <div className="timeline-empty-icon">⬡</div>
          <p>
            Run the agent to watch its LangGraph nodes execute in real time.
            <br />
            Each step — planning, search, critique, HITL — will appear here.
          </p>
        </div>
      ) : (
        <>
          <ol className="timeline-list" aria-label="Agent execution steps">
            {events.map((ev) => (
              <li key={ev.id} className="timeline-item">
                <div className="timeline-left">
                  <TimelineDot status={ev.status} node={ev.node} />
                </div>
                <div className="timeline-body">
                  <div className="timeline-node-label">{ev.label}</div>
                  <p className="timeline-detail">{ev.detail}</p>
                  <time className="timeline-time" dateTime={ev.at}>
                    {new Date(ev.at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </time>
                </div>
              </li>
            ))}
          </ol>

          {errors.map((err, i) => (
            <div key={i} className="error-msg">
              <span>⚠</span>
              <span>{err}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
