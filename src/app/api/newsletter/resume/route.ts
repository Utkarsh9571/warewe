import { Command } from "@langchain/langgraph";
import { newsletterGraph } from "@/lib/agent/graph";
import type { AgentState } from "@/lib/agent/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const encode = (event: string, data: unknown) =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

// ─── POST /api/newsletter/resume ──────────────────────────────────────────────

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  if (!json) {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { runId, approved } = json as { runId?: string; approved?: boolean };

  if (!runId || typeof approved !== "boolean") {
    return Response.json(
      { error: "runId (string) and approved (boolean) are required" },
      { status: 400 }
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(encode(event, data)));

      try {
        const config = { configurable: { thread_id: runId } };

        // Resume the interrupted graph with the approval decision
        const iterable = await newsletterGraph.stream(
          new Command({ resume: { approved } }),
          { ...config, streamMode: "updates" }
        );

        for await (const update of iterable as AsyncIterable<
          Record<string, Partial<AgentState> | unknown>
        >) {
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
        send("done", final.values);
      } catch (error) {
        send("error", {
          message: error instanceof Error ? error.message : "Resume failed",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
