import { z } from "zod";
import { interrupt } from "@langchain/langgraph";
import { event } from "./state";
import { structured } from "./llm";
import {
  ArticleSchema,
  CritiqueSchema,
  DraftSchema,
  PlanSchema,
  SummarySchema,
  type AgentState,
  type SearchResult,
} from "./types";
import {
  critiquePrompt,
  draftPrompt,
  planPrompt,
  revisionPrompt,
  selectionPrompt,
  summaryPrompt,
} from "./prompts";
import { dedupeSources, fetchArticle, renderNewsletter, searchNews } from "./tools";
import { env } from "@/lib/env";

// === Error helper ============================================================

const makeError = (node: string, error: unknown) => ({
  errors: [
    {
      node,
      message: error instanceof Error ? error.message : "Unknown error",
      recoverable: true,
    },
  ],
});

// === Node 1: Plan ============================================================

export async function planNode(state: AgentState) {
  try {
    const plan = await structured(PlanSchema, planPrompt(state.goal));
    return {
      plan,
      events: [
        event(
          "plan",
          "Planning",
          "completed",
          `Topic: "${plan.topic}" · ${plan.queries.length} queries prepared · Target ${plan.articleTarget} articles · Angle: "${plan.angle}"`
        ),
      ],
    };
  } catch (e) {
    return {
      ...makeError("plan", e),
      status: "failed" as const,
      events: [event("plan", "Planning", "warning", "Planning failed. Check Gemini API key and model.")],
    };
  }
}

// === Node 2: Search ==========================================================

export async function searchNode(state: AgentState) {
  try {
    const queries = state.plan?.queries || [
      "latest AI agent news",
      "agentic AI announcements",
    ];
    const provider = env.newsProvider === "newsapi" && env.newsKey ? "NewsAPI" : "Google News RSS";
    const batches = await Promise.allSettled(queries.map(searchNews));
    const found = batches.flatMap((r) =>
      r.status === "fulfilled" ? r.value : []
    );
    const cutoff = Date.now() - 14 * 86_400_000;
    const results = dedupeSources(found).filter(
      (r) => Date.parse(r.publishedAt) >= cutoff
    );
    const queryList = queries.map((q) => `"${q}"`).join(", ");
    return {
      searchResults: results,
      events: [
        event(
          "search",
          "News search",
          "completed",
          `Provider: ${provider} · Queries: ${queryList} · ${results.length} unique sources discovered${state.retried ? " (broader retry)" : ""}`
        ),
      ],
    };
  } catch (e) {
    return {
      ...makeError("search", e),
      status: "failed" as const,
      events: [
        event(
          "search",
          "News search",
          "warning",
          "Search provider failed. Ensure network access and valid API keys."
        ),
      ],
    };
  }
}

// === Node 3: Select ==========================================================

export async function selectNode(state: AgentState) {
  try {
    const candidates = state.searchResults.slice(0, 30);
    // Assign simple source IDs to prevent URL base64 token output limit truncation
    const mappedCandidates = candidates.map((c, i) => ({
      id: `source_${i}`,
      title: c.title,
      source: c.source,
      publishedAt: c.publishedAt,
      snippet: c.snippet,
    }));

    const selectedIds = await structured(
      z.array(z.string()).min(1).max(9),
      selectionPrompt(JSON.stringify(mappedCandidates))
    );

    const picked = selectedIds
      .map((id) => {
        const idx = parseInt(id.replace("source_", ""), 10);
        return candidates[idx];
      })
      .filter(Boolean) as SearchResult[];

    const selected = picked.length ? picked : candidates.slice(0, 9);
    return {
      selected,
      events: [
        event(
          "select",
          "Rank and select sources",
          "completed",
          `${selected.length} sources selected for retrieval (from ${candidates.length} candidates)`
        ),
      ],
    };
  } catch (e) {
    const selected = state.searchResults.slice(0, 9);
    return {
      ...makeError("select", e),
      selected,
      events: [
        event(
          "select",
          "Rank and select sources",
          "warning",
          `LLM ranking degraded to deterministic recency order; ${selected.length} sources selected`
        ),
      ],
    };
  }
}

// === Node 4: Collect =========================================================

export async function collectNode(state: AgentState) {
  const collected = await Promise.all(state.selected.map(fetchArticle));
  const usable = collected.filter((a) => a.content.length >= 80);
  const full = usable.filter((a) => a.evidenceType === "article").length;
  const snippet = usable.filter((a) => a.evidenceType === "snippet").length;
  const failed = state.selected.length - usable.length;
  return {
    articles: usable,
    events: [
      event(
        "collect",
        "Article fetching",
        failed > 0 ? "warning" : "completed",
        `${usable.length}/${state.selected.length} usable · ${full} full articles · ${snippet} snippet-only · ${failed} failed/blocked`
      ),
    ],
  };
}

// === Node 5: Summarize =======================================================

export async function summarizeNode(state: AgentState) {
  try {
    const usable = state.articles.filter((a) => a.content.length >= 80).slice(0, 9);
    if (usable.length < 5) {
      return {
        summaries: [],
        events: [
          event(
            "summarize",
            "Summarization",
            "warning",
            `Only ${usable.length} usable sources. Need ≥5. ${state.retried ? "Retry already attempted." : "Will broaden search."}`
          ),
        ],
      };
    }
    const schema = z.array(SummarySchema).min(5).max(7);
    const summaries = await structured(
      schema,
      summaryPrompt(JSON.stringify(usable.map((a) => ({ ...a, content: a.content.slice(0, 6000) }))))
    );
    const snippetCount = summaries.filter((s) => s.evidenceType === "snippet").length;
    return {
      summaries,
      events: [
        event(
          "summarize",
          "Summarization",
          "completed",
          `${summaries.length} grounded summaries created · ${snippetCount > 0 ? `${snippetCount} marked as snippet-only evidence` : "all full-article evidence"}`
        ),
      ],
    };
  } catch (e) {
    return {
      ...makeError("summarize", e),
      summaries: [],
      events: [
        event(
          "summarize",
          "Summarization",
          "warning",
          "Structured summary generation failed. LLM output may not have matched schema."
        ),
      ],
    };
  }
}

// === Node 6: Broaden (retry) =================================================

export async function broadenNode(state: AgentState) {
  const plan = {
    ...(state.plan!),
    queries: [
      "AI agents product launch enterprise research 2024 2025",
      "autonomous AI system industry news applications",
      "LLM agent framework announcement",
    ],
    articleTarget: 7,
  };
  return {
    plan,
    retried: true,
    events: [
      event(
        "broaden",
        "Broader research retry",
        "completed",
        `Fewer than 5 usable sources found. Running one broader search with ${plan.queries.length} expanded queries.`
      ),
    ],
  };
}

// === Node 7: Draft ===========================================================

export async function draftNode(state: AgentState) {
  try {
    const draft = await structured(
      DraftSchema,
      draftPrompt(JSON.stringify(state.summaries))
    );
    return {
      draft,
      finalNewsletter: draft,
      events: [
        event(
          "draft",
          "Newsletter drafting",
          "completed",
          `${draft.items.length} items drafted · Subject: "${draft.subject}"`
        ),
      ],
    };
  } catch (e) {
    return {
      ...makeError("draft", e),
      status: "failed" as const,
      events: [event("draft", "Newsletter drafting", "warning", "Draft generation failed.")],
    };
  }
}

// === Node 8: Critique ========================================================

export async function critiqueNode(state: AgentState) {
  try {
    const critique = await structured(
      CritiqueSchema,
      critiquePrompt(JSON.stringify(state.draft))
    );
    return {
      critique,
      events: [
        event(
          "critique",
          "Self-critique",
          "completed",
          `Score: ${critique.score}/100 · Decision: ${critique.decision.toUpperCase()} · ${critique.issues.length} issue(s) identified`
        ),
      ],
    };
  } catch (e) {
    return {
      ...makeError("critique", e),
      critique: {
        score: 100,
        decision: "pass" as const,
        issues: ["Critique unavailable; draft retained as-is."],
        revisionInstructions: [],
      },
      events: [
        event(
          "critique",
          "Self-critique",
          "warning",
          "Critique generation failed; passing draft through."
        ),
      ],
    };
  }
}

// === Node 9: Revise ==========================================================

export async function reviseNode(state: AgentState) {
  try {
    const finalNewsletter = await structured(
      DraftSchema,
      revisionPrompt(JSON.stringify(state.draft), JSON.stringify(state.critique))
    );
    return {
      finalNewsletter,
      revised: true,
      events: [
        event(
          "revise",
          "Revision",
          "completed",
          `One critique-driven revision applied. Instructions addressed: ${state.critique?.revisionInstructions.length || 0}`
        ),
      ],
    };
  } catch (e) {
    return {
      ...makeError("revise", e),
      finalNewsletter: state.draft,
      revised: true,
      events: [
        event(
          "revise",
          "Revision",
          "warning",
          "Revision failed; retaining original draft."
        ),
      ],
    };
  }
}

// === Node 10: Approval (HITL checkpoint) =====================================

export function approvalNode(state: AgentState) {
  if (state.mode === "autonomous") {
    return {
      events: [
        event(
          "approval",
          "Autonomous output",
          "completed",
          "Autonomous mode: human approval checkpoint bypassed. Proceeding to simulated send."
        ),
      ],
    };
  }

  // LangGraph interrupt — graph pauses here until resumed with a Command
  const decision = interrupt({
    runId: state.runId,
    newsletter: state.finalNewsletter,
    critique: state.critique,
    message: "Review the newsletter and approve or reject simulated sending.",
  }) as { approved?: boolean };

  if (!decision?.approved) {
    return {
      status: "cancelled" as const,
      events: [
        event(
          "approval",
          "HITL approval",
          "cancelled",
          "Human reviewer rejected simulated sending. Run cancelled without output."
        ),
      ],
    };
  }

  return {
    events: [
      event(
        "approval",
        "HITL approval",
        "completed",
        "Human reviewer approved simulated sending. Resuming graph."
      ),
    ],
  };
}

// === Node 11: Send ===========================================================

export function sendNode(state: AgentState) {
  if (state.status === "cancelled") return {};
  const newsletter = state.finalNewsletter!;
  const html = renderNewsletter(newsletter);
  const recipientCount = env.recipients;
  return {
    html,
    status: "completed" as const,
    output: {
      status: "simulated_sent" as const,
      subject: newsletter.subject,
      recipientCount,
      sentAt: new Date().toISOString(),
    },
    events: [
      event(
        "send",
        "Simulated send",
        "completed",
        `Newsletter "${newsletter.subject}" simulated to ${recipientCount.toLocaleString()} subscribers. No actual email was sent.`
      ),
    ],
  };
}
