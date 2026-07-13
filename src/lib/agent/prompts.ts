export const SYSTEM = `You are a careful newsletter research editor. \
Use ONLY the supplied source evidence. \
Never invent facts, dates, quotes, publishers, or URLs. \
Write concise, practical copy for technology professionals. \
Always comply with the JSON schema exactly.`;

export const planPrompt = (goal: string) => `${SYSTEM}

Create a structured research plan for this newsletter goal:
"${goal}"

Focus on recent AI agent news and developments. Produce 2-3 diverse search queries that will surface different angles of the topic. \
Choose a target of 5-7 articles and create a compelling editorial angle. Return valid JSON matching the schema.`;

export const selectionPrompt = (sources: string) => `${SYSTEM}

Select up to 9 of the strongest candidates from these search results. \
Prioritize: AI-agent relevance, recency (newer = better), source diversity, and substantive snippets that suggest real article content. \
Discard duplicates and weak/unrelated results. \
Return an array of URLs only (JSON array of strings).

SOURCES:
${sources}`;

export const summaryPrompt = (articles: string) => `${SYSTEM}

Create grounded summaries for EACH usable article below. Requirements:
- Use ONLY information present in the article content or snippet
- A snippet-only article may be summarized only when its snippet clearly supports the summary
- Preserve the exact evidenceType from the input
- Never fabricate quotes, statistics, or claims not in the source
- Each summary must be 2-3 clear sentences; whyItMatters must explain the significance

Return 5-7 summaries as a JSON array.

ARTICLES:
${articles}`;

export const draftPrompt = (summaries: string) => `${SYSTEM}

Draft a clean, professional weekly newsletter from the supplied summaries. Requirements:
- Include EXACTLY 5-7 items (one per summary provided)
- Preserve titles, URLs, source, publishedAt, evidenceType from the summaries unchanged
- Write an engaging subject line (under 60 chars), preview text (under 90 chars), intro paragraph, and brief closing
- Do NOT add items not in the summaries

SUMMARIES:
${summaries}`;

export const critiquePrompt = (draft: string) => `${SYSTEM}

Critically evaluate this newsletter draft. Check ALL of the following:
1. Article count (must be 5-7)
2. All URLs are real and from the source data (not fabricated)
3. No duplicated stories or sources
4. Recency (prefer articles from last 7-14 days)
5. Scanability and clear editorial value
6. Unsupported claims not in article content
7. Subject line quality and accuracy
8. Snippet-only evidence is clearly marked

Score 0-100. Choose "revise" if score < 85 OR if any grounding/count issue exists. \
List specific issues and actionable revision instructions.

DRAFT:
${draft}`;

export const revisionPrompt = (draft: string, critique: string) => `${SYSTEM}

Revise this newsletter draft exactly ONCE based on the critique. Requirements:
- Keep ONLY items that are grounded in the supplied source data
- Maintain exactly 5-7 items
- Address each revision instruction
- Do NOT add new items not already in the draft
- Preserve all URLs exactly as supplied

DRAFT:
${draft}

CRITIQUE:
${critique}`;
