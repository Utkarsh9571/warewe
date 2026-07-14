import { RunInputSchema, type AgentState } from "@/lib/agent/types";
import { newsletterGraph } from "@/lib/agent/graph";

export const runtime = "nodejs";
export const maxDuration = 120; // 2-minute max for Vercel

// === SSE helpers =============================================================

const encode = (event: string, data: unknown) =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

// === Stream graph execution ===================================================

function streamGraph(initialState: AgentState, runId: string) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(encode(event, data)));

      try {
        // Announce run ID to client
        send("run", { runId });

        const config = { configurable: { thread_id: runId } };

        const iterable = await newsletterGraph.stream(initialState, {
          ...config,
          streamMode: "updates",
        });

        let hasAwaitingApproval = false;
        for await (const update of iterable as AsyncIterable<
          Record<string, Partial<AgentState> | unknown>
        >) {
          // HITL interrupt signal
          if ("__interrupt__" in update) {
            hasAwaitingApproval = true;
            send("approval", (update as { __interrupt__: unknown }).__interrupt__);
            continue;
          }

          const [node, payload] = Object.entries(update)[0] || [];
          if (!node || !payload) continue;

          const state = payload as Partial<AgentState>;
          send("update", {
            node,
            events: state.events || [],
            status: state.status,
            critique: state.critique,
            finalNewsletter: state.finalNewsletter,
            revised: state.revised,
            html: state.html,
            output: state.output,
            errors: state.errors || [],
          });
        }

        // Final state snapshot
        const final = await newsletterGraph.getState(config);
        const values = { ...final.values };
        if (hasAwaitingApproval) {
          values.status = "awaiting_approval";
        }
        send("done", values);
      } catch (error) {
        send("error", {
          message:
            error instanceof Error ? error.message : "Agent execution failed",
        });
      } finally {
        controller.close();
      }
    },
  });
}

// === POST /api/newsletter/run =================================================

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  if (!json) {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const body = RunInputSchema.safeParse(json);
  if (!body.success) {
    return Response.json({ error: body.error.flatten() }, { status: 400 });
  }

  const runId = crypto.randomUUID();
  const initialState: AgentState = {
    runId,
    goal: body.data.goal,
    mode: body.data.mode,
    status: "running",
    searchResults: [],
    selected: [],
    articles: [],
    summaries: [],
    events: [],
    errors: [],
    retried: false,
    revised: false,
  };

  return new Response(streamGraph(initialState, runId), {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
