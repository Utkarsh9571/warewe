import { describe, it, expect, vi } from "vitest";
import { dedupeSources, renderNewsletter } from "../tools";
import type { Draft, SearchResult } from "../types";

// === dedupeSources ============================================================

describe("dedupeSources", () => {
  const makeResult = (title: string, url: string): SearchResult => ({
    title,
    url,
    source: "Test",
    publishedAt: new Date().toISOString(),
    snippet: "",
  });

  it("removes exact title duplicates", () => {
    const results = [
      makeResult("AI Agents Rise", "https://a.com/1"),
      makeResult("AI Agents Rise", "https://a.com/2"),
      makeResult("Different Story", "https://b.com/1"),
    ];
    const deduped = dedupeSources(results);
    expect(deduped).toHaveLength(2);
    expect(deduped[0].title).toBe("AI Agents Rise");
    expect(deduped[1].title).toBe("Different Story");
  });

  it("normalizes whitespace and punctuation for comparison", () => {
    const results = [
      makeResult("AI Agents: The Rise!", "https://a.com/1"),
      makeResult("AI Agents The Rise", "https://b.com/1"),
      makeResult("New Story", "https://c.com/1"),
    ];
    const deduped = dedupeSources(results);
    // Both normalize to "AIAgentsTheRise" (stripping punctuation)
    expect(deduped).toHaveLength(2);
  });

  it("keeps unique results unchanged", () => {
    const results = [
      makeResult("Story A", "https://a.com/1"),
      makeResult("Story B", "https://b.com/1"),
      makeResult("Story C", "https://c.com/1"),
    ];
    expect(dedupeSources(results)).toHaveLength(3);
  });

  it("handles empty input", () => {
    expect(dedupeSources([])).toEqual([]);
  });
});

// === renderNewsletter =========================================================

const makeDraft = (): Draft => ({
  subject: "AI Agents Weekly",
  previewText: "This week in AI agents",
  intro: "Here are the top AI agent stories.",
  closing: "Thanks for reading.",
  items: Array.from({ length: 5 }, (_, i) => ({
    title: `Story ${i + 1}`,
    url: `https://example.com/${i + 1}`,
    source: `Source ${i + 1}`,
    publishedAt: new Date().toISOString(),
    summary: `Summary of story ${i + 1} with enough detail.`,
    whyItMatters: `This matters because of reason ${i + 1}.`,
    evidenceType: i === 0 ? "snippet" : "article",
  })),
});

describe("renderNewsletter", () => {
  it("returns a complete HTML document", () => {
    const html = renderNewsletter(makeDraft());
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
  });

  it("includes the subject line", () => {
    const html = renderNewsletter(makeDraft());
    expect(html).toContain("AI Agents Weekly");
  });

  it("escapes HTML special characters in subject", () => {
    const draft = {
      ...makeDraft(),
      subject: '<script>alert("xss")</script>',
    };
    const html = renderNewsletter(draft);
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes ampersands in URLs", () => {
    const draft = makeDraft();
    draft.items[0].url = "https://example.com?a=1&b=2";
    const html = renderNewsletter(draft);
    expect(html).toContain("https://example.com?a=1&amp;b=2");
  });

  it("marks snippet-only items visually", () => {
    const html = renderNewsletter(makeDraft());
    expect(html).toContain("Search-snippet evidence");
  });

  it("includes all 5 items", () => {
    const html = renderNewsletter(makeDraft());
    for (let i = 1; i <= 5; i++) {
      expect(html).toContain(`Story ${i}`);
    }
  });

  it("opens links with noopener noreferrer", () => {
    const html = renderNewsletter(makeDraft());
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("includes closing text", () => {
    const html = renderNewsletter(makeDraft());
    expect(html).toContain("Thanks for reading.");
  });
});

// === Mock fetchArticle behaviour ==============================================

describe("fetchArticle degradation", () => {
  it("returns snippet evidence when fetch fails and snippet is available", async () => {
    // We mock fetch to simulate a blocked publisher
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Connection refused")));

    const { fetchArticle } = await import("../tools");
    const source: SearchResult = {
      title: "Test Article",
      url: "https://blocked-publisher.com/article",
      source: "Blocked Publisher",
      publishedAt: new Date().toISOString(),
      snippet: "This is a sufficiently long snippet that meets the 80-char minimum threshold required.",
    };

    const result = await fetchArticle(source);
    expect(result.evidenceType).toBe("snippet");
    expect(result.fetchError).toBeDefined();
    expect(result.content).toBe(source.snippet);

    vi.unstubAllGlobals();
  });
});
