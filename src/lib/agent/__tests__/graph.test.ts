import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type {
  Plan,
  Summary,
  Draft,
  Critique,
  AgentState,
} from "../types";

// === Mocks ====================================================================

// Mock LangGraph entirely to avoid ESM package exports mismatch
vi.mock("@langchain/langgraph", () => {
  // Annotation needs to be both a generic type tag AND a callable with options
  const AnnotationFn = Object.assign(
    function Annotation<T>() { return { value: undefined as T }; },
    {
      Root: vi.fn((config: Record<string, unknown>) => config),
    }
  );
  // Make Annotation callable with options (reducer pattern)
  const AnnotationCallable = new Proxy(AnnotationFn, {
    apply(_target, _thisArg, args) {
      // Annotation<T>(options) - return the options object
      return args[0] || {};
    },
  });

  return {
    interrupt: vi.fn((payload) => payload),
    Annotation: AnnotationCallable,
    MemorySaver: vi.fn(() => ({})),
    START: "__start__",
    END: "__end__",
    StateGraph: vi.fn(() => ({
      addNode: vi.fn().mockReturnThis(),
      addEdge: vi.fn().mockReturnThis(),
      addConditionalEdges: vi.fn().mockReturnThis(),
      compile: vi.fn(() => ({
        stream: vi.fn(),
        getState: vi.fn(),
      })),
    })),
    Command: vi.fn(),
  };
});

vi.mock("@langchain/core/runnables", () => ({ RunnableSequence: vi.fn() }));

vi.mock("../llm", () => ({
  structured: vi.fn(),
  model: vi.fn(),
}));

vi.mock("../tools", () => ({
  searchNews: vi.fn().mockResolvedValue([
    {
      title: "AI Agent News",
      url: "https://example.com/1",
      source: "TechCrunch",
      publishedAt: new Date().toISOString(),
      snippet: "Snippet about AI agents that is long enough.",
    },
  ]),
  fetchArticle: vi.fn().mockResolvedValue({
    title: "AI Agent News",
    url: "https://example.com/1",
    source: "TechCrunch",
    publishedAt: new Date().toISOString(),
    snippet: "Snippet",
    content: "Full article content about AI agents and their developments.",
    evidenceType: "article",
  }),
  dedupeSources: vi.fn((r) => r),
  renderNewsletter: vi.fn().mockReturnValue("<html><body>Newsletter</body></html>"),
}));

vi.mock("server-only", () => ({}));

vi.mock("@/lib/env", () => ({
  env: {
    geminiKey: "test-key",
    geminiModel: "gemini-2.5-flash",
    newsKey: undefined,
    newsProvider: "rss",
    recipients: 1000,
  },
  requireGeminiKey: () => "test-key",
}));

// === Test fixtures ============================================================

const mockPlan: Plan = {
  topic: "AI Agents",
  audience: "Tech professionals",
  angle: "Weekly roundup",
  queries: ["AI agent news", "autonomous AI"],
  articleTarget: 5,
};

const mockSummaries: Summary[] = Array.from({ length: 5 }, (_, i) => ({
  title: `Article ${i + 1}`,
  url: `https://example.com/${i + 1}`,
  source: `Source ${i + 1}`,
  publishedAt: new Date().toISOString(),
  summary: `Summary of article ${i + 1} with enough detail to satisfy the minimum schema requirement.`,
  whyItMatters: `This matters because it demonstrates AI advancement number ${i + 1}.`,
  evidenceType: "article" as const,
}));

const mockDraft: Draft = {
  subject: "AI Agents Weekly: Five Key Developments",
  previewText: "Your weekly briefing on AI agent advances",
  intro: "Here are this week's top AI agent stories.",
  items: mockSummaries,
  closing: "That's all for this week. Stay curious.",
};

const mockCritiquePass: Critique = {
  score: 90,
  decision: "pass",
  issues: [],
  revisionInstructions: [],
};

const mockCritiqueRevise: Critique = {
  score: 70,
  decision: "revise",
  issues: ["Subject line too vague"],
  revisionInstructions: ["Make subject line more specific with key theme"],
};

const makeBaseState = (): AgentState => ({
  runId: "test-run-id",
  goal: "Create a weekly AI newsletter",
  mode: "autonomous",
  status: "running",
  searchResults: [],
  selected: [],
  articles: [],
  summaries: [],
  events: [],
  errors: [],
  retried: false,
  revised: false,
});

// === planNode tests ===========================================================

describe("planNode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-14T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a plan and completed event on success", async () => {
    const { structured } = await import("../llm");
    vi.mocked(structured).mockResolvedValueOnce(mockPlan);

    const { planNode } = await import("../nodes");
    const result = await planNode(makeBaseState());

    expect(result.plan).toEqual(mockPlan);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].status).toBe("completed");
    expect(result.events[0].node).toBe("plan");
    expect(result.events[0].detail).toContain("AI Agents");
    expect(structured).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining("2026-07-14T12:00:00.000Z")
    );
  });

  it("returns failed status and warning event on LLM error", async () => {
    const { structured } = await import("../llm");
    vi.mocked(structured).mockRejectedValueOnce(new Error("LLM error"));

    const { planNode } = await import("../nodes");
    const result = await planNode(makeBaseState());

    expect(result.status).toBe("failed");
    expect(result.events[0].status).toBe("warning");
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].node).toBe("plan");
  });
});

// === critiqueNode tests =======================================================

describe("critiqueNode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-14T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns pass critique with score in event detail", async () => {
    const { structured } = await import("../llm");
    vi.mocked(structured).mockResolvedValueOnce(mockCritiquePass);

    const { critiqueNode } = await import("../nodes");
    const state = { ...makeBaseState(), draft: mockDraft };
    const result = await critiqueNode(state);

    expect(result.critique?.decision).toBe("pass");
    expect(result.critique?.score).toBe(90);
    expect(result.events[0].detail).toContain("90/100");
    expect(result.events[0].detail).toContain("PASS");
    expect(result.events[0].status).toBe("completed");
    expect(structured).toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining("2026-07-14T12:00:00.000Z")
    );
  });

  it("returns revise critique with issues listed", async () => {
    const { structured } = await import("../llm");
    vi.mocked(structured).mockResolvedValueOnce(mockCritiqueRevise);

    const { critiqueNode } = await import("../nodes");
    const state = { ...makeBaseState(), draft: mockDraft };
    const result = await critiqueNode(state);

    expect(result.critique?.decision).toBe("revise");
    expect(result.critique?.issues).toContain("Subject line too vague");
    expect(result.critique?.revisionInstructions.length).toBeGreaterThan(0);
  });

  it("falls back to pass-100 critique when LLM fails", async () => {
    const { structured } = await import("../llm");
    vi.mocked(structured).mockRejectedValueOnce(new Error("LLM unavailable"));

    const { critiqueNode } = await import("../nodes");
    const state = { ...makeBaseState(), draft: mockDraft };
    const result = await critiqueNode(state);

    expect(result.critique?.score).toBe(100);
    expect(result.critique?.decision).toBe("pass");
    expect(result.events[0].status).toBe("warning");
    expect(result.errors).toHaveLength(1);
  });
});

// === approvalNode tests =======================================================

describe("approvalNode", () => {
  it("bypasses approval and emits completed event in autonomous mode", async () => {
    const { approvalNode } = await import("../nodes");
    const state = { ...makeBaseState(), mode: "autonomous" as const };
    const result = approvalNode(state);

    expect(result.events[0].status).toBe("completed");
    expect(result.events[0].detail).toContain("Autonomous");
    expect(result.events[0].node).toBe("approval");
  });

  it("calls interrupt() in human mode", async () => {
    const { interrupt } = await import("@langchain/langgraph");
    const { approvalNode } = await import("../nodes");

    // In human mode, interrupt() is called. Our mock returns the payload.
    // Since our mock returns { approved: true }, the node should return completed.
    vi.mocked(interrupt).mockReturnValueOnce({ approved: true });

    const state = { ...makeBaseState(), mode: "human" as const, finalNewsletter: mockDraft };
    const result = approvalNode(state);

    expect(vi.mocked(interrupt)).toHaveBeenCalledOnce();
    expect(result.events[0].node).toBe("approval");
  });
});

// === broadenNode tests =======================================================

describe("broadenNode", () => {
  it("sets retried to true and expands queries", async () => {
    const { broadenNode } = await import("../nodes");
    const state = { ...makeBaseState(), plan: mockPlan };
    const result = await broadenNode(state);

    expect(result.retried).toBe(true);
    expect(result.plan?.queries.length).toBeGreaterThanOrEqual(2);
    expect(result.events[0].node).toBe("broaden");
    expect(result.events[0].status).toBe("completed");

    // Verify broadenNode contains no hardcoded historical years
    const hasHistoricalYear = result.plan?.queries.some((q) => /\b(19|20)\d{2}\b/.test(q));
    expect(hasHistoricalYear).toBe(false);
  });
});

// === sendNode tests ===========================================================

describe("sendNode", () => {
  it("sets completed status, output metadata, and renders HTML", async () => {
    const { sendNode } = await import("../nodes");
    const state = {
      ...makeBaseState(),
      finalNewsletter: mockDraft,
    };
    const result = sendNode(state);

    expect(result.status).toBe("completed");
    expect(result.output?.status).toBe("simulated_sent");
    expect(result.output?.subject).toBe(mockDraft.subject);
    expect(result.output?.recipientCount).toBe(1000);
    expect(result.html).toBeTruthy();
    expect(result.events[0].node).toBe("send");
  });

  it("returns empty object when status is already cancelled", async () => {
    const { sendNode } = await import("../nodes");
    const state = {
      ...makeBaseState(),
      status: "cancelled" as const,
      finalNewsletter: mockDraft,
    };
    const result = sendNode(state);
    expect(Object.keys(result)).toHaveLength(0);
  });
});

// === summarizeNode tests ======================================================

describe("summarizeNode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty summaries and warning when fewer than 5 usable articles", async () => {
    const { summarizeNode } = await import("../nodes");
    // Articles need content.length >= 80 to count as usable
    const longContent = "This is a sufficiently long article content string that exceeds the eighty character minimum.";
    const state = {
      ...makeBaseState(),
      articles: [
        { ...mockSummaries[0], content: longContent, evidenceType: "article" as const },
        { ...mockSummaries[1], content: longContent, evidenceType: "article" as const },
      ],
    };
    const result = await summarizeNode(state);

    expect(result.summaries).toHaveLength(0);
    expect(result.events[0].status).toBe("warning");
    // The message will say "Only 2 usable sources"
    expect(result.events[0].detail).toContain("Only 2");
  });
});

// === Prompt Temporal Grounding tests ==========================================

describe("planning and critique prompts", () => {
  it("planning prompt includes the supplied current date", async () => {
    const { planPrompt } = await import("../prompts");
    const goal = "Create a newsletter on AI agents";
    const date = "2026-07-14T12:00:00Z";
    const prompt = planPrompt(goal, date);
    expect(prompt).toContain(date);
    expect(prompt).toContain("last 7-14 days");
    expect(prompt).toContain("Do NOT generate stale year-specific queries");
  });

  it("critique prompt includes the supplied current date and distinguishes stale from future-dated sources", async () => {
    const { critiquePrompt } = await import("../prompts");
    const draft = "draft contents here";
    const date = "2026-07-14T12:00:00Z";
    const prompt = critiquePrompt(draft, date);
    expect(prompt).toContain(date);
    expect(prompt).toContain("only temporal reference");
    expect(prompt).toContain("identify stale sources");
    expect(prompt).toContain("identify genuinely future-dated sources");
  });
});
