"use client";
import { create } from "zustand";
import type { AgentOutput, AgentStatus, Critique, Draft, Event, Mode } from "@/lib/agent/types";

export type StoreStatus = AgentStatus | "idle";

export interface RunView {
  runId?: string;
  status: StoreStatus;
  events: Event[];
  draft?: Draft;
  critique?: Critique;
  revised: boolean;
  html?: string;
  output?: AgentOutput;
  errors: string[];
  awaiting: boolean; // true when graph is interrupted for HITL
}

interface NewsletterStore {
  goal: string;
  mode: Mode;
  busy: boolean;
  view: RunView;
  setGoal: (goal: string) => void;
  setMode: (mode: Mode) => void;
  run: () => Promise<void>;
  decide: (approved: boolean) => Promise<void>;
  download: () => void;
  reset: () => void;
}

const defaultGoal =
  "Create a weekly newsletter on latest AI agent news and send it to our subscribers.";

const emptyView = (): RunView => ({
  status: "idle",
  events: [],
  errors: [],
  awaiting: false,
  revised: false,
});

// === SSE consumer ===

async function consumeSSE(
  response: Response,
  onEvent: (type: string, data: unknown) => void
) {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Streaming response unavailable");
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    // Split on either \n\n or \r\n\r\n (windows line endings)
    const chunks = buf.split(/\r?\n\r?\n/);
    buf = chunks.pop() || "";
    for (const chunk of chunks) {
      if (!chunk.trim()) continue;
      const type = chunk.match(/^event: (.+)$/m)?.[1]?.trim();
      const raw = chunk.match(/^data: (.+)$/m)?.[1]?.trim();
      if (type && raw) {
        try {
          onEvent(type, JSON.parse(raw));
        } catch (err) {
          console.error("Failed to parse SSE event JSON:", err, "raw content:", raw);
        }
      }
    }
  }
}

// === State merge helper ===

function applyUpdate(
  view: RunView,
  data: Record<string, any>
): RunView {
  const combined = [...view.events, ...(data.events || [])];
  const seen = new Set<string>();
  const uniqueEvents = combined.filter((ev) => {
    if (!ev || !ev.id || seen.has(ev.id)) return false;
    seen.add(ev.id);
    return true;
  });

  return {
    ...view,
    events: uniqueEvents,
    status: (data.status as AgentStatus) || view.status,
    draft: data.finalNewsletter || view.draft,
    critique: data.critique || view.critique,
    revised: data.revised !== undefined ? data.revised : view.revised,
    html: data.html || view.html,
    output: data.output || view.output,
    errors: [
      ...view.errors,
      ...((data.errors || []) as Array<{ message: string }>).map(
        (e) => e.message
      ),
    ],
  };
}

// === Store ===

export const useNewsletterStore = create<NewsletterStore>((set, get) => ({
  goal: defaultGoal,
  mode: "autonomous",
  busy: false,
  view: emptyView(),

  setGoal: (goal) => set({ goal }),
  setMode: (mode) => set({ mode }),
  reset: () => set({ busy: false, view: emptyView() }),

  run: async () => {
    const { goal, mode } = get();
    set({ busy: true, view: { ...emptyView(), status: "running" } });
    try {
      const response = await fetch("/api/newsletter/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, mode }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || `HTTP ${response.status}`);
      }
      let capturedRunId: string | undefined;
      await consumeSSE(response, (type, data) => {
        const d = data as Record<string, any>;
        if (type === "run") {
          capturedRunId = d.runId as string;
          set((s) => ({ view: { ...s.view, runId: d.runId as string } }));
        } else if (type === "update") {
          set((s) => ({ view: applyUpdate(s.view, d as Record<string, unknown>) }));
        } else if (type === "approval") {
          set((s) => ({
            view: {
              ...s.view,
              awaiting: true,
              status: "awaiting_approval",
              runId: capturedRunId || s.view.runId,
            },
          }));
        } else if (type === "done") {
          set((s) => {
            const nextView = applyUpdate(s.view, d);
            const stillAwaiting = nextView.status === "awaiting_approval";
            return { view: { ...nextView, awaiting: stillAwaiting } };
          });
        } else if (type === "error") {
          set((s) => ({
            view: {
              ...s.view,
              errors: [...s.view.errors, d.message || "Unknown error"],
              awaiting: false,
            },
          }));
        }
      });
    } catch (e) {
      set((s) => ({
        view: {
          ...s.view,
          errors: [
            ...s.view.errors,
            e instanceof Error ? e.message : "Run failed",
          ],
          status: "failed",
          awaiting: false,
        },
      }));
    } finally {
      set({ busy: false });
    }
  },

  decide: async (approved: boolean) => {
    const { view } = get();
    if (!view.runId) return;
    set((s) => ({ busy: true, view: { ...s.view, awaiting: false } }));
    try {
      const response = await fetch("/api/newsletter/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: view.runId, approved }),
      });
      if (!response.ok) throw new Error("Resume request failed");
      await consumeSSE(response, (type, data) => {
        const d = data as Record<string, any>;
        if (type === "update") {
          set((s) => ({ view: applyUpdate(s.view, d) }));
        } else if (type === "done") {
          set((s) => {
            const nextView = applyUpdate(s.view, d);
            const stillAwaiting = nextView.status === "awaiting_approval";
            return { view: { ...nextView, awaiting: stillAwaiting } };
          });
        } else if (type === "error") {
          set((s) => ({
            view: {
              ...s.view,
              errors: [...s.view.errors, d.message || "Resume failed"],
              awaiting: false,
            },
          }));
        }
      });
    } catch (e) {
      set((s) => ({
        view: {
          ...s.view,
          errors: [
            ...s.view.errors,
            e instanceof Error ? e.message : "Resume failed",
          ],
        },
      }));
    } finally {
      set({ busy: false });
    }
  },

  download: () => {
    const { view } = get();
    if (!view.html || !view.draft) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([view.html], { type: "text/html" }));
    a.download = `signalbrief-${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  },
}));
