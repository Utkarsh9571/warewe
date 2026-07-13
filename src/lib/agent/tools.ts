import "server-only";
import Parser from "rss-parser";
import * as cheerio from "cheerio";
import { env } from "@/lib/env";
import type { Article, Draft, SearchResult } from "./types";

// === HTTP helpers ===========================================================

const timeoutFetch = async (url: string, ms = 10000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "NewsletterAgent/1.0 (+assignment-demo)",
        Accept: "text/html,application/xhtml+xml,*/*;q=0.9",
      },
      redirect: "follow",
    });
  } finally {
    clearTimeout(timer);
  }
};

const clean = (text: string) => text.replace(/\s+/g, " ").trim();

// === Tool 1: News Search =====================================================

export async function searchNews(query: string): Promise<SearchResult[]> {
  if (env.newsProvider === "newsapi" && env.newsKey) {
    const url = `https://newsapi.org/v2/everything?language=en&sortBy=publishedAt&pageSize=20&q=${encodeURIComponent(query)}`;
    const res = await timeoutFetch(url + `&apiKey=${env.newsKey}`);
    if (!res.ok) throw new Error(`NewsAPI returned ${res.status}`);
    const data = (await res.json()) as {
      articles?: Array<{
        title?: string;
        url?: string;
        description?: string;
        publishedAt?: string;
        source?: { name?: string };
      }>;
    };
    return (data.articles || [])
      .filter((a) => a.title && a.url && a.publishedAt)
      .map((a) => ({
        title: a.title!,
        url: a.url!,
        snippet: a.description || "",
        publishedAt: a.publishedAt!,
        source: a.source?.name || "Unknown source",
      }));
  }

  // Keyless fallback: Google News RSS
  const parser = new Parser();
  const feed = await parser.parseURL(
    `https://news.google.com/rss/search?q=${encodeURIComponent(query + " when:7d")}&hl=en-US&gl=US&ceid=US:en`
  );
  return (feed.items || [])
    .filter((i) => i.link && i.title)
    .map((i) => ({
      title: clean(i.title!),
      url: i.link!,
      snippet: clean(i.contentSnippet || i.content || ""),
      publishedAt: i.isoDate || i.pubDate || new Date().toISOString(),
      source: i.creator || "Google News",
    }));
}

// === Deduplication ==========================================================

export function dedupeSources(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results.filter((r) => {
    const key = r.title.toLowerCase().replace(/\W/g, "") || r.url;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// === Tool 2: Article Fetch ==================================================

export async function fetchArticle(source: SearchResult): Promise<Article> {
  try {
    const res = await timeoutFetch(source.url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();
    const $ = cheerio.load(html);

    // Remove noise elements
    $(
      "script,style,nav,footer,header,aside,form,noscript,iframe,figure,picture"
    ).remove();

    // Try content selectors in priority order
    const candidates = [
      "article",
      "main",
      '[role="main"]',
      ".article-body",
      ".article-content",
      ".post-content",
      ".entry-content",
      ".story-body",
      "#article-body",
    ]
      .map((s) => clean($(s).text()))
      .sort((a, b) => b.length - a.length);

    const content = (candidates[0] || clean($("body").text())).slice(0, 12000);

    if (content.length < 300) {
      throw new Error(
        "Publisher page did not expose enough readable article text"
      );
    }

    return { ...source, content, evidenceType: "article" };
  } catch (error) {
    const msg =
      error instanceof Error ? error.message : "Article fetch failed";
    // Degrade to snippet if available
    if (source.snippet.length >= 80) {
      return {
        ...source,
        content: source.snippet,
        evidenceType: "snippet",
        fetchError: msg,
      };
    }
    return {
      ...source,
      content: "",
      evidenceType: "snippet",
      fetchError: msg,
    };
  }
}

// === Tool 3: Newsletter Renderer ============================================

const esc = (v: string) =>
  v.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!)
  );

export function renderNewsletter(draft: Draft): string {
  const items = draft.items
    .map(
      (item, i) => `
    <article>
      <div class="item-number">${String(i + 1).padStart(2, "0")}</div>
      <div class="item-body">
        <h2><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.title)}</a></h2>
        <p class="meta">
          ${esc(item.source)} &middot;
          ${esc(new Date(item.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }))}
          ${item.evidenceType === "snippet" ? '<span class="snippet-badge">Search-snippet evidence</span>' : ""}
        </p>
        <p class="summary">${esc(item.summary)}</p>
        <div class="why-matters">
          <strong>Why it matters:</strong> ${esc(item.whyItMatters)}
        </div>
        <a class="read-more" href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">Read full article &rarr;</a>
      </div>
    </article>`
    )
    .join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(draft.subject)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #f0f2f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #1a2035; }
    .wrapper { max-width: 680px; margin: 32px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,.1); }
    .header { background: linear-gradient(135deg, #1a2a6c, #3c4fe0); padding: 40px 40px 32px; color: #fff; }
    .eyebrow { font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #a9baff; text-transform: uppercase; margin: 0 0 10px; }
    h1 { font-size: 28px; line-height: 1.2; margin: 0 0 12px; color: #fff; }
    .preview-text { color: #c5d0ff; font-size: 14px; margin: 0; }
    .intro { padding: 28px 40px 20px; font-size: 15px; line-height: 1.7; color: #4a5568; border-bottom: 1px solid #e2e8f0; }
    .content { padding: 0 40px; }
    article { display: flex; gap: 20px; padding: 28px 0; border-bottom: 1px solid #e2e8f0; }
    .item-number { font-size: 11px; font-weight: 800; color: #3c4fe0; letter-spacing: 1px; min-width: 24px; padding-top: 4px; }
    .item-body { flex: 1; }
    h2 { font-size: 17px; margin: 0 0 6px; line-height: 1.3; }
    h2 a { color: #1a2035; text-decoration: none; }
    h2 a:hover { color: #3c4fe0; }
    .meta { font-size: 12px; color: #8899aa; margin: 0 0 10px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .snippet-badge { background: #fff3cd; color: #856404; padding: 2px 7px; border-radius: 20px; font-size: 11px; font-weight: 600; }
    .summary { font-size: 14px; line-height: 1.65; color: #334155; margin: 0 0 12px; }
    .why-matters { font-size: 13px; line-height: 1.55; color: #475569; background: #f0f4ff; padding: 12px 14px; border-radius: 8px; border-left: 3px solid #3c4fe0; margin-bottom: 12px; }
    .read-more { font-size: 13px; color: #3c4fe0; text-decoration: none; font-weight: 600; }
    .footer { padding: 28px 40px; background: #f8fafc; color: #8899aa; font-size: 13px; line-height: 1.6; }
    .footer p { margin: 0 0 8px; }
    @media (max-width: 600px) {
      .header, .intro, .content, .footer { padding-left: 20px; padding-right: 20px; }
      h1 { font-size: 22px; }
      article { flex-direction: column; gap: 6px; }
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <header class="header">
      <p class="eyebrow">SignalBrief &bull; Weekly AI Intelligence</p>
      <h1>${esc(draft.subject)}</h1>
      <p class="preview-text">${esc(draft.previewText)}</p>
    </header>
    <div class="intro">${esc(draft.intro)}</div>
    <div class="content">${items}</div>
    <footer class="footer">
      <p>${esc(draft.closing)}</p>
      <p style="margin-top:16px;font-size:11px;color:#b0bec5;">
        This newsletter was generated by SignalBrief, an autonomous LangGraph agent. 
        This is a simulated send for demonstration purposes only. No email was actually delivered.
      </p>
    </footer>
  </div>
</body>
</html>`;
}
