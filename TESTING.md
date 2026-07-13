# SignalBrief – Manual Testing Guide

## Prerequisites

1. Follow README setup steps
2. `.env.local` contains a valid `GEMINI_API_KEY`
3. `pnpm dev` is running at `http://localhost:3000`

---

## Test 1: Fully Autonomous Mode (happy path)

**Steps:**
1. Open `http://localhost:3000`
2. Verify the goal text area is pre-filled with the assignment goal
3. Confirm **Fully Autonomous** mode is selected (default)
4. Click **▶ Run newsletter agent**

**Expected execution timeline events (in order):**
- 📋 **Planning** – completed, shows topic + queries
- 🔍 **News search** – completed, shows N unique sources discovered
- ⚡ **Rank and select sources** – completed, shows N selected
- 📰 **Article fetching** – completed/warning, shows full/snippet/failed counts
- ✍️ **Summarization** – completed, shows N summaries
- 📝 **Newsletter drafting** – completed, shows subject line
- 🔬 **Self-critique** – completed, shows score/100 and PASS or REVISE
- ✏️ **Revision** (if critique = revise) – shows "One critique-driven revision applied"
- 🤖 **Autonomous output** – completed, "human approval checkpoint bypassed"
- 📬 **Simulated send** – completed, "N subscribers"

**Expected right panel:**
- Self-critique card appears with score bar, decision badge, issues list
- Newsletter preview appears with 5-7 articles
- Simulated send confirmation banner appears
- Status badge → **completed**

**Verify:**
- [ ] 5-7 newsletter items visible
- [ ] Each item has title (linked), source, date, summary, "Why it matters"
- [ ] Snippet-only items are marked with "snippet evidence" chip
- [ ] Download HTML button works and produces a valid HTML file
- [ ] No fabricated content (all items have real URLs)

---

## Test 2: Human-in-the-Loop Mode – Approve

**Steps:**
1. Click **👤 Human in the Loop** mode button
2. Click **▶ Run newsletter agent**
3. Watch the timeline — wait for the graph to pause

**Expected:**
- Timeline shows all nodes up to and including drafting/critique/revision
- Status badge → **awaiting approval**
- **⏸ LangGraph Interrupt** card appears with:
  - Subject line
  - Article count
  - Quality score
  - Approve & resume / Reject buttons

**Approve steps:**
4. Review the newsletter preview (appears below the interrupt card)
5. Click **✓ Approve & resume**

**Expected after approval:**
- 🤖 HITL approval event: "Human reviewer approved simulated sending. Resuming graph."
- 📬 Simulated send event appears
- Simulated send confirmation banner appears
- Status badge → **completed**
- [ ] Download button works

---

## Test 3: Human-in-the-Loop Mode – Reject

**Steps:**
1. Run in Human-in-the-Loop mode
2. Wait for HITL interrupt card
3. Click **✕ Reject**

**Expected:**
- New timeline event: "Human reviewer rejected simulated sending. Run cancelled without output."
- Status badge → **cancelled**
- No output/send banner appears
- No HTML file created

**Verify:**
- [ ] `view.output` is undefined (no simulated send metadata)
- [ ] Download button is hidden (no HTML was rendered)

---

## Test 4: Missing API Key

**Steps:**
1. Temporarily remove `GEMINI_API_KEY` from `.env.local`
2. Restart `pnpm dev`
3. Run the agent

**Expected:**
- Error appears in timeline: "GEMINI_API_KEY is missing..."
- Status badge → **failed**
- No crash, clean error state

---

## Test 5: Google News RSS fallback (no NewsAPI key)

**Steps:**
1. Ensure `NEWS_PROVIDER=rss` (or `NEWS_API_KEY` is not set) in `.env.local`
2. Run the agent

**Expected:**
- Search event detail says "Provider: Google News RSS"
- Agent completes normally with RSS-sourced results

---

## Test 6: Critique-triggered revision

This is probabilistic — the critique may or may not choose to revise.

**To force observe revision:** Run the agent and check if the **Self-critique** score is below 85. If so, a **✏️ Revision** event should appear before the approval/send step.

**Verify when revision occurs:**
- [ ] Critique card shows "REVISE" decision with listed issues
- [ ] "One revision pass applied" chip visible
- [ ] Newsletter preview shows revised content

---

## Test 7: Build verification

```bash
pnpm lint        # Expected: 0 errors
pnpm test:run    # Expected: all tests pass
pnpm build       # Expected: build succeeds
```

---

## Evidence checklist for evaluators

| Criterion | Where to observe |
|---|---|
| Multi-step reasoning/workflow | Timeline: 9-11 events in order |
| ≥ 2-3 tools | searchNews, fetchArticle, renderNewsletter each appear as events |
| Self-reflection/critique | Critique panel: score, decision, issues, revision instructions |
| Autonomous mode | Run without touching Approve |
| HITL mode | Run, see interrupt, approve or reject |
| Grounded articles | 5-7 real linked articles in preview |
| Newsletter output | HTML preview + download |
| Simulated send | Output banner with timestamp |
| LangGraph usage | graph.ts, nodes.ts – verified in source code |
| Clean code | TypeScript + Zod types throughout |
