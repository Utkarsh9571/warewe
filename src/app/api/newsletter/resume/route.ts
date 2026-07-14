import { Command } from "@langchain/langgraph";
import { newsletterGraph } from "@/lib/agent/graph";
import type { AgentState } from "@/lib/agent/types";
import { renderNewsletter } from "@/lib/agent/tools";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60;

const encode = (event: string, data: unknown) =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

// === POST /api/newsletter/resume ==============================================

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  if (!json) {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { runId, approved, draft, critique } = json as {
    runId?: string;
    approved?: boolean;
    draft?: any;
    critique?: any;
  };

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

        // Check if the graph state exists in the checkpointer
        const stateSnapshot = await newsletterGraph.getState(config);
        const hasState = stateSnapshot.values && Object.keys(stateSnapshot.values).length > 0;

        if (hasState) {
          // Normal path: Resume the interrupted graph with the approval decision
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
        } else {
          // Serverless fallback: the checkpointer has no state for this thread (lost due to serverless isolation).
          // We complete the flow manually using the draft and critique provided by the client.
          const uuid = () => crypto.randomUUID();
          const timestamp = () => new Date().toISOString();

          if (approved) {
            const html = renderNewsletter(draft);
            const recipientCount = env.recipients;
            const output = {
              status: "simulated_sent" as const,
              subject: draft.subject,
              recipientCount,
              sentAt: timestamp(),
            };

            // 1. Send update for approval node
            send("update", {
              node: "approval_node",
              events: [
                {
                  id: uuid(),
                  node: "approval",
                  title: "HITL approval",
                  status: "completed" as const,
                  detail: "Human reviewer approved simulated sending (restored state).",
                  timestamp: timestamp(),
                },
              ],
              status: "running" as const,
            });

            // 2. Send update for send node
            send("update", {
              node: "send_node",
              events: [
                {
                  id: uuid(),
                  node: "send",
                  title: "Simulated send",
                  status: "completed" as const,
                  detail: `Simulated send to ${recipientCount} subscribers completed.`,
                  timestamp: timestamp(),
                },
              ],
              status: "completed" as const,
              html,
              output,
            });

            // 3. Send done event
            send("done", {
              status: "completed",
              finalNewsletter: draft,
              critique,
              html,
              output,
            });
          } else {
            // Rejected
            send("update", {
              node: "approval_node",
              events: [
                {
                  id: uuid(),
                  node: "approval",
                  title: "HITL approval",
                  status: "cancelled" as const,
                  detail: "Human reviewer rejected simulated sending (restored state).",
                  timestamp: timestamp(),
                },
              ],
              status: "cancelled" as const,
            });

            send("done", {
              status: "cancelled",
              finalNewsletter: draft,
              critique,
            });
          }
        }
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
