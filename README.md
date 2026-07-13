# SignalBrief – AI Newsletter Agent

> **An observable, bounded LangGraph JS agent** that autonomously researches, summarises, critiques, and delivers a grounded AI-agent news newsletter.

---

## What it does

SignalBrief accepts a plain-English newsletter goal and executes an 11-node LangGraph workflow:

1. **Plan** – Gemini generates a structured research plan (topic, angle, 2-3 search queries)
2. **Search news** – Queries NewsAPI or Google News RSS (keyless fallback)
3. **Rank/select sources** – LLM picks top 9 candidates based on relevance and recency
4. **Fetch articles** – Parallel HTTP retrieval with timeouts; degrades to search snippets on failure
5. **Summarise** – Gemini creates grounded 5-7 article summaries (never fabricates)
6. **Broader retry** – If fewer than 5 usable sources found, runs one expanded query set
7. **Draft newsletter** – Gemini writes subject, intro, 5-7 items, closing
8. **Self-critique** – Separate Gemini call scores the draft 0-100 with actionable feedback
9. **Revise** – One critique-driven revision pass if score < 85
10. **HITL checkpoint** – Graph pauses for human approval (in Human-in-the-Loop mode)
11. **Simulated send** – Creates send metadata; renders HTML newsletter; no real email sent

---

## Architecture

```
Next.js App Router (TypeScript)
├── src/app/                    Next.js pages + API routes
│   ├── api/newsletter/run/     POST → SSE stream agent execution
│   ├── api/newsletter/resume/  POST → SSE stream HITL resume
│   ├── layout.tsx              App shell + fonts
│   └── page.tsx                Dashboard entry
├── src/lib/agent/              LangGraph agent
│   ├── graph.ts                StateGraph compilation + MemorySaver
│   ├── state.ts                Annotation reducers
│   ├── nodes.ts                11 graph nodes
│   ├── tools.ts                searchNews · fetchArticle · renderNewsletter
│   ├── llm.ts                  Gemini model factory (configurable via env)
│   ├── prompts.ts              6 structured prompts
│   └── types.ts                Zod schemas + TypeScript types
├── src/store/                  Zustand client state
│   └── newsletter-store.ts     SSE consumer, run/resume/download actions
├── src/components/             React UI components
│   ├── Dashboard.tsx           Orchestrator
│   ├── GoalForm.tsx            Goal input + mode toggle
│   ├── RunTimeline.tsx         Observable event log
│   ├── CritiquePanel.tsx       Score + issues + revision
│   ├── ApprovalCard.tsx        HITL approval UI
│   ├── NewsletterPreview.tsx   Newsletter + download
│   └── StatusBadge.tsx         Shared status UI
└── src/lib/env.ts              Server-side env parsing
```

### LangGraph graph

```
START → plan → search → select → collect → summarize
                          ↑             ↓
                       broaden ← (< 5 usable sources)
                                        ↓ (≥ 5)
                                      draft → critique
                                                ↓ revise? (once)
                                              revise → approval
                                                          ↓ autonomous
                                                        send → END
                                                          ↓ human
                                                     interrupt → [approve] → send → END
                                                                → [reject] → END (cancelled)
```

---

## Tools

| Tool | Purpose | Failure behaviour |
|---|---|---|
| `searchNews` | NewsAPI or Google News RSS full-text query | Falls back to RSS; logs warning |
| `fetchArticle` | HTTP article retrieval + Cheerio text extraction | Degrades to snippet; logs per-source error |
| `renderNewsletter` | Deterministic HTML renderer from typed draft data | Pure function; cannot fail |

---

## Modes

### Fully Autonomous
The agent runs end-to-end without any human interaction. After the self-critique (and optional revision), it immediately creates the simulated send result.

### Human-in-the-Loop (HITL)
LangGraph `interrupt()` is called inside the `approval` node. The graph state is persisted to an in-memory `MemorySaver` checkpointer keyed by `thread_id` (= `runId`). The SSE stream sends an `approval` event to the UI, which shows the HITL card. The user clicks **Approve** or **Reject**, which calls `POST /api/newsletter/resume` with `{ runId, approved }`. The server resumes the graph with `new Command({ resume: { approved } })`. 

- **Approve** → graph continues to `send` → `END`
- **Reject** → `approvalNode` returns `{ status: "cancelled" }` → graph goes to `END` without creating output

> ⚠️ The `MemorySaver` is in-process only. Restarting the server loses all in-flight HITL checkpoints. See Limitations.

---

## Setup

### Prerequisites
- Node.js 20+
- pnpm (`npm install -g pnpm`)
- A Gemini API key ([get one free](https://aistudio.google.com/))

### 1. Clone and install

```bash
git clone https://github.com/Utkarsh9571/warewe
cd warewe
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Required
GEMINI_API_KEY=your_gemini_api_key_here

# Optional – defaults to gemini-2.5-flash
GEMINI_MODEL=gemini-2.5-flash

# Optional – without this, the keyless Google News RSS fallback is used
NEWS_API_KEY=your_newsapi_key_here
NEWS_PROVIDER=rss   # or: newsapi

# Display-only (no email is sent)
NEXT_PUBLIC_SIMULATED_RECIPIENT_COUNT=1248
```

### 3. Run locally

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Run tests

```bash
pnpm test:run
```

### 5. Lint

```bash
pnpm lint
```

### 6. Production build

```bash
pnpm build
```

---

## Deployment (Vercel)

1. Push to GitHub
2. Import the repository in Vercel
3. Add environment variables in Vercel dashboard (same as `.env.local`)
4. Deploy → Vercel auto-detects Next.js

> The agent uses Server-Sent Events (SSE) streaming from Next.js API routes. Vercel Hobby plan supports up to 60s function timeout; Pro supports 300s. The agent typically completes in 30-90s depending on article fetch latency.

---

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | **Yes** | – | Google Gemini API key |
| `GEMINI_MODEL` | No | `gemini-2.5-flash` | Gemini model name (any supported model) |
| `NEWS_API_KEY` | No | – | NewsAPI.org key for higher quality results |
| `NEWS_PROVIDER` | No | `rss` | `newsapi` or `rss` |
| `NEXT_PUBLIC_SIMULATED_RECIPIENT_COUNT` | No | `1248` | Display-only recipient count |

---

## Limitations

1. **In-memory HITL checkpointer**: `MemorySaver` does not persist across server restarts. On Vercel serverless, each invocation is a new process — HITL only works reliably on a long-lived Node.js server (dev mode or a Vercel long-lived function). For production HITL persistence, replace `MemorySaver` with `@langchain/langgraph-checkpoint-postgres` or similar.
2. **Rate limits**: Google News RSS may throttle aggressive queries. NewsAPI free tier is limited to 100 requests/day.
3. **Publisher blocks**: Many news publishers block automated fetching. The agent degrades gracefully to snippet evidence.
4. **No real email delivery**: Sending is purely simulated (metadata + HTML file download).
5. **Single-instance HITL**: Only one concurrent HITL run is reliably supported per server instance (in-memory checkpointer keyed by runId).
6. **LLM costs**: Each run makes 4-6 Gemini API calls. With gemini-2.5-flash, typical cost is < $0.05 per run.

---

## Architectural lessons applied

From prior projects:
- **Deterministic bounded workflow** (Meera pattern) – fixed node sequence, no unbounded loops
- **Isolated observable actions** (MailPilot pattern) – each node emits typed events visible in UI
- **Typed state** – Zod schemas validate all LLM outputs
- **Defensive error handling** – per-source errors, LLM fallbacks, recoverable failures
- **Explicit human approval for side effects** – HITL genuinely pauses the graph

---

## Demo

See [TESTING.md](./TESTING.md) for the full manual test script.
