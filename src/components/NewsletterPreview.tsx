"use client";
import type { AgentOutput, Draft } from "@/lib/agent/types";

interface NewsletterPreviewProps {
  draft: Draft;
  html?: string;
  output?: AgentOutput;
  onDownload: () => void;
}

export default function NewsletterPreview({
  draft,
  html,
  output,
  onDownload,
}: NewsletterPreviewProps) {
  return (
    <>
      {/* Output confirmation banner */}
      {output && (
        <div className="card output-card">
          <div className="output-header">
            <div className="output-title">
              <span className="output-check">✅</span>
              Simulated send complete
            </div>
          </div>
          <div className="output-body">
            <div className="output-stat">
              <div className="output-stat-label">Subject</div>
              <div className="output-stat-value">{output.subject}</div>
            </div>
            <div className="output-stat">
              <div className="output-stat-label">Recipients</div>
              <div className="output-stat-value">
                {output.recipientCount.toLocaleString()} (simulated)
              </div>
            </div>
            <div className="output-stat">
              <div className="output-stat-label">Sent at</div>
              <div className="output-stat-value">
                {new Date(output.sentAt).toLocaleString()}
              </div>
            </div>
            <div className="output-stat">
              <div className="output-stat-label">Status</div>
              <div className="output-stat-value" style={{ textTransform: "capitalize" }}>
                {output.status.replace("_", " ")}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Newsletter preview card */}
      <div className="card preview-card">
        <div className="preview-header">
          <div>
            <p className="preview-eyebrow">Newsletter preview</p>
            <h2 className="preview-subject">{draft.subject}</h2>
            <p className="preview-text-tag">{draft.previewText}</p>
          </div>
          {html && (
            <button
              id="download-btn"
              className="download-btn"
              onClick={onDownload}
              title="Download newsletter as HTML file"
            >
              ↓ Download HTML
            </button>
          )}
        </div>

        <div className="preview-intro">{draft.intro}</div>

        <div className="preview-items">
          {draft.items.map((item, i) => (
            <div key={`${item.url}-${i}`} className="preview-item">
              <span className="preview-item-num">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="preview-item-body">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="preview-item-title"
                >
                  {item.title}
                </a>
                <div className="preview-item-meta">
                  <span className="preview-item-source">{item.source}</span>
                  <span className="preview-item-date">·</span>
                  <span className="preview-item-date">
                    {new Date(item.publishedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  {item.evidenceType === "snippet" && (
                    <span className="snippet-chip">snippet evidence</span>
                  )}
                </div>
                <p className="preview-item-summary">{item.summary}</p>
                <div className="preview-item-why">
                  <strong>Why it matters:</strong> {item.whyItMatters}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="preview-closing">{draft.closing}</div>
      </div>
    </>
  );
}
